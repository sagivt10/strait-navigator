import assert from 'node:assert/strict';
import {
  MAX_HEALTH, MAX_INTERCEPTS, SUPPORT_DELAY, SUPPORT_DROP_LIFETIME,
  SUPPORT_PICKUP_RADIUS, COURSE_LENGTH, DOCK, createRun, damage, stepRun,
  selectInterceptTarget, fireIntercept,
} from './dist/logic.js';
import {scoreRun} from './dist/scoring.js';
import {pilot} from './harder-route-simulate.mjs';
let checks=0;
function check(name,fn){fn();checks++;console.log(`PASS: ${name}`);}
function advance(run,seconds,dt=1/60){for(let n=0;n<Math.ceil(seconds/dt);n++)stepRun(run,{},dt);}
function earnedLife(){
  const run=createRun({supportSeed:2});
  damage(run,'missile');run.supportEarned=1;run.supportCharges=1;stepRun(run,{},1/60);
  assert.equal(run.supportPending.kind,'health');return run;
}
function landedLife(){const run=earnedLife();advance(run,SUPPORT_DELAY+.1);assert(run.supportDrop);return run;}
function collect(run){const d=run.supportDrop;run.x=d.x;run.z=d.z;run.speed=0;stepRun(run,{},1/60);}

check('new and restarted voyages have exactly two lives and a two-life maximum',()=>{
  assert.equal(MAX_HEALTH,2);const run=createRun({supportSeed:2});assert.equal(run.health,MAX_HEALTH);
  damage(run,'missile');assert.equal(run.health,1);assert.equal(run.state,'playing');
  run.invulnerable=0;damage(run,'missile');assert.equal(run.state,'lost');assert.equal(run.health,0);
  run.invulnerable=0;assert.equal(damage(run,'missile'),false);assert.equal(run.health,0);
  const fresh=createRun({supportSeed:2});assert.equal(fresh.health,2);assert.equal(fresh.hits,0);assert.equal(fresh.supportDrop,null);
});
check('full health excludes life rewards across 4096 random seeds',()=>{
  const seen=new Set();for(let seed=0;seed<4096;seed++){
    const run=createRun({supportSeed:seed});run.supportCharges=1;stepRun(run,{},1/60);
    seen.add(run.supportPending.kind);assert.equal(run.health,2);
  }
  assert.deepEqual([...seen].sort(),['boost','intercept','shield']);
});
check('all four useful rewards are random and balanced while damaged',()=>{
  const counts={boost:0,intercept:0,health:0,shield:0};for(let seed=0;seed<4096;seed++){
    const run=createRun({supportSeed:seed});damage(run,'missile');run.supportCharges=1;stepRun(run,{},1/60);
    counts[run.supportPending.kind]++;assert.equal(run.health,1,'dispatch does not heal remotely');
  }
  for(const count of Object.values(counts))assert(count>4096*.22&&count<4096*.28,JSON.stringify(counts));
});
check('damage releases a deferred drop as life when ammo, boost and shield are full',()=>{
  const run=createRun({supportSeed:9});run.supportCharges=1;run.interceptsLeft=MAX_INTERCEPTS;run.boostUntil=100;run.shieldUntil=100;run.shieldCharges=2;
  stepRun(run,{},1/60);assert.equal(run.supportPending,null);assert.equal(run.supportRandomState,9);
  damage(run,'missile');stepRun(run,{},1/60);assert.equal(run.supportPending.kind,'health');assert.equal(run.supportCharges,0);
});
check('life dispatch and landing do not heal before a physical pickup',()=>{
  const run=earnedLife(),fixed={...run.supportPending};advance(run,2.9);assert.equal(run.supportDrop,null);assert.equal(run.health,1);
  advance(run,.2);assert.equal(run.health,1);assert.equal(run.supportCollected,0);assert.equal(run.supportDelivered,1);
  assert.equal(run.supportDrop.x,fixed.x);assert.equal(run.supportDrop.z,fixed.z);
  run.x=fixed.x+SUPPORT_PICKUP_RADIUS+1;run.z=fixed.z;stepRun(run,{},1/60);assert(run.supportDrop);assert.equal(run.health,1);
  collect(run);assert.equal(run.health,2);assert.equal(run.supportDrop,null);assert.equal(run.lastSupportPickup.kind,'health');
  assert.equal(run.supportCollected,1);assert.equal(run.hits,1,'healing never erases previous hits');
  assert.equal(run.interceptsLeft,1);assert.equal(run.boostUntil,0);advance(run,.3);assert.equal(run.health,2);assert.equal(run.supportCollected,1);
});
check('a now-full life crate remains collectible later without overflowing or wasting it',()=>{
  const run=landedLife();run.health=MAX_HEALTH;const id=run.supportDrop.id;collect(run);
  assert.equal(run.health,2);assert.equal(run.supportCollected,0);assert.equal(run.supportDrop.id,id);
  run.invulnerable=0;damage(run,'missile');assert.equal(run.health,1);collect(run);
  assert.equal(run.health,2);assert.equal(run.supportCollected,1);assert.equal(run.supportDrop,null);
});
check('an ignored life crate expires without granting a reward or removing damage',()=>{
  const run=landedLife(),expiry=run.supportDrop.expiresAt;advance(run,SUPPORT_DROP_LIFETIME);
  assert(run.time>=expiry);assert.equal(run.health,1);assert.equal(run.hits,1);assert.equal(run.supportCollected,0);
  assert.equal(run.supportIgnored,1);assert.equal(run.lastSupportIgnored.kind,'health');assert.equal(run.supportDrop,null);
});
check('a full-hull crate can expire without changing hull or counting as collected',()=>{
  const run=landedLife();run.health=2;collect(run);advance(run,SUPPORT_DROP_LIFETIME);
  assert.equal(run.health,2);assert.equal(run.supportCollected,0);assert.equal(run.supportIgnored,1);
});
check('life reward pause and zero-time steps freeze delivery, pickup, expiry and random state',()=>{
  for(const landed of[false,true]){
    const run=landed?landedLife():earnedLife();const before=JSON.stringify(run);
    for(let n=0;n<100;n++)stepRun(run,{},0);assert.equal(JSON.stringify(run),before);
    run.state='paused';const frozen=JSON.stringify(run);advance(run,60);assert.equal(JSON.stringify(run),frozen);
  }
});
check('life collection cannot resurrect a fatal hit on the same frame',()=>{
  const run=landedLife(),d=run.supportDrop;run.x=d.x;run.z=d.z;run.invulnerable=0;
  run.missiles.push({id:1,start:run.time-3.2,impactAt:run.time,x:run.x,z:run.z,radius:10,resolved:false});
  stepRun(run,{},1/60);assert.equal(run.state,'lost');assert.equal(run.health,0);assert.equal(run.supportCollected,0);
  assert.equal(run.supportDrop,null);advance(run,10);assert.equal(run.health,0);
});
check('loss clears both descending and floating life crates',()=>{
  for(const landed of[false,true]){
    const run=landed?landedLife():earnedLife();run.invulnerable=0;damage(run,'missile');
    assert.equal(run.state,'lost');assert.equal(run.supportPending,null);assert.equal(run.supportDrop,null);
    const before=JSON.stringify(run);advance(run,60);assert.equal(JSON.stringify(run),before);
  }
});
check('docking clears life supplies and cannot heal remotely at the finish',()=>{
  for(const landed of[false,true]){
    const run=landed?landedLife():earnedLife();run.x=DOCK.x;run.z=-COURSE_LENGTH+.1;run.speed=2;
    stepRun(run,{throttle:.15},1/60);assert.equal(run.state,'docking');assert.equal(run.supportPending,null);assert.equal(run.supportDrop,null);
    advance(run,4);assert.equal(run.state,'won');assert.equal(run.health,1);assert.equal(run.supportCollected,0);
  }
});
check('life pickup adds hull and collection points while preserving the damage penalty',()=>{
  const run=landedLife(),before=scoreRun(run);collect(run);const after=scoreRun(run);
  assert.equal(after.rows.find(r=>r.id==='hull').points-before.rows.find(r=>r.id==='hull').points,300);
  assert.equal(after.rows.find(r=>r.id==='hits').points,before.rows.find(r=>r.id==='hits').points);
  assert.equal(after.rows.find(r=>r.id==='hits').points,-400);
  assert.equal(after.rows.find(r=>r.id==='supplies').points-before.rows.find(r=>r.id==='supplies').points,250);
});
check('health supplies survive serialization without rerolls or duplicate pickup',()=>{
  const run=earnedLife(),restored=JSON.parse(JSON.stringify(run));advance(run,3.1);advance(restored,3.1);
  collect(run);collect(restored);assert.deepEqual(restored,run);advance(restored,.1);assert.equal(restored.supportCollected,1);assert.equal(restored.health,2);
});
for(const dt of[1/20,1/30,1/60])check(`${Math.round(1/dt)}fps complete route recovers an early hit through a naturally earned life crate`,()=>{
  const run=createRun({supportSeed:2});damage(run,'missile');const pickups=[];let nearBankFrames=0;
  for(let frame=0;frame<320/dt&&['playing','docking'].includes(run.state);frame++){
    if(run.z<-1470&&[5,6].includes(selectInterceptTarget(run)))fireIntercept(run);
    const count=run.supportCollected;stepRun(run,pilot(run),dt);
    if(run.supportCollected>count)pickups.push({...run.lastSupportPickup});
    if(run.nearBank)nearBankFrames++;assert(run.health<=MAX_HEALTH);
  }
  assert.equal(run.state,'won');assert.equal(run.health,1);assert.equal(run.hits,2);assert.equal(nearBankFrames,0);
  assert.equal(run.supportEarned,2);assert.deepEqual(pickups.map(p=>p.kind),['health','boost']);
  assert.equal(run.x,DOCK.x);assert.equal(run.z,DOCK.z);
});
console.log(`${checks} two-life and health-supply checks passed.`);
