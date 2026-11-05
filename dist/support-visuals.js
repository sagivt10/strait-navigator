/**
 * Original, local-only air-supply visuals. No DOM, textures, asset loads or game
 * mutations. All geometry/materials are created once and animation uses run.time,
 * so pause/help remain frozen. World targets never depend on the boat position.
 *
 * createSupportVisuals(THREE, { scene }) -> { root, update(run, state), reset,
 * dispose }. Pending: {id,kind,at,deliverAt,x,z}; drop:
 * {id,kind,x,z,spawnedAt,expiresAt,radius:8}; pickup: {id,kind,at,x,z}.
 */
const GOLD = 0xffc65a;
const CYAN = 0x62def5;
const GREEN = 0xa9ef91;
const VIOLET = 0xa593ff;
const PICKUP_RADIUS = 8;
const clamp01 = value => Math.max(0, Math.min(1, value));

const BADGE_VERTEX = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 center = modelViewMatrix * vec4(0., 0., 0., 1.);
    center.xy += position.xy;
    gl_Position = projectionMatrix * center;
  }
`;

// Analytic ×2 / +1 / heart / shield+2 glyphs, without fonts or browser canvas.
const BADGE_FRAGMENT = /* glsl */`
  uniform vec3 uColor;
  uniform float uBoost;
  uniform float uHealth;
  uniform float uShield;
  uniform float uOpacity;
  varying vec2 vUv;
  float stroke(vec2 p, vec2 a, vec2 b) {
    vec2 ab = b-a;
    float d = length(p-a-ab*clamp(dot(p-a,ab)/dot(ab,ab),0.,1.));
    return 1.-smoothstep(.045,.07,d);
  }
  void main() {
    vec2 p = vUv*2.-1.;
    vec2 q = abs(p)-vec2(.83,.70);
    float edge = length(max(q,0.))+min(max(q.x,q.y),0.)-.13;
    float mask = 1.-smoothstep(-.025,.025,edge);
    if(mask < .01) discard;
    float icon;
    float digit;
    if(uBoost > .5 || uShield > .5) {
      icon = max(stroke(p,vec2(-.64,-.28),vec2(-.27,.28)),
                 stroke(p,vec2(-.64,.28),vec2(-.27,-.28)));
      if(uShield > .5) {
        icon = stroke(p,vec2(-.75,.36),vec2(-.34,.36));
        icon = max(icon,stroke(p,vec2(-.75,.36),vec2(-.72,-.05)));
        icon = max(icon,stroke(p,vec2(-.34,.36),vec2(-.37,-.05)));
        icon = max(icon,stroke(p,vec2(-.72,-.05),vec2(-.545,-.39)));
        icon = max(icon,stroke(p,vec2(-.37,-.05),vec2(-.545,-.39)));
        icon = max(icon,stroke(p,vec2(-.19,0.),vec2(.05,0.)));
        icon = max(icon,stroke(p,vec2(-.07,-.17),vec2(-.07,.17)));
      }
      vec2 d = p-vec2(uShield*.10,0.);
      digit = stroke(d,vec2(.11,.43),vec2(.55,.43));
      digit = max(digit,stroke(d,vec2(.55,.43),vec2(.55,.05)));
      digit = max(digit,stroke(d,vec2(.55,.05),vec2(.11,.05)));
      digit = max(digit,stroke(d,vec2(.11,.05),vec2(.11,-.40)));
      digit = max(digit,stroke(d,vec2(.11,-.40),vec2(.55,-.40)));
    } else {
      icon = max(stroke(p,vec2(-.67,0.),vec2(-.24,0.)),
                 stroke(p,vec2(-.455,-.31),vec2(-.455,.31)));
      digit = max(stroke(p,vec2(.22,.26),vec2(.39,.43)),
                  stroke(p,vec2(.39,.43),vec2(.39,-.40)));
      digit = max(digit,stroke(p,vec2(.20,-.40),vec2(.56,-.40)));
      if(uHealth > .5) {
        vec2 h = (p-vec2(-.455,0.))*vec2(3.1,2.0);
        h.y -= .10;
        float body = h.x*h.x+h.y*h.y-1.;
        float heart = body*body*body-h.x*h.x*h.y*h.y*h.y;
        icon = 1.-smoothstep(-.035,.035,heart);
      }
    }
    float outline = smoothstep(-.07,-.025,edge);
    vec3 color = mix(vec3(.018,.055,.068),uColor,max(max(icon,digit),outline*.62));
    gl_FragColor = vec4(color,mask*uOpacity*.96);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createSupportVisuals(THREE, { scene } = {}) {
  const root = new THREE.Group();
  root.name = 'air-support-visuals';
  root.visible = false;
  root.userData.phase = 'idle';
  if (scene) scene.add(root);
  const geometries = new Set();
  const materials = new Set();
  let disposed = false;
  let currentKind = null;

  function geometry(value) { geometries.add(value); return value; }
  function material(value) { materials.add(value); return value; }
  function mesh(name, shape, surface, parent = root) {
    const result = new THREE.Mesh(geometry(shape), surface);
    result.name = name;
    parent.add(result);
    return result;
  }
  function part(shape, color, x = 0, y = 0, z = 0) {
    shape.translate(x, y, z);
    return { shape, color };
  }
  // Bake colored pieces together once: the complete airframe is one draw call.
  function merge(parts) {
    const positions = [], normals = [], colors = [];
    const tint = new THREE.Color();
    for (const entry of parts) {
      const shape = entry.shape.index ? entry.shape.toNonIndexed() : entry.shape;
      const p = shape.attributes.position, n = shape.attributes.normal;
      tint.setHex(entry.color);
      for (let i = 0; i < p.count; i++) {
        positions.push(p.getX(i), p.getY(i), p.getZ(i));
        normals.push(n.getX(i), n.getY(i), n.getZ(i));
        colors.push(tint.r, tint.g, tint.b);
      }
      if (shape !== entry.shape) shape.dispose();
      entry.shape.dispose();
    }
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    result.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    result.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return result;
  }

  const airframeMaterial = material(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .65, metalness: .18 }));
  const accentMaterial = material(new THREE.MeshStandardMaterial({ color: GOLD, roughness: .7, metalness: .12, emissive: GOLD, emissiveIntensity: .15 }));
  const darkMaterial = material(new THREE.MeshStandardMaterial({ color: 0x153743, roughness: .65, metalness: .25 }));
  const canopyMaterial = material(new THREE.MeshStandardMaterial({ color: GOLD, side: THREE.DoubleSide, roughness: .95, vertexColors: true }));
  const ropeMaterial = material(new THREE.LineBasicMaterial({ color: 0xeaf0df }));
  const ringMaterial = material(new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: .65, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  const badgeMaterial = material(new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(GOLD) }, uBoost: { value: 1 }, uHealth: { value: 0 }, uShield: { value: 0 }, uOpacity: { value: 1 } },
    vertexShader: BADGE_VERTEX, fragmentShader: BADGE_FRAGMENT,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  }));

  const plane = new THREE.Group();
  plane.name = 'support-plane';
  root.add(plane);
  mesh('support-airframe', merge([
    part(new THREE.CylinderGeometry(.65, .90, 7.1, 10).rotateZ(-Math.PI / 2), 0xe8ebe0),
    part(new THREE.ConeGeometry(.66, 1.55, 10).rotateZ(-Math.PI / 2), 0x274d5c, 4.1),
    part(new THREE.BoxGeometry(2.4, .19, 12), 0xf4f2da, .2, .55),
    part(new THREE.BoxGeometry(.7, .21, 1.05), 0xe6ac40, .2, .57, 5.45),
    part(new THREE.BoxGeometry(.7, .21, 1.05), 0xe6ac40, .2, .57, -5.45),
    part(new THREE.BoxGeometry(1.5, .15, 4.2), 0xe8ebe0, -3.1, .32),
    part(new THREE.BoxGeometry(1.5, 1.6, .16), 0x2b6777, -3.1, 1.0),
    part(new THREE.SphereGeometry(1, 10, 6).scale(1.15, .45, .56), 0x153b4a, 2.0, .65),
    part(new THREE.CylinderGeometry(.42, .42, 1.7, 8).rotateZ(-Math.PI / 2), 0x234b58, .7, .35, 2.6),
    part(new THREE.CylinderGeometry(.42, .42, 1.7, 8).rotateZ(-Math.PI / 2), 0x234b58, .7, .35, -2.6),
  ]), airframeMaterial, plane);
  const propellerGeometry = geometry(new THREE.BoxGeometry(.12, 2.5, .12));
  const propellers = new THREE.InstancedMesh(propellerGeometry, darkMaterial, 4);
  propellers.name = 'support-propellers';
  propellers.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  plane.add(propellers);
  const propellerMatrix = new THREE.Matrix4();

  const payload = new THREE.Group();
  payload.name = 'support-payload';
  root.add(payload);
  mesh('support-crate', new THREE.BoxGeometry(2.35, 1.7, 2.1), accentMaterial, payload);
  mesh('support-crate-straps', merge([
    part(new THREE.BoxGeometry(.17, 1.76, 2.16), 0xffffff, -.64),
    part(new THREE.BoxGeometry(.17, 1.76, 2.16), 0xffffff, .64),
    part(new THREE.BoxGeometry(2.39, .19, 2.14), 0xffffff),
  ]), darkMaterial, payload);

  const parachute = new THREE.Group();
  parachute.name = 'support-parachute';
  payload.add(parachute);
  const dome = new THREE.SphereGeometry(3.55, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const domePositions = dome.attributes.position;
  const domeColors = new Float32Array(domePositions.count * 3);
  for (let i = 0; i < domePositions.count; i++) {
    const stripe = Math.floor((Math.atan2(domePositions.getZ(i), domePositions.getX(i)) + Math.PI) / (Math.PI / 6));
    const value = stripe % 2 ? .65 : 1;
    domeColors[i * 3] = domeColors[i * 3 + 1] = domeColors[i * 3 + 2] = value;
  }
  dome.setAttribute('color', new THREE.Float32BufferAttribute(domeColors, 3));
  mesh('support-canopy', dome, canopyMaterial, parachute).position.y = 3.7;
  const ropes = new Float32Array(8 * 6);
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4, x = Math.cos(angle), z = Math.sin(angle);
    ropes.set([x * .92, .75, z * .78, x * 3.55, 3.7, z * 3.55], i * 6);
  }
  const ropeGeometry = geometry(new THREE.BufferGeometry());
  ropeGeometry.setAttribute('position', new THREE.BufferAttribute(ropes, 3));
  const cords = new THREE.LineSegments(ropeGeometry, ropeMaterial);
  cords.name = 'support-parachute-cords';
  parachute.add(cords);

  const ring = mesh('support-collection-ring', new THREE.RingGeometry(.963, 1, 64), ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.renderOrder = 3;
  const badge = mesh('support-kind-badge', new THREE.PlaneGeometry(6.5, 3.3), badgeMaterial);
  badge.frustumCulled = false; // The vertex shader turns it toward any stern camera.
  badge.renderOrder = 4;

  function validTarget(value) {
    return value && (value.kind === 'boost' || value.kind === 'intercept' || value.kind === 'health' || value.kind === 'shield') && Number.isFinite(value.x) && Number.isFinite(value.z);
  }
  function setKind(kind) {
    if (currentKind === kind) return;
    currentKind = kind;
    const tint = kind === 'boost' ? GOLD : kind === 'health' ? GREEN : kind === 'shield' ? VIOLET : CYAN;
    accentMaterial.color.setHex(tint);
    accentMaterial.emissive.setHex(tint);
    canopyMaterial.color.setHex(tint);
    ringMaterial.color.setHex(tint);
    badgeMaterial.uniforms.uColor.value.setHex(tint);
    badgeMaterial.uniforms.uBoost.value = kind === 'boost' ? 1 : 0;
    badgeMaterial.uniforms.uHealth.value = kind === 'health' ? 1 : 0;
    badgeMaterial.uniforms.uShield.value = kind === 'shield' ? 1 : 0;
    root.userData.kind = kind;
  }
  function flyby(time, start, x, z) {
    const elapsed = time - start;
    plane.visible = time >= start && time < start + 4.2;
    if (!plane.visible) return;
    plane.position.set(x - 24 + elapsed * 51, 32 + Math.sin(elapsed * .9) * 1.3, z + 3 - elapsed * 2.2);
    plane.rotation.set(.045, .04, -.045);
    for (let i = 0; i < 4; i++) {
      propellerMatrix.makeRotationX(elapsed * 44 + (i % 2) * Math.PI / 2);
      propellerMatrix.setPosition(1.6, .35, i < 2 ? 2.6 : -2.6);
      propellers.setMatrixAt(i, propellerMatrix);
    }
    propellers.instanceMatrix.needsUpdate = true;
  }
  function hide() {
    root.visible = plane.visible = payload.visible = parachute.visible = ring.visible = badge.visible = false;
    root.userData.phase = 'idle';
  }

  function update(run, state) {
    if (disposed) return;
    hide();
    if (!run || !Number.isFinite(run.time) || state === 'intro' || state === 'won' || state === 'lost' || state === 'docking') return;
    const time = run.time, pending = run.supportPending, drop = run.supportDrop, pickup = run.lastSupportPickup;
    if (validTarget(drop) && Number.isFinite(drop.spawnedAt) && Number.isFinite(drop.expiresAt) && time >= drop.spawnedAt && time < drop.expiresAt) {
      root.visible = payload.visible = ring.visible = badge.visible = true;
      root.userData.phase = 'drop';
      setKind(drop.kind);
      const age = time - drop.spawnedAt;
      const radius = Number.isFinite(drop.radius) && drop.radius > 0 && drop.radius <= 32 ? drop.radius : PICKUP_RADIUS;
      payload.position.set(drop.x, 1.12 + Math.sin(age * 2.7) * .14, drop.z);
      payload.rotation.set(Math.sin(age * 1.8) * .055, .25, Math.cos(age * 2.1) * .06);
      ring.position.set(drop.x, .30, drop.z);
      ring.scale.setScalar(radius);
      ringMaterial.opacity = .57 + Math.sin(age * 3.2) * .12;
      badge.position.set(drop.x, 5.1 + Math.sin(age * 2.7) * .14, drop.z);
      badgeMaterial.uniforms.uOpacity.value = 1;
      flyby(time, drop.spawnedAt - 3, drop.x, drop.z);
    } else if (validTarget(pending) && Number.isFinite(pending.at) && Number.isFinite(pending.deliverAt) && pending.deliverAt > pending.at && time >= pending.at && time < pending.deliverAt) {
      root.visible = payload.visible = parachute.visible = ring.visible = badge.visible = true;
      root.userData.phase = 'pending';
      setKind(pending.kind);
      const progress = clamp01((time - pending.at) / (pending.deliverAt - pending.at));
      payload.position.set(pending.x, 1.12 + 24 * Math.pow(1 - progress, 1.14), pending.z);
      payload.rotation.set(0, .25, 0);
      parachute.scale.setScalar(.45 + .55 * clamp01(progress * 7));
      ring.position.set(pending.x, .30, pending.z);
      ring.scale.setScalar(PICKUP_RADIUS);
      ringMaterial.opacity = .30 + Math.sin(progress * 15) * .08;
      badge.position.set(pending.x, payload.position.y + 1.9, pending.z);
      badgeMaterial.uniforms.uOpacity.value = 1;
      flyby(time, pending.at, pending.x, pending.z);
    } else if (validTarget(pickup) && Number.isFinite(pickup.at) && time >= pickup.at && time < pickup.at + 1.1) {
      root.visible = ring.visible = badge.visible = true;
      root.userData.phase = 'pickup';
      setKind(pickup.kind);
      const progress = clamp01((time - pickup.at) / 1.1);
      ring.position.set(pickup.x, .32, pickup.z);
      ring.scale.setScalar(2 + progress * 6);
      ringMaterial.opacity = (1 - progress) * .65;
      badge.position.set(pickup.x, 5.1 + progress * 2.5, pickup.z);
      badgeMaterial.uniforms.uOpacity.value = 1 - progress;
    }
  }

  function reset() {
    if (disposed) return;
    hide();
    currentKind = null;
    delete root.userData.kind;
    payload.position.set(0, 0, 0);
    payload.rotation.set(0, 0, 0);
    parachute.scale.setScalar(1);
    ring.scale.setScalar(PICKUP_RADIUS);
    badgeMaterial.uniforms.uOpacity.value = 0;
  }
  function dispose() {
    if (disposed) return;
    reset();
    disposed = true;
    root.removeFromParent();
    for (const resource of geometries) resource.dispose();
    for (const resource of materials) resource.dispose();
    root.clear();
  }

  reset();
  return { root, update, reset, dispose };
}
