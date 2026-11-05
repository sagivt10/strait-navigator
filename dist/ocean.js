/**
 * Local visual A/B ocean. Purely procedural; no render targets, textures, or fetches.
 *
 * const ocean = createOcean(THREE, {scene, quality: 'high'});
 * ocean.update(dt, elapsedSeconds, {x, z, heading, speed}, isSailing);
 * Heading follows the game: zero faces -Z; positive turns toward -X.
 * Optional: ocean.sampleHeight(x,z,time) includes waterLevel, not a hull offset.
 * Geometry, sample history, uniforms and typed arrays are allocated only at creation.
 */
export const OCEAN_LIMITS = Object.freeze({
  highSegments: 160, mobileSegments: 112, wakeSamples: 96,
  wakeLifetime: 8.0, waterLevel: -0.38, maxWaveAmplitude: 0.435,
});

// Same phases in CPU sampling and both vertex shaders. Moderate displacement
// leaves the original warning footprints/rings (y=.22 and above) fully visible.
const WAVE_GLSL = /* glsl */`
  uniform float uTime;
  uniform vec2 uAnchor;
  uniform float uWaterLevel;
  vec3 oceanWave(vec2 p) {
    float a = dot(p, vec2(.115, .080)) - uTime * .83;
    float b = dot(p, vec2(-.095, .220)) - uTime * 1.08;
    float c = dot(p, vec2(.390, .180)) - uTime * 1.48;
    float d = dot(p, vec2(-.610, .450)) - uTime * 1.92;
    float e = dot(p, vec2(.840, .920)) - uTime * 2.30;
    vec2 fromAnchor = p-uAnchor;
    float radius = length(fromAnchor);
    float nearT = clamp((radius-55.0)/95.0,0.0,1.0);
    float farT = clamp((radius-140.0)/300.0,0.0,1.0);
    float nearFade = 1.0-nearT*nearT*(3.0-2.0*nearT);
    float farFade = 1.0-farT*farT*(3.0-2.0*farT);
    vec2 radial = fromAnchor/max(radius,.001);
    vec2 nearGradient = radial*(-6.0*nearT*(1.0-nearT)/95.0);
    vec2 farGradient = radial*(-6.0*farT*(1.0-farT)/300.0);
    float shortHeight = .075*sin(c)+.035*sin(d)+.015*sin(e);
    float fullHeight = .180*sin(a)+.130*sin(b)+shortHeight*nearFade;
    float height = fullHeight*farFade;
    vec2 slope = (.180*cos(a)*vec2(.115,.080) + .130*cos(b)*vec2(-.095,.220)
                 + .075*cos(c)*vec2(.390,.180)*nearFade
                 + .035*cos(d)*vec2(-.610,.450)*nearFade
                 + .015*cos(e)*vec2(.840,.920)*nearFade
                 + shortHeight*nearGradient)*farFade + fullHeight*farGradient;
    return vec3(height, slope);
  }
`;

const VERTEX_SHADER = /* glsl */`
  ${WAVE_GLSL}
  varying vec3 vWorld;
  varying vec2 vSlope;
  varying float vHeight;
  void main() {
    vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
    vec3 wave = oceanWave(world.xz);
    world.y = uWaterLevel + wave.x;
    vWorld = world;
    vSlope = wave.yz;
    vHeight = wave.x;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */`
  uniform float uTime;
  uniform vec3 uSun;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform vec4 uShip;
  varying vec3 vWorld;
  varying vec2 vSlope;
  varying float vHeight;
  #include <common>

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  void main() {
    vec3 eye = normalize(cameraPosition - vWorld);
    float distanceToEye = length(cameraPosition - vWorld);
    vec2 p = vWorld.xz;
    // Analytic short-wave normal detail: derivatives attenuate subpixel waves.
    float footprint = max(length(dFdx(p)), length(dFdy(p)));
    float rippleFade = 1.0 - smoothstep(.18, 1.7, footprint);
    float r1 = dot(p, vec2(1.75, 1.05)) - uTime*2.15;
    float r2 = dot(p, vec2(-2.20, 1.65)) + uTime*2.60;
    float r3 = dot(p, vec2(3.85, .95)) - uTime*3.05;
    float r4 = dot(p, vec2(-4.10, 4.70)) + uTime*3.80;
    vec2 ripple = vec2(1.75,1.05)*cos(r1)*.012
                + vec2(-2.20,1.65)*cos(r2)*.009
                + vec2(3.85,.95)*cos(r3 + sin(r1)*.34)*.0045
                + vec2(-4.10,4.70)*cos(r4)*.002;
    vec3 n = normalize(vec3(-vSlope.x-ripple.x*rippleFade, 1.0,
                           -vSlope.y-ripple.y*rippleFade));
    float ndv = max(dot(n, eye), 0.0);
    float fresnel = .025 + .975 * pow(1.0-ndv, 5.0);
    vec3 reflected = reflect(-eye, n);
    float skyHeight = clamp(reflected.y, 0.0, 1.0);
    vec3 horizon = vec3(.56, .62, .62);
    vec3 zenith = vec3(.095, .225, .34);
    vec3 sky = mix(horizon, zenith, pow(skyHeight, .45));
    float sunAlignment = max(dot(reflected, uSun), 0.0);
    sky += vec3(1.0, .48, .15) * pow(sunAlignment, 9.0) * .28;
    // Warm specular lobe plus small bright glints; no bloom pass required.
    float sunTrail = pow(sunAlignment, 90.0)*.72
                   + pow(sunAlignment, 720.0)*2.4;
    float deepVariation = .5 + .5*sin(p.x*.032 + p.y*.021 + uTime*.18);
    vec3 body = mix(vec3(.008,.061,.079), vec3(.016,.135,.150), deepVariation*.48);
    body += vec3(.007,.025,.027) * clamp(vHeight/.4 + .5, 0.0, 1.0);
    body *= .83 + .25*max(dot(n,uSun),0.0);
    vec3 color = mix(body, sky, clamp(fresnel*.92 + .055, 0.0, 1.0));
    color += vec3(1.0,.67,.30)*sunTrail*(.24 + fresnel*.76);
    // Restrained translucent streaks on the steepest nearby wave crests.
    float crest = smoothstep(.245,.38,vHeight) * smoothstep(.055,.12,length(vSlope));
    float fleck = smoothstep(.65,.83,noise(p*2.2 + vec2(uTime*.19,-uTime*.36)));
    float foam = crest * fleck * rippleFade * .16;
    color = mix(color, vec3(.65,.80,.76), foam);
    // Bow pressure and narrow shoulder foam are evaluated only near the vessel.
    vec2 delta = p - uShip.xy;
    float h = uShip.z;
    float across = dot(delta, vec2(cos(h),-sin(h)));
    float aft = dot(delta, vec2(sin(h),cos(h)));
    float speedFoam = smoothstep(.6,9.0,abs(uShip.w));
    if(dot(delta,delta)<70.0 && speedFoam>.001) {
      float shoulder = exp(-pow((abs(across)-2.03)/.42,2.0))
                     * (1.0-smoothstep(2.0,5.3,abs(aft+.8)));
      float bow = exp(-pow((aft+5.0)/.48,2.0))
                * (1.0-smoothstep(.4,1.7,abs(across)));
      float churn = .52 + .48*noise(p*3.6 + vec2(uTime*1.9,-uTime*2.1));
      color = mix(color, vec3(.70,.86,.82), min(.65,(shoulder*.60+bow*.42)*speedFoam*churn));
    }
    float fog = 1.0-exp(-distanceToEye*uFogDensity);
    color = mix(color, uFogColor, fog);
    gl_FragColor = vec4(color,1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const WAKE_VERTEX_SHADER = /* glsl */`
  ${WAVE_GLSL}
  attribute vec4 aWake;
  varying vec4 vWake;
  varying vec3 vWorld;
  void main() {
    vec3 p = position;
    p.y = uWaterLevel + oceanWave(p.xz).x + .027;
    vWorld = p;
    vWake = aWake;
    gl_Position = projectionMatrix * viewMatrix * vec4(p,1.0);
  }
`;
const WAKE_FRAGMENT_SHADER = /* glsl */`
  uniform float uTime;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  varying vec4 vWake;
  varying vec3 vWorld;
  #include <common>
  float hash(vec2 p) {
    p = fract(p * vec2(123.34,456.21));
    p += dot(p,p+45.32);
    return fract(p.x*p.y);
  }
  float noise(vec2 p) {
    vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
               mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
  }
  void main() {
    float across = abs(vWake.x*2.0-1.0);
    float edge = 1.0-smoothstep(.35,1.0,across);
    vec2 p = vWorld.xz;
    float bubbles = noise(p*2.4 + vec2(uTime*.29,-uTime*.42));
    float folds = .5+.5*sin(vWake.y*19.0 + uTime*2.8 + bubbles*3.2);
    float lace = smoothstep(.20,.72,bubbles) * (.56+.44*folds);
    float alpha = edge*vWake.z*(.22+.78*lace);
    if(alpha < .012) discard;
    vec3 color = mix(vec3(.16,.40,.41),vec3(.72,.87,.79),.48+.52*bubbles);
    float fog = 1.0-exp(-length(cameraPosition-vWorld)*uFogDensity);
    color = mix(color,uFogColor,fog);
    gl_FragColor = vec4(color,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.max(min,Math.min(max,value));
const smoothstep = (lo,hi,x) => {const v=clamp((x-lo)/(hi-lo),0,1);return v*v*(3-2*v);};

/** A square with sub-metre spacing at the hull, smoothly stretching to horizon. */
function createSurfaceGeometry(THREE, segments) {
  const size=segments+1, positions=new Float32Array(size*size*3);
  const indices=new Uint16Array(segments*segments*6);
  function coord(i) {
    const u=(i/segments)*2-1, a=Math.abs(u);
    return Math.sign(u)*(38*a+2062*Math.pow(a,3.8));
  }
  for(let z=0;z<size;z++) for(let x=0;x<size;x++) {
    const i=(z*size+x)*3;
    positions[i]=coord(x);positions[i+1]=0;positions[i+2]=coord(z);
  }
  let k=0;
  for(let z=0;z<segments;z++) for(let x=0;x<segments;x++) {
    const a=z*size+x,b=a+1,c=a+size,d=c+1;
    indices[k++]=a;indices[k++]=c;indices[k++]=b;
    indices[k++]=b;indices[k++]=c;indices[k++]=d;
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setIndex(new THREE.BufferAttribute(indices,1));
  geometry.computeBoundingSphere();
  return geometry;
}

export function createOcean(THREE, options={}) {
  const waterLevel=finite(options.waterLevel,OCEAN_LIMITS.waterLevel);
  const segments=options.quality==='mobile'?OCEAN_LIMITS.mobileSegments:OCEAN_LIMITS.highSegments;
  const root=new THREE.Group();root.name='Ocean visual A/B';
  const sunDirection=new THREE.Vector3(-.48,.28,-.83).normalize();
  if(options.sunDirection && Number.isFinite(options.sunDirection.x) &&
     Number.isFinite(options.sunDirection.y) && Number.isFinite(options.sunDirection.z)) {
    sunDirection.copy(options.sunDirection);
    if(sunDirection.lengthSq()<.0001)sunDirection.set(-.48,.28,-.83);
    sunDirection.normalize();
  }
  const uniforms={
    uTime:{value:0},uAnchor:{value:new THREE.Vector2()},uWaterLevel:{value:waterLevel},
    uSun:{value:sunDirection},uFogColor:{value:new THREE.Color(options.fogColor??'#a6b7bf')},
    uFogDensity:{value:finite(options.fogDensity,.0018)},uShip:{value:new THREE.Vector4()},
  };
  const geometry=createSurfaceGeometry(THREE,segments);
  const material=new THREE.ShaderMaterial({
    uniforms, vertexShader:VERTEX_SHADER,fragmentShader:FRAGMENT_SHADER,
    name:'Layered ocean / Fresnel / golden glints',toneMapped:true,
  });
  const mesh=new THREE.Mesh(geometry,material);mesh.name='Ocean surface';mesh.frustumCulled=false;
  root.add(mesh);

  const capacity=OCEAN_LIMITS.wakeSamples;
  const wakePositions=new Float32Array(capacity*6*3);
  const wakeData=new Float32Array(capacity*6*4);
  const wakeIndices=new Uint16Array((capacity-1)*3*6);
  const hx=new Float32Array(capacity), hz=new Float32Array(capacity);
  const hh=new Float32Array(capacity), hb=new Float32Array(capacity), hs=new Float32Array(capacity);
  let j=0;
  for(let s=0;s<3;s++) for(let i=0;i<capacity-1;i++) {
    const a=s*capacity*2+i*2,b=a+1,c=a+2,d=a+3;
    wakeIndices[j++]=a;wakeIndices[j++]=b;wakeIndices[j++]=c;
    wakeIndices[j++]=b;wakeIndices[j++]=d;wakeIndices[j++]=c;
  }
  const wakeGeometry=new THREE.BufferGeometry();
  const positionAttribute=new THREE.BufferAttribute(wakePositions,3).setUsage(THREE.DynamicDrawUsage);
  const wakeAttribute=new THREE.BufferAttribute(wakeData,4).setUsage(THREE.DynamicDrawUsage);
  wakeGeometry.setAttribute('position',positionAttribute);
  wakeGeometry.setAttribute('aWake',wakeAttribute);
  wakeGeometry.setIndex(new THREE.BufferAttribute(wakeIndices,1));
  const wakeMaterial=new THREE.ShaderMaterial({
    uniforms,vertexShader:WAKE_VERTEX_SHADER,fragmentShader:WAKE_FRAGMENT_SHADER,
    name:'Continuous curved foam wake',transparent:true,depthWrite:false,
    side:THREE.DoubleSide,toneMapped:true,polygonOffset:true,polygonOffsetFactor:-1,
  });
  const wake=new THREE.Mesh(wakeGeometry,wakeMaterial);wake.name='Persistent curved V wake';
  wake.frustumCulled=false;wake.renderOrder=1;root.add(wake);
  if(options.scene)options.scene.add(root);

  let disposed=false,head=-1,count=0,accumulator=0,previousTime=0,previousX=0,previousZ=0,initialized=false;
  const stats=Object.freeze({drawCalls:2,surfaceVertices:geometry.attributes.position.count,
    surfaceTriangles:geometry.index.count/3,wakeVertices:wakePositions.length/3,
    wakeTriangles:wakeIndices.length/3,wakeCapacity:capacity,textureBytes:0});

  function reset() {
    if(disposed)return;
    head=-1;count=0;accumulator=0;initialized=false;
    wakeData.fill(0);wakeAttribute.needsUpdate=true;wake.visible=false;
  }
  function setEnabled(enabled) {if(!disposed)root.visible=Boolean(enabled);}
  function sampleHeight(x,z,time=uniforms.uTime.value) {
    x=finite(x);z=finite(z);time=finite(time);
    const dx=x-uniforms.uAnchor.value.x,dz=z-uniforms.uAnchor.value.y;
    const distance=Math.hypot(dx,dz);
    const near=1-smoothstep(55,150,distance),far=1-smoothstep(140,440,distance);
    return waterLevel+(.180*Math.sin(x*.115+z*.080-time*.83)
      +.130*Math.sin(-x*.095+z*.220-time*1.08)
      +.075*Math.sin(x*.390+z*.180-time*1.48)*near
      +.035*Math.sin(-x*.610+z*.450-time*1.92)*near
      +.015*Math.sin(x*.840+z*.920-time*2.30)*near)*far;
  }
  function update(dt,time,shipState,active=true) {
    if(disposed)return;
    dt=clamp(finite(dt),0,.1);time=finite(time,previousTime+dt);
    const x=finite(shipState?.x),z=finite(shipState?.z),heading=finite(shipState?.heading);
    const speed=active?clamp(finite(shipState?.speed),-30,30):0;
    if(initialized && (time<previousTime || Math.hypot(x-previousX,z-previousZ)>40))reset();
    uniforms.uTime.value=time;uniforms.uShip.value.set(x,z,heading,speed);
    uniforms.uAnchor.value.set(x,z);
    // Only translation changes. World-space phases keep wave motion coherent.
    mesh.position.set(x,0,z);
    const sine=Math.sin(heading),cosine=Math.cos(heading);
    const sternX=x+sine*4.35,sternZ=z+cosine*4.35;
    accumulator+=dt;
    if(Math.abs(speed)>.5 && (head<0 || accumulator>=.085)) {
      head=(head+1)%capacity;count=Math.min(count+1,capacity-1);accumulator=0;
      hx[head]=sternX;hz[head]=sternZ;hh[head]=heading;hb[head]=time;hs[head]=Math.abs(speed);
    }
    let visible=false;
    // Three strips: two expanding Kelvin arms and an aerated propeller trail.
    for(let i=0;i<capacity;i++) {
      const valid=i===0?count>0:i<=count;
      const index=(head-Math.min(i,count)+1+capacity)%capacity;
      const age=i===0?0:Math.max(0,time-hb[index]);
      const birth=i===0?time:hb[index];
      const px=i===0?sternX:hx[index],pz=i===0?sternZ:hz[index];
      const angle=i===0?heading:hh[index];
      const velocity=i===0?Math.abs(speed):hs[index];
      const rightX=Math.cos(angle),rightZ=-Math.sin(angle);
      const fade=valid ? Math.pow(Math.max(0,1-age/OCEAN_LIMITS.wakeLifetime),1.5) : 0;
      const strength=fade*smoothstep(.5,7,velocity);
      if(strength>.02)visible=true;
      for(let strip=0;strip<3;strip++) {
        const side=strip===0?-1:strip===1?1:0;
        const spread=side*(1.65+age*(.75+velocity*.105));
        const width=side===0?1.10+age*.28:.40+age*.20;
        for(let edge=0;edge<2;edge++) {
          const vertex=strip*capacity*2+i*2+edge,p=vertex*3,a=vertex*4;
          const offset=spread+(edge*2-1)*width;
          wakePositions[p]=px+rightX*offset;wakePositions[p+1]=waterLevel;
          wakePositions[p+2]=pz+rightZ*offset;
          wakeData[a]=edge;wakeData[a+1]=birth;
          wakeData[a+2]=strength*(side===0?.54:.72);wakeData[a+3]=strip;
        }
      }
    }
    positionAttribute.needsUpdate=true;wakeAttribute.needsUpdate=true;wake.visible=visible;
    previousX=x;previousZ=z;previousTime=time;initialized=true;
  }
  function dispose() {
    if(disposed)return;disposed=true;
    root.removeFromParent();geometry.dispose();material.dispose();
    wakeGeometry.dispose();wakeMaterial.dispose();root.clear();
  }
  return {root,mesh,material,uniforms,wake,sunDirection,stats,update,setEnabled,reset,sampleHeight,dispose};
}
