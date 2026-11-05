import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from './dist/vendor/three.module.js';
import {createOcean,OCEAN_LIMITS} from './dist/ocean.js';

const scene=new THREE.Scene();
const ocean=createOcean(THREE,{scene});
assert.equal(scene.children.length,1);
assert.equal(ocean.root.children.length,2);
assert.equal(ocean.stats.drawCalls,2);
assert.equal(ocean.stats.textureBytes,0);
assert.ok(ocean.stats.surfaceVertices<30000);
assert.ok(ocean.stats.surfaceTriangles<80000);
assert.equal(ocean.stats.wakeCapacity,96);
assert.ok(Math.abs(ocean.sunDirection.length()-1)<1e-6);
assert.ok(ocean.sunDirection.x<0 && ocean.sunDirection.z<0 && ocean.sunDirection.y>0);

// Three r180 injects the tone-mapping and colorspace pars into ShaderMaterial.
// Including either a second time is a GLSL redefinition error, despite valid JS.
for(const material of [ocean.material,ocean.wake.material]) {
  assert.ok(material.toneMapped);
  assert.doesNotMatch(material.fragmentShader,/#include <(?:tonemapping|colorspace)_pars_fragment>/);
  assert.match(material.fragmentShader,/#include <tonemapping_fragment>/);
  assert.match(material.fragmentShader,/#include <colorspace_fragment>/);
  for(const shader of [material.vertexShader,material.fragmentShader]) {
    for(const match of shader.matchAll(/#include <(.*?)>/g))assert.equal(typeof THREE.ShaderChunk[match[1]],'string',match[1]);
    assert.doesNotMatch(shader,/texture2D|sampler2D|samplerCube|for\s*\(/,'no textures or dynamic GLSL loops');
  }
}
assert.equal(THREE.REVISION,'180');
const positions=ocean.mesh.geometry.attributes.position.array;
assert.ok(positions.every(Number.isFinite));
const count=ocean.mesh.geometry.attributes.position.count;
assert.ok(ocean.mesh.geometry.index.array.every(index=>index<count));
const size=OCEAN_LIMITS.highSegments+1;
const center=(Math.floor(size/2)*size+Math.floor(size/2))*3;
assert.ok(Math.abs(positions[center+3]-positions[center])<.6,'near hull tessellation');
assert.ok(positions[positions.length-1]>2000,'horizon coverage');

const geometry=ocean.mesh.geometry,material=ocean.material,wakeGeometry=ocean.wake.geometry;
const surfaceArray=geometry.attributes.position.array;
const wakePositions=wakeGeometry.attributes.position.array,wakeData=wakeGeometry.attributes.aWake.array;
const uniforms=ocean.uniforms,anchor=uniforms.uAnchor.value,shipUniform=uniforms.uShip.value;
const ship={x:0,z:0,heading:0,speed:12};
let min=Infinity,max=-Infinity;
for(let frame=0;frame<12000;frame++) {
  const time=frame/60;
  ship.heading=Math.sin(time*.15)*.35;
  ship.x=30*Math.sin(time*.09);ship.z=-12*time;
  ocean.update(1/60,time,ship);
  const height=ocean.sampleHeight(ship.x,ship.z,time);
  min=Math.min(min,height);max=Math.max(max,height);
  assert.ok(Number.isFinite(height));
  assert.ok(height<=OCEAN_LIMITS.waterLevel+OCEAN_LIMITS.maxWaveAmplitude+1e-7);
  assert.ok(height>=OCEAN_LIMITS.waterLevel-OCEAN_LIMITS.maxWaveAmplitude-1e-7);
}
assert.ok(max<.15,'original hazard overlays stay above ocean');
assert.ok(min<-.5 && max>-.2,'layered displacement is active');
assert.equal(ocean.mesh.geometry,geometry);assert.equal(ocean.material,material);
assert.equal(ocean.wake.geometry,wakeGeometry);assert.equal(geometry.attributes.position.array,surfaceArray);
assert.equal(wakeGeometry.attributes.position.array,wakePositions);
assert.equal(wakeGeometry.attributes.aWake.array,wakeData);
assert.equal(ocean.uniforms,uniforms);assert.equal(uniforms.uAnchor.value,anchor);assert.equal(uniforms.uShip.value,shipUniform);
assert.equal(ocean.root.children.length,2);
assert.ok(wakePositions.every(Number.isFinite));assert.ok(wakeData.every(Number.isFinite));
assert.ok(wakeData.some((value,index)=>index%4===2 && value>.1));
assert.equal(ocean.wake.visible,true);
assert.equal(ocean.mesh.position.z,ship.z);
assert.equal(ocean.sampleHeight(ship.x+1000,ship.z,200),OCEAN_LIMITS.waterLevel);

// Reset/teleport must not connect the old route to the new one.
ocean.reset();assert.equal(ocean.wake.visible,false);
assert.ok(wakeData.every(value=>value===0));
ship.x=100;ship.z=-1800;ship.heading=.6;
ocean.update(.016,201,ship);
assert.ok(wakePositions.every(Number.isFinite));
for(let i=0;i<wakePositions.length;i+=3)assert.ok(Math.hypot(wakePositions[i]-ship.x,wakePositions[i+2]-ship.z)<10,'unused vertices stay at the tail, never streak to origin');
ship.x=-20;ship.z=0;ocean.update(.016,202,ship);
for(let i=0;i<wakePositions.length;i+=3)assert.ok(Math.hypot(wakePositions[i]-ship.x,wakePositions[i+2]-ship.z)<10);
ship.speed=0;
for(let i=0;i<600;i++)ocean.update(1/60,203+i/60,ship);
assert.equal(ocean.wake.visible,false,'stationary foam expires');
ship.speed=12;
for(let i=0;i<600;i++)ocean.update(1/60,214+i/60,ship,false);
assert.equal(ocean.wake.visible,false,'pause/help must not emit from stale run.speed');
assert.equal(ocean.uniforms.uShip.value.w,0);
assert.ok(wakeData.every((value,index)=>index%4!==2 || value===0));
ocean.update(NaN,Infinity,{x:NaN,z:Infinity,speed:NaN,heading:NaN});
assert.ok(wakePositions.every(Number.isFinite));assert.ok(wakeData.every(Number.isFinite));
assert.ok(Number.isFinite(ocean.sampleHeight(NaN,NaN,NaN)));
ocean.setEnabled(false);assert.equal(ocean.root.visible,false);
ocean.setEnabled(true);assert.equal(ocean.root.visible,true);

let disposals=0;
for(const resource of [geometry,material,wakeGeometry,ocean.wake.material])resource.addEventListener('dispose',()=>disposals++);
ocean.dispose();ocean.dispose();assert.equal(disposals,4);assert.equal(scene.children.length,0);
ocean.update(.1,999,ship);ocean.reset();ocean.setEnabled(true);
assert.equal(ocean.root.children.length,0);
const mobile=createOcean(THREE,{quality:'mobile'});
assert.ok(mobile.stats.surfaceVertices<13000);assert.ok(mobile.stats.surfaceTriangles<26000);
mobile.dispose();

const source=fs.readFileSync(new URL('./dist/ocean.js',import.meta.url),'utf8');
assert.doesNotMatch(source,/\b(?:fetch|XMLHttpRequest|Image|TextureLoader)\s*\(/,'no external assets');
const updateBody=source.slice(source.indexOf('  function update('),source.indexOf('  function dispose('));
assert.doesNotMatch(updateBody,/\bnew\s|\.push\s*\(|\.slice\s*\(|\.map\s*\(/,'no per-frame object/array allocation');
console.log('PASS: Three r180 chunks, finite 25.9k/12.8k geometry, 2 draw calls, 200-second stable buffers, restrained waves, finite/reusable wake, teleport/replay/stop/toggle/disposal. CPU only; run browser WebGL QA separately.');
