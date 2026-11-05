/**
 * Abstract, procedural protection effects. No real equipment or external assets.
 * A forward-only translucent shell leaves the stern camera and captain clear.
 * Two fixed effect slots retain both events in a salvo; every clock uses run.time.
 *
 * createShieldVisuals(THREE, { scene }) -> { root, update(run, state), reset,
 * dispose }. The logic owns shieldUntil / shieldCharges and retains intercepted
 * missiles with shieldIntercept: { id, at, from:{x,y,z}, target:{x,y,z} }.
 */
export const SHIELD_EFFECT_LIFETIME = 1.2;
const VIOLET = 0xa593ff;
const BLUE = 0x92d9ff;
const clamp01 = value => Math.max(0, Math.min(1, value));

const SHELL_VERTEX = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  }
`;
const SHELL_FRAGMENT = /* glsl */`
  uniform float uTime;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float rim = 1.-smoothstep(.012,.055,vUv.y);
    float bands = pow(.5+.5*cos(vUv.y*31.41593-uTime*.8),18.);
    float openEdge = smoothstep(0.,.10,vUv.x)*smoothstep(0.,.10,1.-vUv.x);
    float alpha = (.018+rim*.08+bands*.023)*uOpacity*openEdge;
    gl_FragColor = vec4(mix(vec3(.35,.65,1.),vec3(.64,.54,1.),vUv.y),alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
const TRAIL_VERTEX = /* glsl */`
  uniform vec3 uFrom;
  uniform vec3 uTarget;
  uniform float uProgress;
  uniform float uWidth;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    float t = uv.y*uProgress;
    vec3 center = mix(uFrom,uTarget,t);
    center.y += sin(t*3.141593)*3.4;
    vec3 tangent = uTarget-uFrom+vec3(0.,cos(t*3.141593)*10.68142,0.);
    vec4 view = modelViewMatrix*vec4(center,1.);
    vec2 direction = (modelViewMatrix*vec4(tangent,0.)).xy;
    vec2 normal = vec2(-direction.y,direction.x)/max(length(direction),.0001);
    view.xy += normal*position.x*uWidth;
    gl_Position = projectionMatrix*view;
  }
`;
const TRAIL_FRAGMENT = /* glsl */`
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float edge = 1.-smoothstep(.16,.5,abs(vUv.x-.5));
    float core = 1.-smoothstep(.015,.12,abs(vUv.x-.5));
    float taper = smoothstep(0.,.16,vUv.y)*(.25+.75*vUv.y);
    float alpha = edge*taper*uOpacity;
    if(alpha<.006) discard;
    gl_FragColor = vec4(mix(vec3(.45,.49,1.),vec3(.87,.97,1.),core),alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
const FLASH_VERTEX = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 center = modelViewMatrix*vec4(0.,0.,0.,1.);
    // Matrix basis length preserves world size while facing either chase camera.
    center.xy += position.xy*vec2(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz));
    gl_Position = projectionMatrix*center;
  }
`;
const FLASH_FRAGMENT = /* glsl */`
  uniform float uAge;
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv*2.-1.;
    float r = length(p);
    float core = pow(max(0.,1.-r*2.3),2.);
    float halo = pow(max(0.,1.-r),2.)*.34;
    float ring = (1.-smoothstep(.025,.07,abs(r-(.22+uAge*.50))))*.55;
    float rays = pow(max(0.,1.-min(abs(p.x),abs(p.y))*18.),3.)*max(0.,1.-r)*.28;
    float alpha = max(max(core,halo),max(ring,rays))*uOpacity;
    if(alpha<.006) discard;
    gl_FragColor = vec4(mix(vec3(.57,.54,1.),vec3(.91,.98,1.),max(core,ring*.5)),alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createShieldVisuals(THREE, { scene } = {}) {
  const root = new THREE.Group();
  root.name = 'shield-visuals';
  if (scene) scene.add(root);
  const geometries = new Set(), materials = new Set();
  let disposed = false;
  function geometry(value) { geometries.add(value); return value; }
  function material(value) { materials.add(value); return value; }
  function mesh(name, shape, surface, parent = root) {
    const result = new THREE.Mesh(shape, surface);
    result.name = name;
    result.renderOrder = 4;
    parent.add(result);
    return result;
  }
  function shader(uniforms, vertexShader, fragmentShader) {
    return material(new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader,
      transparent: true, depthWrite: false, depthTest: true,
      side: THREE.DoubleSide, forceSinglePass: true, toneMapped: false }));
  }

  const shell = new THREE.Group();
  shell.name = 'shield-active-shell';
  root.add(shell);
  const shellMaterial = shader({ uTime: { value: 0 }, uOpacity: { value: 0 } }, SHELL_VERTEX, SHELL_FRAGMENT);
  // Three.js phi PI..2PI is the forward (-Z) half. There is no aft wall.
  const shellGeometry = geometry(new THREE.SphereGeometry(1, 28, 10, Math.PI, Math.PI, 0, Math.PI / 2));
  const dome = mesh('shield-forward-dome', shellGeometry, shellMaterial, shell);
  dome.position.set(0, .45, -.8);
  dome.scale.set(7.2, 6.4, 11);

  const ribs = [];
  function point(phi, theta) {
    ribs.push(-Math.cos(phi)*Math.sin(theta)*7.2, Math.cos(theta)*6.4+.45, Math.sin(phi)*Math.sin(theta)*11-.8);
  }
  // A low bow rim and three sparse ribs, rather than an opaque bubble.
  for (let i = 0; i < 28; i++) {
    point(Math.PI+i*Math.PI/28, Math.PI/2);
    point(Math.PI+(i+1)*Math.PI/28, Math.PI/2);
  }
  for (let rib = 0; rib < 3; rib++) for (let i = 1; i < 12; i++) {
    const phi = Math.PI+(rib+1)*Math.PI/4;
    point(phi, i*Math.PI/24);
    point(phi, (i+1)*Math.PI/24);
  }
  const ribGeometry = geometry(new THREE.BufferGeometry());
  ribGeometry.setAttribute('position', new THREE.Float32BufferAttribute(ribs, 3));
  const ribMaterial = material(new THREE.LineBasicMaterial({ color: VIOLET, transparent: true, opacity: .24, depthWrite: false, toneMapped: false }));
  const outline = new THREE.LineSegments(ribGeometry, ribMaterial);
  outline.name = 'shield-open-ribs';
  outline.renderOrder = 4;
  shell.add(outline);
  const chargeGeometry = geometry(new THREE.SphereGeometry(.23, 8, 6));
  const chargeMaterial = material(new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: .85, depthWrite: false, toneMapped: false }));
  const charges = [mesh('shield-charge-1', chargeGeometry, chargeMaterial, shell), mesh('shield-charge-2', chargeGeometry, chargeMaterial, shell)];
  charges[0].position.set(-4.8, .8, -3.2);
  charges[1].position.set(4.8, .8, -3.2);

  // Exactly two slots. Geometry and materials never grow with interception count.
  const trailGeometry = geometry(new THREE.PlaneGeometry(1, 1, 1, 20));
  const flashGeometry = geometry(new THREE.PlaneGeometry(1, 1));
  const slots = [];
  for (let i = 0; i < 2; i++) {
    const group = new THREE.Group();
    group.name = `shield-interception-${i+1}`;
    root.add(group);
    const trailMaterial = shader({
      uFrom: { value: new THREE.Vector3() }, uTarget: { value: new THREE.Vector3() },
      uProgress: { value: 0 }, uWidth: { value: .8 }, uOpacity: { value: 0 },
    }, TRAIL_VERTEX, TRAIL_FRAGMENT);
    const trail = mesh(`shield-counter-tracer-${i+1}`, trailGeometry, trailMaterial, group);
    trail.frustumCulled = false; // The shader positions this shared strip in world space.
    const flashMaterial = shader({ uAge: { value: 0 }, uOpacity: { value: 0 } }, FLASH_VERTEX, FLASH_FRAGMENT);
    const flash = mesh(`shield-midair-flash-${i+1}`, flashGeometry, flashMaterial, group);
    flash.frustumCulled = false;
    slots.push({ group, trail, flash, trailMaterial, flashMaterial });
  }

  function hiddenState(state) {
    return state === 'intro' || state === 'won' || state === 'lost' || state === 'docking';
  }
  function finitePoint(value) {
    return value && Number.isFinite(value.x) && Number.isFinite(value.y) && Number.isFinite(value.z)
      && Math.abs(value.x) < 1e6 && Math.abs(value.y) < 1e6 && Math.abs(value.z) < 1e6;
  }
  function validEvent(event, time) {
    return event && event.id !== undefined && Number.isFinite(event.at)
      && time >= event.at && time < event.at+SHIELD_EFFECT_LIFETIME
      && finitePoint(event.from) && finitePoint(event.target);
  }
  function sameEvent(a, b) { return a && b && a.id === b.id && a.at === b.at; }
  function hide() {
    root.visible = shell.visible = false;
    root.userData.phase = 'idle';
    root.userData.charges = root.userData.interceptsVisible = 0;
    for (const slot of slots) {
      slot.group.visible = slot.trail.visible = slot.flash.visible = false;
      slot.group.userData.eventId = null;
    }
  }
  function showEvent(slot, event, time) {
    if (!event) return;
    const age = time-event.at;
    const arrival = .18;
    const trailFade = 1-clamp01((age-arrival)/.45);
    slot.group.visible = true;
    slot.group.userData.eventId = event.id;
    slot.trail.visible = trailFade > 0;
    const uniforms = slot.trailMaterial.uniforms;
    uniforms.uFrom.value.set(event.from.x, event.from.y, event.from.z);
    uniforms.uTarget.value.set(event.target.x, event.target.y, event.target.z);
    uniforms.uProgress.value = Math.max(.015, clamp01(age/arrival));
    uniforms.uWidth.value = .8-.35*clamp01(age/.63);
    uniforms.uOpacity.value = trailFade*.95;
    const flashAge = clamp01((age-arrival)/(SHIELD_EFFECT_LIFETIME-arrival));
    slot.flash.visible = age >= arrival;
    slot.flash.position.set(event.target.x, event.target.y, event.target.z);
    slot.flash.scale.setScalar(3.2+flashAge*6);
    slot.flashMaterial.uniforms.uAge.value = flashAge;
    slot.flashMaterial.uniforms.uOpacity.value = (1-flashAge)*(1-flashAge)*.95;
    root.visible = true;
    root.userData.interceptsVisible++;
  }
  function update(run, state) {
    if (disposed) return;
    hide();
    if (!run || !Number.isFinite(run.time) || hiddenState(state) || hiddenState(run.state)) return;
    const time = run.time;
    const active = Number.isFinite(run.shieldUntil) && time < run.shieldUntil
      && Number.isFinite(run.shieldCharges) && run.shieldCharges >= 1
      && Number.isFinite(run.x) && Number.isFinite(run.z);
    if (active) {
      root.visible = shell.visible = true;
      shell.position.set(run.x, 0, run.z);
      shell.rotation.set(0, Number.isFinite(run.heading) ? run.heading : 0, 0);
      const fade = Math.min(1, (run.shieldUntil-time)/.55);
      shellMaterial.uniforms.uTime.value = time%1000;
      shellMaterial.uniforms.uOpacity.value = fade*(.85+Math.sin((time%1000)*2.4)*.15);
      ribMaterial.opacity = fade*(.22+Math.sin((time%1000)*2.4)*.04);
      root.userData.charges = Math.min(2, Math.floor(run.shieldCharges));
      charges[0].visible = true;
      charges[1].visible = run.shieldCharges >= 2;
    }
    // Read retained missiles, not only the latest event, so paired shots survive.
    let latest = null, previous = null;
    if (Array.isArray(run.missiles)) for (const missile of run.missiles) {
      const event = missile && missile.intercepted && missile.shieldIntercept;
      if (!validEvent(event, time) || sameEvent(event, latest) || sameEvent(event, previous)) continue;
      if (!latest || event.at >= latest.at) { previous = latest; latest = event; }
      else if (!previous || event.at > previous.at) previous = event;
    }
    const fallback = run.lastShieldIntercept;
    if (validEvent(fallback, time) && !sameEvent(fallback, latest) && !sameEvent(fallback, previous)) {
      if (!latest || fallback.at >= latest.at) { previous = latest; latest = fallback; }
      else if (!previous || fallback.at > previous.at) previous = fallback;
    }
    showEvent(slots[0], previous || latest, time);
    showEvent(slots[1], previous ? latest : null, time);
    root.userData.phase = root.userData.interceptsVisible ? 'intercept' : active ? 'active' : 'idle';
  }
  function reset() {
    if (disposed) return;
    hide();
    shell.position.set(0, 0, 0);
    shell.rotation.set(0, 0, 0);
    shellMaterial.uniforms.uTime.value = shellMaterial.uniforms.uOpacity.value = 0;
    for (const slot of slots) {
      slot.trailMaterial.uniforms.uFrom.value.set(0, 0, 0);
      slot.trailMaterial.uniforms.uTarget.value.set(0, 0, 0);
      slot.trailMaterial.uniforms.uProgress.value = slot.trailMaterial.uniforms.uOpacity.value = 0;
      slot.flashMaterial.uniforms.uAge.value = slot.flashMaterial.uniforms.uOpacity.value = 0;
      slot.flash.position.set(0, 0, 0);
      slot.flash.scale.setScalar(1);
    }
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
