import assert from 'node:assert/strict';
import * as logic from './dist/logic.js';
const {BOOST_DURATION,COURSE_LENGTH,DOCK,DRONES,MAX_INTERCEPTS,MAX_SPEED,MAX_SUPPORT_EARNED,SUPPORT_DELAY,SUPPORT_DOCK_CUTOFF,SUPPORT_DROP_DISTANCE,SUPPORT_DROP_LIFETIME,SUPPORT_PASSES_REQUIRED,SUPPORT_PICKUP_RADIUS,channelAt,createRun,damage,droneAt,fireIntercept,stepRun}=logic;
let checks=0;
function check(name,fn){fn();checks++;console.log(`PASS: ${name}`);}
function advance(run,seconds,input={},dt=1/60){for(let n=0;n<Math.ceil(seconds/dt);n++)stepRun(run,input,dt);}
function cleanPass(run,id){run.x=channelAt(DRONES[id].z-32).center;run.z=DRONES[id].z-32;run.speed=0;stepRun(run,{},1/60);}
function earned(seed=0){const run=createRun({supportSeed:seed});cleanPass(run,0);cleanPass(run,1);return run;}
function deferred(seed=0){const run=createRun({supportSeed:seed});run.interceptsLeft=MAX_INTERCEPTS;run.boostUntil=100;run.shieldUntil=100;run.shieldCharges=2;cleanPass(run,0);cleanPass(run,1);return run;}
function dropReady(kind='boost'){
  const run=earned(kind==='boost'?0:1),target={...run.supportPending};assert.equal(target.kind,kind);
  // Keep the boat away from threats and the target during the supply descent.
  run.x=0;run.z=8;advance(run,SUPPORT_DELAY+.1);assert(run.supportDrop);return{run,target};
}
function collect(run){const drop=run.supportDrop;run.x=drop.x;run.z=drop.z;run.speed=0;stepRun(run,{},1/60);}

check('complete independent support state and no public choice/call API',()=>{
  assert.equal('requestSupport' in logic,false);
  const run=createRun({supportSeed:0}),other=createRun({supportSeed:0});
  for(const key of['supportCharges','supportEarned','supportProgress','supportDispatched','supportDelivered','supportCollected','supportIgnored','boostUntil'])assert.equal(run[key],0);
  for(const key of['supportPending','supportDrop','lastSupportDispatch','lastSupportDelivery','lastSupportPickup','lastSupportIgnored'])assert.equal(run[key],null);
  assert.equal(run.supportSeed,0);assert.equal(run.supportRandomState,0);assert.deepEqual(run,other);
  run.supportPassedDrones.push(4);assert.deepEqual(other.supportPassedDrones,[]);
  assert.equal(MAX_SUPPORT_EARNED,2);assert.equal(SUPPORT_PASSES_REQUIRED,2);assert.equal(MAX_INTERCEPTS,2);
});
check('fresh runs use new seeds while explicit seeds are deterministic unsigned values',()=>{
  const seeds=Array.from({length:32},()=>createRun().supportSeed);assert(new Set(seeds).size>1);
  for(const seed of seeds)assert(Number.isInteger(seed)&&seed>=0&&seed<=0xffffffff);
  assert.equal(createRun({supportSeed:-1}).supportSeed,0xffffffff);
  for(const seed of[0,1,5,8,0xffffffff])assert.deepEqual(earned(seed),earned(seed));
});
check('two distinct clean forward passages automatically dispatch a random reward',()=>{
  const run=createRun({supportSeed:0});cleanPass(run,0);
  assert.equal(run.supportProgress,1);assert.equal(run.supportCharges,0);assert.equal(run.supportDispatched,0);
  cleanPass(run,1);assert.equal(run.supportProgress,0);assert.equal(run.supportCharges,0);assert.equal(run.supportEarned,1);
  assert.equal(run.supportDispatched,1);assert.equal(run.supportPending.kind,'boost');
  const {deliverAt,...dispatch}=run.supportPending;assert.deepEqual(run.lastSupportDispatch,dispatch);assert.equal(deliverAt-dispatch.at,SUPPORT_DELAY);
});
check('revisiting, reverse motion and loiter cannot farm a passed drone',()=>{
  const run=createRun();cleanPass(run,0);
  for(let n=0;n<10;n++){run.z=DRONES[0].z+80;advance(run,.1,{throttle:-1});cleanPass(run,0);}
  assert.equal(run.supportProgress,1);assert.equal(run.supportDispatched,0);assert.deepEqual(run.supportPassedDrones,[0]);
});
check('escaping a cone without passage cannot earn support',()=>{
  const run=createRun();
  for(let n=0;n<27;n++){const p=droneAt(DRONES[0],run.time+1/60);run.x=p.scanX;run.z=p.scanZ;stepRun(run,{},1/60);}
  run.z=8;run.x=0;advance(run,1.4);assert.equal(run.droneDodges,1);assert.equal(run.supportProgress,0);
});
check('intercepted drones and damaged passes cannot earn support',()=>{
  const run=createRun();run.z=DRONES[0].z+60;run.x=channelAt(run.z).center;assert(fireIntercept(run));cleanPass(run,0);
  assert.equal(run.supportProgress,0);assert.equal(run.droneDodges,0);
  run.activeDrone=1;damage(run,'drone');cleanPass(run,1);assert.equal(run.supportProgress,0);
});
check('earned cap is two per voyage; a second earning queues behind the first drop',()=>{
  const run=earned();for(const id of[2,7,3,8,4])cleanPass(run,id);
  assert.equal(run.supportEarned,2);assert.equal(run.supportCharges,1);assert.equal(run.supportProgress,0);assert.equal(run.supportDispatched,1);
  const banked=deferred();for(const id of[2,7,3,8,4])cleanPass(banked,id);
  assert.equal(banked.supportEarned,2);assert.equal(banked.supportCharges,2);assert.equal(banked.supportDispatched,0);
});
check('dispatch target is fixed, 70m ahead, off-axis and safely inside the future channel',()=>{
  const run=earned(),p=run.supportPending,ch=channelAt(p.z);
  assert.equal(p.z,run.z-SUPPORT_DROP_DISTANCE);assert(Math.abs(p.x-run.x)>10);
  assert(Math.abs(p.x-ch.center)<=ch.halfWidth-12);assert.equal(p.deliverAt-p.at,SUPPORT_DELAY);
  const fixed={x:p.x,z:p.z};run.x+=20;run.z-=20;advance(run,1);assert.equal(p.x,fixed.x);assert.equal(p.z,fixed.z);
});
check('delivery occurs only after three game seconds and grants no remote reward',()=>{
  const run=earned(1);run.x=0;run.z=8;
  advance(run,2.9);assert.equal(run.supportDelivered,0);assert.equal(run.supportDrop,null);assert.equal(run.interceptsLeft,1);
  advance(run,.2);assert.equal(run.supportDelivered,1);assert.equal(run.supportCollected,0);assert.equal(run.interceptsLeft,1);
  assert.equal(run.supportDrop.radius,SUPPORT_PICKUP_RADIUS);assert.equal(run.supportDrop.expiresAt-run.supportDrop.spawnedAt,SUPPORT_DROP_LIFETIME);
});
check('pending or floating supply prevents repeated dispatches and rerolls',()=>{
  const run=earned(1);cleanPass(run,2);cleanPass(run,7);run.x=0;run.z=8;
  const state=run.supportRandomState,dispatch={...run.lastSupportDispatch};advance(run,10);
  assert.equal(run.supportDispatched,1);assert.equal(run.supportCharges,1);assert.equal(run.supportRandomState,state);
  assert.deepEqual(run.lastSupportDispatch,dispatch);assert.equal(run.supportDrop.id,1);
});
check('floating crate remains fixed and physical proximity is necessary for pickup',()=>{
  const {run,target}=dropReady('intercept');advance(run,2,{throttle:1,steer:.2});
  assert.equal(run.supportDrop.x,target.x);assert.equal(run.supportDrop.z,target.z);assert.equal(run.supportCollected,0);
  run.x=target.x+SUPPORT_PICKUP_RADIUS+1;run.z=target.z;run.speed=0;stepRun(run,{},1/60);assert(run.supportDrop);
  collect(run);assert.equal(run.supportDrop,null);assert.equal(run.supportCollected,1);assert.equal(run.interceptsLeft,2);assert.equal(run.lastSupportPickup.id,target.id);
  advance(run,.2);assert.equal(run.supportCollected,1);assert.equal(run.interceptsLeft,2);
});
check('boost activates on pickup, not dispatch or landing',()=>{
  const {run}=dropReady('boost');assert.equal(run.boostUntil,0);collect(run);
  assert.equal(run.boostUntil-run.lastSupportPickup.at,BOOST_DURATION);assert.equal(run.supportCollected,1);
});
check('boost accelerates smoothly to double speed and preserves braking and steering',()=>{
  const {run}=dropReady('boost');collect(run);run.x=0;run.z=8;run.speed=MAX_SPEED;
  stepRun(run,{throttle:1},1/60);assert(run.speed>MAX_SPEED&&run.speed<MAX_SPEED+.1);
  advance(run,4,{throttle:1});assert.equal(run.speed,MAX_SPEED*2);
  const speed=run.speed;advance(run,1,{throttle:-1,steer:1});assert(run.speed<speed-6.9);assert.notEqual(run.heading,0);
});
check('boost ends after eight game seconds and speed returns to the ordinary target',()=>{
  const {run}=dropReady('boost');collect(run);run.x=0;run.z=8;run.speed=MAX_SPEED;
  for(let n=0;n<12*60;n++){run.x=0;run.z=8;stepRun(run,{throttle:1},1/60);}
  assert(run.time>run.boostUntil);assert.equal(run.speed,MAX_SPEED);
});
check('at full health with an active shield, full ammo allows only boost and active boost allows only ammo',()=>{
  for(const seed of[0,1,5,8]){
    const full=createRun({supportSeed:seed});full.interceptsLeft=2;full.shieldUntil=100;full.shieldCharges=2;cleanPass(full,0);cleanPass(full,1);assert.equal(full.supportPending.kind,'boost');
    const boosted=createRun({supportSeed:seed});boosted.boostUntil=100;boosted.shieldUntil=100;boosted.shieldCharges=2;cleanPass(boosted,0);cleanPass(boosted,1);assert.equal(boosted.supportPending.kind,'intercept');
  }
});
check('all unavailable defer without consuming earnings or advancing random state',()=>{
  const run=deferred(5),rng=run.supportRandomState;run.x=0;run.z=8;advance(run,10);
  assert.equal(run.supportEarned,1);assert.equal(run.supportCharges,1);assert.equal(run.supportDispatched,0);assert.equal(run.supportPending,null);assert.equal(run.supportRandomState,rng);
  run.boostUntil=run.time;stepRun(run,{},1/60);assert.equal(run.supportPending.kind,'boost');assert.equal(run.supportCharges,0);assert.notEqual(run.supportRandomState,rng);
});
check('ammo spent while a boost is active releases a deferred reward as ammo',()=>{
  const run=deferred(0);run.x=channelAt(-600).center;run.z=-600;assert(fireIntercept(run));stepRun(run,{},1/60);
  assert.equal(run.supportPending.kind,'intercept');assert.equal(run.supportDispatched,1);assert.equal(run.supportCharges,0);
});
check('an ineligible crate cannot overflow inventory or refresh an active boost',()=>{
  for(const kind of['boost','intercept']){
    const {run,target}=dropReady(kind);if(kind==='intercept')run.interceptsLeft=2;else run.boostUntil=run.time+10;
    const until=run.boostUntil;collect(run);assert.equal(run.supportCollected,0);assert.equal(run.supportDrop.id,target.id);assert.equal(run.boostUntil,until);assert(run.interceptsLeft<=MAX_INTERCEPTS);
  }
});
check('ignored crate expires without reward; queued second supply dispatches once after expiry',()=>{
  const run=earned(5);cleanPass(run,2);cleanPass(run,7);run.x=0;run.z=8;
  const first={...run.supportPending};advance(run,SUPPORT_DELAY+SUPPORT_DROP_LIFETIME+.1);
  assert.equal(run.supportIgnored,1);assert.equal(run.lastSupportIgnored.id,first.id);assert.equal(run.supportCollected,0);assert.equal(run.interceptsLeft,1);
  assert.equal(run.supportDispatched,2);assert.equal(run.supportPending.id,2);assert.equal(run.supportPending.kind,'shield');assert.equal(run.supportCharges,0);
  assert(run.lastSupportDispatch.at>=first.deliverAt+SUPPORT_DROP_LIFETIME);assert.equal(run.lastSupportIgnored.at,first.deliverAt+SUPPORT_DROP_LIFETIME);
  advance(run,SUPPORT_DELAY+SUPPORT_DROP_LIFETIME+.1);assert.equal(run.supportIgnored,2);assert.equal(run.supportDispatched,2);assert.equal(run.supportDrop,null);assert.equal(run.supportPending,null);
});
check('second automatic dispatch alternates the side with a new stable ID',()=>{
  const {run}=dropReady('intercept');cleanPass(run,2);cleanPass(run,7);const target={...run.supportDrop};collect(run);
  assert.equal(run.supportPending.id,2);assert.equal(run.supportPending.kind,'boost');assert(run.supportPending.x<target.x);
});
check('pause and zero-time steps freeze dispatch, descent, expiry, boost and RNG',()=>{
  for(const stage of['deferred','pending','crate','boost']){
    const run=stage==='deferred'?deferred():stage==='pending'?earned():dropReady().run;
    if(stage==='boost')collect(run);
    if(stage==='deferred')run.boostUntil=0;
    const before=JSON.stringify(run);for(let n=0;n<300;n++)stepRun(run,{throttle:1},0);assert.equal(JSON.stringify(run),before);
    run.state='paused';const paused=JSON.stringify(run);advance(run,10);assert.equal(JSON.stringify(run),paused);
  }
});
check('new dispatches are blocked within the final 180m and remain blocked after reversing',()=>{
  for(const historical of[false,true]){
    const run=deferred();run.boostUntil=0;run.z=-COURSE_LENGTH+SUPPORT_DOCK_CUTOFF;run.x=channelAt(run.z).center;
    if(historical){run.distance=COURSE_LENGTH-SUPPORT_DOCK_CUTOFF;run.z=-1500;run.x=channelAt(run.z).center;}
    const rng=run.supportRandomState;stepRun(run,{},1/60);
    assert.equal(run.supportDispatched,0);assert.equal(run.supportCharges,1);assert.equal(run.supportRandomState,rng);
  }
});
check('a drop just before the cutoff remains in navigable water away from the dock',()=>{
  const run=deferred();run.boostUntil=0;run.z=-COURSE_LENGTH+SUPPORT_DOCK_CUTOFF+.1;run.x=channelAt(run.z).center;
  stepRun(run,{},1/60);assert(run.supportPending);assert(run.supportPending.z>DOCK.z+100);
  const ch=channelAt(run.supportPending.z);assert(Math.abs(run.supportPending.x-ch.center)<=ch.halfWidth-12);
});
check('loss cancels incoming and floating supply; no later reward or RNG advance appears',()=>{
  for(const landed of[false,true]){
    const run=landed?dropReady().run:earned();run.health=1;run.invulnerable=0;damage(run,'missile');
    assert.equal(run.state,'lost');assert.equal(run.supportPending,null);assert.equal(run.supportDrop,null);assert.equal(run.boostUntil,0);
    const before=JSON.stringify(run);advance(run,10);assert.equal(JSON.stringify(run),before);
  }
});
check('docking cancels crates, incoming drops and boost; win never dispatches or delivers',()=>{
  for(const landed of[false,true]){
    const run=landed?dropReady().run:earned();run.boostUntil=100;run.z=-COURSE_LENGTH+.1;run.x=DOCK.x;run.speed=2;stepRun(run,{throttle:.15},1/60);
    assert.equal(run.state,'docking');assert.equal(run.supportPending,null);assert.equal(run.supportDrop,null);assert.equal(run.boostUntil,0);
    const dispatched=run.supportDispatched,delivered=run.supportDelivered,rng=run.supportRandomState;advance(run,4);assert.equal(run.state,'won');assert.equal(run.supportDispatched,dispatched);assert.equal(run.supportDelivered,delivered);assert.equal(run.supportRandomState,rng);
  }
});
check('restarting clears earnings, all events and temporary effects without affecting prior runs',()=>{
  const {run}=dropReady();collect(run);const fresh=createRun({supportSeed:0});
  assert.equal(fresh.supportCharges,0);assert.equal(fresh.supportEarned,0);assert.equal(fresh.supportDispatched,0);assert.equal(fresh.supportDelivered,0);assert.equal(fresh.supportCollected,0);assert.equal(fresh.supportIgnored,0);assert.equal(fresh.boostUntil,0);assert.equal(fresh.interceptsLeft,1);assert.equal(fresh.supportRandomState,0);assert.equal(run.supportCollected,1);
});
check('serialized run resumes the same pending reward and future random choices',()=>{
  const run=earned(8);cleanPass(run,2);cleanPass(run,7);run.x=0;run.z=8;const restored=JSON.parse(JSON.stringify(run));
  advance(run,100);advance(restored,100);assert.deepEqual(restored,run);assert.equal(run.supportDispatched,2);assert.equal(run.lastSupportDispatch.kind,'intercept');
});
check('all nine random sequences are reachable and stable across 20/30/60fps',()=>{
  const expected=new Map([[0,['boost','boost']],[1,['intercept','boost']],[2,['shield','boost']],[5,['shield','shield']],[8,['boost','intercept']],[9,['boost','shield']],[10,['intercept','shield']],[11,['intercept','intercept']],[20,['shield','intercept']]]);
  for(const [seed,kinds] of expected)for(const dt of[1/20,1/30,1/60]){
    const run=createRun({supportSeed:seed});run.supportCharges=2;run.supportEarned=2;stepRun(run,{},dt);const first=run.lastSupportDispatch.kind;
    advance(run,SUPPORT_DELAY+SUPPORT_DROP_LIFETIME+.2,{},dt);
    assert.deepEqual([first,run.lastSupportDispatch.kind],kinds);assert.equal(run.supportDispatched,2);assert.equal(run.supportIgnored,1);
    assert.equal(run.supportRandomState,(seed+Math.imul(2,0x6D2B79F5))>>>0);
  }
});
check('full-hull random distribution is balanced across boost, ammo and shield',()=>{
  const firstCounts={boost:0,intercept:0,shield:0},sequences=new Map();
  for(let seed=0;seed<4096;seed++){
    const run=createRun({supportSeed:seed});run.supportCharges=2;stepRun(run,{},1/60);const first=run.lastSupportDispatch.kind;
    firstCounts[first]++;
    // Advance to expiry through the public clock rather than choose the reward.
    run.time=run.supportPending.deliverAt+SUPPORT_DROP_LIFETIME;stepRun(run,{},1/60);
    const key=first+','+run.lastSupportDispatch.kind;sequences.set(key,(sequences.get(key)||0)+1);
    assert.equal(run.supportDispatched,2);assert.equal(run.supportIgnored,1);
  }
  for(const count of Object.values(firstCounts))assert(count>4096*.30&&count<4096*.37);assert.equal(sequences.size,9);
  for(const count of sequences.values())assert(count>4096*.09&&count<4096*.14);
});
console.log(`${checks} automatic air-support checks passed.`);
