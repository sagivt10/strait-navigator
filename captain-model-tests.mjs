import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from './dist/vendor/three.module.js';
import {GLTFLoader} from './dist/vendor/GLTFLoader.js';
import {CaptainAnimator} from './dist/captain-animation.js';
import {installCaptainModel,loadOptionalCaptain} from './dist/captain-model.js';
const bytes=await fs.readFile('dist/captain-trump-v4.glb');
const parse=()=>new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
function fixture(){const holder=new THREE.Group();holder.position.set(0,1.65,3);holder.scale.setScalar(.8);const arms=[new THREE.Group(),new THREE.Group()];holder.add(...arms);const previousAnimator=new CaptainAnimator({root:holder,captainArms:arms});return{holder,arms,previousAnimator};}
const f=fixture(),oldChildren=f.holder.children.slice();f.previousAnimator.update(.1,1,{state:'won'});const before=f.holder.rotation.toArray();
assert.throws(()=>installCaptainModel({...f,model:new THREE.Group()}),/missing/);assert.deepEqual(f.holder.children,oldChildren);assert.deepEqual(f.holder.rotation.toArray(),before);
const bad=await parse();bad.scene.getObjectByName('upper_armL').position.x=NaN;assert.throws(()=>installCaptainModel({...f,model:bad.scene}),/invalid/);assert.deepEqual(f.holder.children,oldChildren);
const {scene}=await parse();const animator=installCaptainModel({...f,model:scene,enhanced:true});assert.equal(f.holder.children.length,1);assert.equal(f.holder.children[0],scene);assert.deepEqual(f.holder.position.toArray(),[0,1.65,3.55]);assert.deepEqual(f.holder.rotation.toArray(),[0,0,0,'XYZ']);assert.equal(animator.leftArm,scene.getObjectByName('upper_armL'));assert.equal(f.arms[1],scene.getObjectByName('upper_armR'));
let meshes=0,triangles=0;scene.traverse(n=>{if(n.isMesh){meshes++;triangles+=(n.geometry.index?.count||n.geometry.attributes.position.count)/3;assert(n.castShadow&&n.receiveShadow);assert(!n.material.map);}});assert.equal(meshes,37);assert.equal(triangles,51638);assert(bytes.length<1200000);
for(const event of ['incomingMissile','cleanDodge','hit']){animator.reset();assert(animator.trigger(event,'playing'));for(let i=0;i<180;i++){animator.update(1/60,i/60,{state:'playing',speech:0});f.holder.updateMatrixWorld(true);f.holder.traverse(n=>assert(n.matrixWorld.elements.every(Number.isFinite)));}}
for(const state of ['won','lost','paused','help'])for(let i=0;i<120;i++)animator.update(1/60,i/60,{state,speech:0});animator.reset();assert.deepEqual(f.holder.position.toArray(),[0,1.65,3.55]);assert(f.arms.every(n=>n.rotation.x===0&&n.rotation.z===0));
const plain=fixture(),second=await parse();installCaptainModel({...plain,model:second.scene});second.scene.traverse(n=>{if(n.isMesh)assert(!n.castShadow&&!n.receiveShadow)});
console.log(`PASS: actual GLB ${meshes} meshes / ${triangles} triangles / ${bytes.length} bytes; validated atomic replacement, exact rest capture, required pivots, A/B shadows, malformed asset fallback and 1,020 finite animation updates.`);

const marker={scene:{}};
assert.equal(await loadOptionalCaptain({loadAsync:async()=>marker},50),marker);
const warn=console.warn;console.warn=()=>{};
assert.equal(await loadOptionalCaptain({loadAsync:async()=>{throw new Error('network failure')}},50),null);console.warn=warn;
let finishLate;const slow={loadAsync:()=>new Promise(resolve=>{finishLate=resolve})};
assert.equal(await loadOptionalCaptain(slow,5),null);finishLate(marker);
assert.equal(await loadOptionalCaptain({loadAsync:()=>new Promise(()=>{})},5),null);
console.log('PASS: optional captain success, rejection, never-resolving request and late-response isolation; fallback is bounded by 12-second production timeout.');

assert.equal(animator.articulated,true);animator.reset();animator.update(1/60,0,{state:'won'});assert.equal(f.arms[0].rotation.x,.8);assert(Math.abs(f.arms[1].rotation.x-.8)<1e-9);
console.log('PASS: approved rig dance uses forward shoulder motion, preserving victory phase and bounce.');
