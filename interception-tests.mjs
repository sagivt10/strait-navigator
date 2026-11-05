import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';

const path=process.argv[2]||new URL('./dist/logic.js',import.meta.url).pathname;
const m=await import(pathToFileURL(path));
const baseline=await import('./test-fixtures/baseline-v9-logic.mjs');
const {DRONES,createRun,droneAt,stepRun,selectInterceptTarget,fireIntercept}=m;
const targetId=value=>typeof value==='number'?value:value?.index??value?.id??-1;
const target=r=>targetId(selectInterceptTarget(r));
let passed=0;
function check(name,fn){fn();passed++;console.log(`PASS: ${name}`);}
function isolatedRun(id=0,time=0){
  const r=createRun(),p=droneAt(DRONES[id],time);
  r.time=time;r.x=p.scanX;r.z=p.scanZ;r.missileCooldowns.fill(Infinity);
  return r;
}

check('API and pristine reset state',()=>{
  assert.equal(typeof selectInterceptTarget,'function');
  assert.equal(typeof fireIntercept,'function');
  const a=createRun(),b=createRun();
  assert.equal(a.interceptsLeft,1);assert.deepEqual(a.intercepted,[]);assert.equal(a.lastIntercept,null);
  a.intercepted.push(1);a.interceptsLeft=0;a.lastIntercept={id:1};
  assert.deepEqual(b.intercepted,[]);assert.equal(b.interceptsLeft,1);assert.equal(b.lastIntercept,null);
});

check('single introduction, repeated mid-route pairs and double-radius ending pair',()=>{
  assert.equal(DRONES.length,9);
  assert.deepEqual(DRONES.slice(0,2),baseline.DRONES.slice(0,2));
  assert(DRONES[2].pair&&DRONES[7].pair&&DRONES[3].pair&&DRONES[8].pair);
  for(const d of DRONES.slice(5,7)){assert.equal(d.radius,2*baseline.DRONES[5].radius);assert(d.z<-1500&&d.z>-1750);}
  for(let t=0;t<=36;t+=.25){
    const a=droneAt(DRONES[5],t),b=droneAt(DRONES[6],t);
    assert(Math.hypot(a.x-b.x,a.z-b.z)<60,'pair must stay close throughout its movement');
    assert(Math.hypot(a.scanX-b.scanX,a.scanZ-b.scanZ)<a.radius+b.radius,'scan disks overlap');
  }
});

check('no target does not consume charge or mutate interception state',()=>{
  const r=createRun();
  assert.equal(target(r),-1);fireIntercept(r);
  assert.equal(r.interceptsLeft,1);assert.deepEqual(r.intercepted,[]);assert.equal(r.lastIntercept,null);
});

check('range admits a nearby forward target and rejects a distant one',()=>{
  const r=createRun(),p=droneAt(DRONES[0],0);
  r.x=p.x;r.z=p.z+210;assert.equal(target(r),0);
  r.z=p.z+230;assert.equal(target(r),-1);fireIntercept(r);assert.equal(r.interceptsLeft,1);
});

check('exact 220-unit range includes altitude and rejects just outside',()=>{
  const r=createRun(),p=droneAt(DRONES[0],0),vertical=p.y-2.4;
  const horizontal=Math.sqrt(m.INTERCEPT_RANGE**2-vertical**2);
  r.x=p.x;r.z=p.z+horizontal-1e-6;assert.equal(target(r),0);
  r.z=p.z+horizontal+1e-6;assert.equal(target(r),-1);
  r.z=p.z+219.5;assert(Math.hypot(219.5,vertical)>220);assert.equal(target(r),-1);
});

check('forward hemisphere follows ship heading rather than course direction',()=>{
  const r=createRun(),p=droneAt(DRONES[0],0);
  r.x=p.x;r.z=p.z+100;r.heading=Math.PI;assert.equal(target(r),-1);
  r.z=p.z-100;assert.equal(target(r),0);
});

check('nearest eligible ending drone is selected',()=>{
  const r=createRun(),a=droneAt(DRONES[5],0),b=droneAt(DRONES[6],0);
  r.x=(a.x+b.x)/2;r.z=Math.max(a.z,b.z)+70;
  const distances=[a,b].map(p=>Math.hypot(r.x-p.x,r.z-p.z));
  assert.equal(target(r),distances[0]<=distances[1]?5:6);
  r.intercepted=[5];assert.equal(target(r),6);
});

check('inactive drone behind the ship cannot be intercepted',()=>{
  const r=createRun(),p=droneAt(DRONES[0],0);
  r.x=p.x;r.z=p.z-60;r.intercepted=DRONES.map((_,id)=>id).filter(id=>id!==0);
  assert.equal(target(r),-1);fireIntercept(r);assert.equal(r.interceptsLeft,1);
});

check('actively detecting drone remains eligible slightly behind the ship',()=>{
  const r=isolatedRun(),p=droneAt(DRONES[0],0);
  r.x=p.scanX;r.z=p.z-8;stepRun(r,{},0);
  assert.equal(r.activeDrone,0);assert.equal(r.detected,true);assert.equal(target(r),0);
});

check('one successful shot disables one drone and immediately clears its lock',()=>{
  const r=isolatedRun();stepRun(r,{},0);r.exposure=.8;r.lockStage='locked';
  assert.equal(r.activeDrone,0);fireIntercept(r);
  assert.equal(r.interceptsLeft,0);assert.deepEqual(r.intercepted,[0]);assert(r.lastIntercept);
  assert.equal(r.detected,false);assert.equal(r.activeDrone,-1);assert.equal(r.lockStage,'clear');
  const saved=structuredClone(r.lastIntercept);
  fireIntercept(r);fireIntercept(r);
  assert.equal(r.interceptsLeft,0);assert.deepEqual(r.intercepted,[0]);assert.deepEqual(r.lastIntercept,saved);
  assert.equal(target(r),-1);
});

check('disabled drone never detects or damages the ship in its moving scan',()=>{
  const r=isolatedRun();fireIntercept(r);
  for(let i=0;i<180;i++){
    const p=droneAt(DRONES[0],r.time+1/60);r.x=p.scanX;r.z=p.scanZ;
    stepRun(r,{},1/60);assert.equal(r.detected,false);assert.equal(r.activeDrone,-1);
  }
  assert.equal(r.health,2);assert.equal(r.hits,0);
});

check('overlapping surviving drone keeps detection after its partner is intercepted',()=>{
  const r=createRun(),a=droneAt(DRONES[5],0),b=droneAt(DRONES[6],0);
  r.x=(a.scanX+b.scanX)/2;r.z=(a.scanZ+b.scanZ)/2;r.missileCooldowns.fill(Infinity);
  stepRun(r,{},0);assert.equal(r.detected,true);
  const selected=target(r);assert([5,6].includes(selected));fireIntercept(r);
  assert.equal(r.intercepted.length,1);assert.equal(r.interceptsLeft,0);
  assert.equal(r.detected,true);assert([5,6].includes(r.activeDrone));assert.notEqual(r.activeDrone,selected);
});

check('non-playing states cannot spend a shot',()=>{
  for(const state of ['docking','won','lost','paused']){
    const r=isolatedRun();r.state=state;fireIntercept(r);
    assert.equal(r.interceptsLeft,1);assert.deepEqual(r.intercepted,[]);
  }
});

check('new voyage restores the shot and all drone detection',()=>{
  const used=isolatedRun();fireIntercept(used);
  const fresh=isolatedRun();stepRun(fresh,{},0);
  assert.equal(fresh.interceptsLeft,1);assert.deepEqual(fresh.intercepted,[]);assert.equal(fresh.lastIntercept,null);
  assert.equal(fresh.detected,true);assert.equal(fresh.activeDrone,0);
});

check('successful interception returns true and preserves its event snapshot',()=>{
  const r=isolatedRun();
  assert.equal(fireIntercept(r),true);
  assert.equal(fireIntercept(r),false);
  const event=structuredClone(r.lastIntercept);
  assert.equal(event.id,0);assert.equal(event.at,0);assert.equal(event.from.y,2.4);
  for(const key of ['x','y','z'])assert(Number.isFinite(event.target[key]));
  for(let i=0;i<60;i++)stepRun(r,{throttle:1},1/60);
  assert.deepEqual(r.lastIntercept,event);
});

console.log(`PASS: ${passed} independent interception and paired-drone checks.`);
