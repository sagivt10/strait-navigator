import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from './dist/vendor/three.module.js';
import {GLTFLoader} from './dist/vendor/GLTFLoader.js';
import {CaptainAnimator} from './dist/captain-animation.js';
import {installCaptainModel,loadOptionalCaptain} from './dist/captain-model.js';
const source=await fs.readFile('dist/game.js','utf8');
const loadFunction=source.slice(source.indexOf('async function loadShipAssets(){'),source.indexOf('\nloadShipAssets();')).replace("if(typeof window==='undefined')return;",'');
const bytes=await fs.readFile('dist/captain-trump-v4.glb');
const parse=()=>new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
async function harness(mode){
  const start={disabled:false,firstChild:{textContent:''}},fallback={shown:false,classList:{remove(){fallback.shown=true}},querySelector:()=>({textContent:''})};
  const ship=new THREE.Group(),part=new THREE.Group();ship.add(part);
  const holder=new THREE.Group();holder.position.set(0,1.65,3);holder.scale.setScalar(.8);const arms=[new THREE.Group(),new THREE.Group()];holder.add(...arms);ship.add(holder);let animator=new CaptainAnimator({root:holder,captainArms:arms});let messages=[];
  const model=await parse();
  const loader=class {loadAsync(path){
    if(path.includes('ship-v3'))return mode==='ship-fail'?Promise.reject(new Error('ship failed')):Promise.resolve({scene:new THREE.Group()});
    if(mode==='captain-fail')return Promise.reject(new Error('captain failed'));
    if(mode==='captain-hang')return new Promise(()=>{});
    return Promise.resolve(mode==='captain-invalid'?{scene:new THREE.Group()}:model);
  }};
  const factory=new Function('deps',`const {$,GLTFLoader,ship,proceduralShipParts,loadOptionalCaptain,toast,attachCaptainModel}=deps;let exteriorModel=null,visualsReady=false,visualMode='A';${loadFunction};return{run:loadShipAssets,get ready(){return visualsReady}};`);
  const app=factory({$:id=>id==='start'?start:fallback,GLTFLoader:loader,ship,proceduralShipParts:[part],loadOptionalCaptain:l=>loadOptionalCaptain(l,8),toast:message=>messages.push(message),attachCaptainModel:scene=>{animator=installCaptainModel({holder,model:scene,previousAnimator:animator,arms})}});
  const pending=app.run();assert(start.disabled);assert.equal(app.ready,false);await pending;
  return{app,start,fallback,holder,animator,messages};
}
const originalWarn=console.warn,originalError=console.error;console.warn=console.error=()=>{};
try{
  let h=await harness('success');assert(h.app.ready&&!h.start.disabled);assert(h.holder.getObjectByName('Captain_Root'));assert(h.animator.articulated);assert.equal(h.messages.length,0);
  for(const mode of ['captain-fail','captain-hang','captain-invalid']){h=await harness(mode);assert(h.app.ready&&!h.start.disabled,mode);assert(!h.holder.getObjectByName('Captain_Root'));assert.equal(h.holder.children.length,2);assert.equal(h.messages.length,1);assert.equal(h.fallback.shown,false);}
  h=await harness('ship-fail');assert(!h.app.ready&&h.start.disabled&&h.fallback.shown);
}finally{console.warn=originalWarn;console.error=originalError;}
console.log('PASS: actual async loader flow enables game only after install; failed, invalid and timed-out optional captain keep playable fallback; primary ship failure is surfaced.');
