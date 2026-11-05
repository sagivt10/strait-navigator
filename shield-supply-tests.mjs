import assert from 'node:assert/strict';
import {
  SHIELD_DURATION,SHIELD_CHARGES,MAX_HEALTH,MAX_INTERCEPTS,MAX_SUPPORT_EARNED,
  SUPPORT_DELAY,SUPPORT_DROP_LIFETIME,SUPPORT_PICKUP_RADIUS,COURSE_LENGTH,DOCK,
  DRONES,createRun,damage,droneAt,stepRun,selectInterceptTarget,fireIntercept,
} from './dist/logic.js';
import {pilot,simulateHarderRoute} from './harder-route-simulate.mjs';
import {scoreRun} from './dist/scoring.js';
let checks=0;
function check(name,fn){fn();checks++;console.log(`PASS: ${name}`);}
function advance(run,seconds,dt=1/60){for(let n=0;n<Math.ceil(seconds/dt);n++)stepRun(run,{},dt);}
function earned(){const run=createRun({supportSeed:2});run.supportEarned=1;run.supportCharges=1;stepRun(run,{},1/60);assert.equal(run.supportPending.kind,'shield');return run;}
function landed(){const run=earned();advance(run,SUPPORT_DELAY+.1);assert(run.supportDrop);return run;}
function collect(run){const d=run.supportDrop;run.x=d.x;run.z=d.z;run.speed=0;stepRun(run,{},1/60);}
function active(){const run=landed();collect(run);run.x=0;run.z=8;return run;}
function missile(run,{id=run.missiles.length+1,impactAt=run.time+.5,x=run.x,z=run.z,resolved=false}={}){
  const m={id,start:impactAt-3.2,impactAt,x,z,fromX:90,fromZ:-20,radius:10,resolved};run.missiles.push(m);return m;
}
check('shield starts empty and physical collection grants exactly two charges for fifteen seconds',()=>{
  const fresh=createRun();assert.equal(SHIELD_DURATION,15);assert.equal(SHIELD_CHARGES,2);assert.equal(MAX_HEALTH,2);assert.equal(MAX_SUPPORT_EARNED,2);
  assert.equal(fresh.shieldUntil,0);assert.equal(fresh.shieldCharges,0);assert.equal(fresh.missilesIntercepted,0);assert.equal(fresh.lastShieldIntercept,null);
  const run=earned();assert.equal(run.shieldCharges,0);advance(run,SUPPORT_DELAY+.1);assert.equal(run.shieldCharges,0);
  const d={...run.supportDrop};run.x=d.x+SUPPORT_PICKUP_RADIUS+1;run.z=d.z;stepRun(run,{},1/60);assert.equal(run.supportCollected,0);
  collect(run);assert(Math.abs(run.shieldUntil-run.lastSupportPickup.at-15)<1e-9);assert.equal(run.shieldCharges,2);assert.equal(run.health,2);assert.equal(run.interceptsLeft,1);assert.equal(run.boostUntil,0);assert.equal(run.supportCollected,1);assert.equal(run.supportDrop,null);
});
check('shield dispatch is useful at full health even with full ammo and active boost',()=>{
  for(let seed=0;seed<100;seed++){
    const run=createRun({supportSeed:seed});run.interceptsLeft=MAX_INTERCEPTS;run.boostUntil=100;run.supportCharges=1;
    stepRun(run,{},1/60);assert.equal(run.supportPending.kind,'shield');assert.equal(run.health,MAX_HEALTH);
  }
});
check('active shields are excluded from dispatch without rerolling a deferred reward',()=>{
  const run=active();run.boostUntil=100;run.interceptsLeft=MAX_INTERCEPTS;run.supportCharges=1;const rng=run.supportRandomState;
  stepRun(run,{},1/60);assert.equal(run.supportPending,null);assert.equal(run.supportRandomState,rng);assert.equal(run.supportCharges,1);
  run.time=run.shieldUntil;stepRun(run,{},1/60);assert.equal(run.supportPending.kind,'shield');assert.equal(run.shieldCharges,0);assert.equal(run.shieldUntil,0);
});
check('collecting a second shield cannot stack charges or extend its active timer',()=>{
  const run=landed(),id=run.supportDrop.id;run.shieldCharges=1;run.shieldUntil=run.time+8;const until=run.shieldUntil;
  collect(run);assert.equal(run.supportCollected,0);assert.equal(run.supportDrop.id,id);assert.equal(run.shieldCharges,1);assert.equal(run.shieldUntil,until);
  run.time=until;stepRun(run,{},1/60);assert.equal(run.supportCollected,1);assert.equal(run.shieldCharges,2);assert(Math.abs(run.shieldUntil-run.time-15)<1e-9);
});
check('ignored shield crates expire without granting charges or pickup points',()=>{
  const run=landed();advance(run,SUPPORT_DROP_LIFETIME);assert.equal(run.supportDrop,null);assert.equal(run.supportCollected,0);assert.equal(run.supportIgnored,1);assert.equal(run.shieldCharges,0);assert.equal(run.lastSupportIgnored.kind,'shield');assert.equal(scoreRun(run).rows.find(r=>r.id==='supplies').points,0);
});
check('auto defense ignores early, resolved, distant and already-past missiles',()=>{
  const run=active();missile(run,{impactAt:run.time+1});missile(run,{x:run.x+18.01});missile(run,{resolved:true});missile(run,{impactAt:run.time-.1});
  stepRun(run,{},1/60);assert.equal(run.shieldCharges,2);assert.equal(run.missilesIntercepted,0);assert.equal(run.lastShieldIntercept,null);
});
check('exact 0.8-second and radius-plus-eight boundaries are eligible',()=>{
  const run=active();run.time=9.95;run.shieldUntil=20;const m=missile(run,{impactAt:10.8,x:run.x+18});stepRun(run,{},.05);
  assert.equal(run.time,10);assert.equal(m.intercepted,true);assert.equal(run.shieldCharges,1);assert.equal(run.missilesIntercepted,1);
});
check('interception happens before exact impact and retains matching visible-trajectory metadata',()=>{
  const run=active();run.time=9.95;run.shieldUntil=20;run.health=1;const m=missile(run,{impactAt:10});stepRun(run,{},.05);
  assert.equal(run.health,1);assert.equal(run.state,'playing');assert.equal(m.resolved,true);assert.equal(m.intercepted,true);assert.equal(m.interceptedAt,10);assert.equal(run.missilesDodged,0);
  assert.deepEqual(run.lastShieldIntercept,{id:m.id,at:10,from:{x:run.x,y:2.4,z:run.z},target:{x:m.x,y:Math.sin(Math.PI)*12,z:m.z}});
  assert.equal(m.shieldIntercept,run.lastShieldIntercept);
});
check('a frame crossing impact is protected, while shield expiry wins an exact tie',()=>{
  const protectedRun=active();protectedRun.time=9.97;protectedRun.shieldUntil=20;const m=missile(protectedRun,{impactAt:10});stepRun(protectedRun,{},.05);assert(m.intercepted);assert.equal(protectedRun.health,2);
  const run=active();run.time=9.95;run.shieldUntil=10;const expired=missile(run,{impactAt:10});stepRun(run,{},.05);
  assert.equal(run.time,10);assert.equal(run.shieldUntil,0);assert.equal(run.shieldCharges,0);assert.equal(run.missilesIntercepted,0);assert.equal(run.health,1);assert.equal(expired.resolved,true);assert(!expired.intercepted);
});
check('two simultaneous threats consume two charges and each keeps its own visual event',()=>{
  const run=active(),a=missile(run,{x:run.x-13.5,z:run.z-4}),b=missile(run,{x:run.x+13.5,z:run.z+4});stepRun(run,{},1/60);
  assert.equal(run.shieldCharges,0);assert.equal(run.shieldUntil,0);assert.equal(run.missilesIntercepted,2);assert.equal(run.missilesDodged,0);assert.equal(run.health,2);
  assert(a.intercepted&&b.intercepted);assert.notEqual(a.shieldIntercept,b.shieldIntercept);assert.equal(a.shieldIntercept.id,a.id);assert.equal(b.shieldIntercept.id,b.id);assert.equal(run.lastShieldIntercept.id,b.id);
  for(const m of[a,b]){const p=(m.interceptedAt-m.start-.7)/(m.impactAt-m.start-.7);assert.equal(m.shieldIntercept.target.x,m.fromX+(m.x-m.fromX)*p);assert.equal(m.shieldIntercept.target.y,5*(1-p)+Math.sin(p*Math.PI)*12);assert.equal(m.shieldIntercept.target.z,m.fromZ+(m.z-m.fromZ)*p);}
  const at=a.interceptedAt;advance(run,1.2);assert(run.time>=at+1.19);assert(run.missiles.includes(a)&&run.missiles.includes(b),'both event snapshots remain available throughout their effect');
  advance(run,2);assert.equal(run.missilesDodged,0);assert.equal(run.missilesIntercepted,2);assert.equal(run.health,2);
});
check('a third missile in the same salvo is not protected after two charges are spent',()=>{
  const run=active();run.time=9.95;run.shieldUntil=20;for(let n=0;n<3;n++)missile(run,{impactAt:10});stepRun(run,{},.05);
  assert.equal(run.missilesIntercepted,2);assert.equal(run.missiles.filter(m=>m.intercepted).length,2);assert.equal(run.health,1);assert.equal(run.hits,1);assert.equal(run.lastHit,'missile');assert.equal(run.missilesDodged,0);
});
check('safe missiles consume no charge and remain genuine dodges at impact',()=>{
  const run=active();run.time=9.95;run.shieldUntil=20;const m=missile(run,{impactAt:10,x:run.x+30});stepRun(run,{},.05);
  assert.equal(run.shieldCharges,2);assert.equal(run.missilesIntercepted,0);assert.equal(run.missilesDodged,1);assert.equal(m.resolved,true);assert(!m.intercepted);
});
check('expiry clears unused charges and prevents protection afterwards',()=>{
  const run=active(),until=run.shieldUntil;run.time=until-.05;stepRun(run,{},.05);assert.equal(run.time,until);assert.equal(run.shieldUntil,0);assert.equal(run.shieldCharges,0);
  missile(run,{impactAt:run.time});stepRun(run,{},1/60);assert.equal(run.health,1);assert.equal(run.missilesIntercepted,0);
});
check('a shield crate cannot retroactively save a fatal impact during its pickup frame',()=>{
  const run=landed();run.health=1;run.x=run.supportDrop.x;run.z=run.supportDrop.z;missile(run,{impactAt:run.time});stepRun(run,{},1/60);
  assert.equal(run.state,'lost');assert.equal(run.health,0);assert.equal(run.supportCollected,0);assert.equal(run.shieldCharges,0);assert.equal(run.supportDrop,null);
});
check('drone damage is unaffected by active missile defense',()=>{
  const run=active();for(let n=0;n<90;n++){const p=droneAt(DRONES[0],run.time+1/60);run.x=p.scanX;run.z=p.scanZ;stepRun(run,{},1/60);}
  assert.equal(run.lastHit,'drone');assert.equal(run.health,1);assert.equal(run.shieldCharges,2);assert.equal(run.missilesIntercepted,0);
});
check('pause and zero dt freeze pending pickup, timers, interception and random state',()=>{
  for(const make of[earned,landed,active]){
    const run=make();missile(run);const before=JSON.stringify(run);for(let n=0;n<100;n++)stepRun(run,{},0);assert.equal(JSON.stringify(run),before);
    run.state='paused';const frozen=JSON.stringify(run);advance(run,30);assert.equal(JSON.stringify(run),frozen);
  }
});
check('loss, docking and restart clear shield activity without altering past runs',()=>{
  const lost=active();lost.health=1;damage(lost,'drone');assert.equal(lost.state,'lost');assert.equal(lost.shieldCharges,0);assert.equal(lost.shieldUntil,0);assert.equal(lost.lastShieldIntercept,null);
  const dock=active();dock.x=DOCK.x;dock.z=-COURSE_LENGTH+.1;dock.speed=2;stepRun(dock,{throttle:.15},1/60);assert.equal(dock.state,'docking');assert.equal(dock.shieldCharges,0);assert.equal(dock.shieldUntil,0);advance(dock,4);assert.equal(dock.state,'won');
  const old=active();missile(old);stepRun(old,{},1/60);const fresh=createRun({supportSeed:2});assert.equal(fresh.shieldCharges,0);assert.equal(fresh.shieldUntil,0);assert.equal(fresh.missilesIntercepted,0);assert.equal(fresh.lastShieldIntercept,null);assert.equal(old.shieldCharges,1);assert.equal(old.missilesIntercepted,1);
});
check('interceptions cannot farm pickups, support earnings, dodge events or direct points',()=>{
  const run=active(),before=scoreRun(run),earnedCount=run.supportEarned,progress=run.supportProgress;missile(run);stepRun(run,{},1/60);advance(run,3);
  assert.equal(run.supportCollected,1);assert.equal(run.supportEarned,earnedCount);assert.equal(run.supportProgress,progress);assert.equal(run.droneDodges,0);assert.equal(run.missilesDodged,0);assert.equal(run.missilesIntercepted,1);
  assert.deepEqual(scoreRun(run).rows,before.rows);assert.equal(scoreRun(run).rows.find(r=>r.id==='supplies').points,250);
});
check('serialized active shield resumes identical events with no duplicated consumption',()=>{
  const run=active();missile(run);const restored=JSON.parse(JSON.stringify(run));advance(run,1);advance(restored,1);assert.deepEqual(restored,run);assert.equal(restored.shieldCharges,1);assert.equal(restored.missilesIntercepted,1);assert.equal(restored.supportCollected,1);
});
const shieldRoutes=[
  {supportSeed:2,kinds:['shield','boost']},
  {supportSeed:5,kinds:['shield','shield']},
  {supportSeed:9,kinds:['boost','shield']},
  {supportSeed:10,kinds:['intercept','shield']},
  {supportSeed:20,kinds:['shield','intercept']},
];
for(const dt of[1/20,1/30,1/60]){
  check(`${Math.round(1/dt)}fps full route needs neither supply pickups nor manual interceptions`,()=>{
    const r=simulateHarderRoute({dt,collect:false,intercept:false,supportSeed:5});
    assert.equal(r.state,'won');assert.equal(r.health,2);assert.equal(r.hits.length,0);assert.equal(r.shots.length,0);assert.equal(r.pickups.length,0);assert.equal(r.ignored.length,2);assert.equal(r.nearBankFrames,0);assert.equal(r.missilesDodged,11);assert.equal(r.x,DOCK.x);assert.equal(r.z,DOCK.z);
  });
  for(const {supportSeed,kinds} of shieldRoutes)check(`${Math.round(1/dt)}fps seed ${supportSeed} physically collects ${kinds.join(' then ')} and reaches the dock`,()=>{
    const run=createRun({supportSeed}),pickups=[];let nearBankFrames=0,shieldEvents=0;
    for(let frame=0;frame<320/dt&&['playing','docking'].includes(run.state);frame++){
      if(run.z<-1470&&[5,6].includes(selectInterceptTarget(run)))fireIntercept(run);
      const collected=run.supportCollected,intercepted=run.missilesIntercepted;stepRun(run,pilot(run),dt);
      if(run.supportCollected>collected)pickups.push({...run.lastSupportPickup});
      if(run.nearBank)nearBankFrames++;
      const newlyIntercepted=run.missiles.filter(m=>m.shieldIntercept?.at===run.time);
      assert.equal(newlyIntercepted.length,run.missilesIntercepted-intercepted);shieldEvents+=newlyIntercepted.length;
      assert(run.health<=MAX_HEALTH);assert(run.shieldCharges>=0&&run.shieldCharges<=2);
    }
    assert.equal(run.state,'won');assert(run.health>=1);assert.equal(run.supportEarned,2);assert.equal(run.supportCollected,2);assert.deepEqual(pickups.map(p=>p.kind),kinds);assert.equal(nearBankFrames,0);assert.equal(run.x,DOCK.x);assert.equal(run.z,DOCK.z);assert(run.time>140&&run.time<160);
    assert.equal(shieldEvents,run.missilesIntercepted);assert(run.missilesIntercepted<=2*kinds.filter(k=>k==='shield').length);assert.equal(run.shieldCharges,0);assert.equal(run.shieldUntil,0);
    if(supportSeed===5||supportSeed===9||supportSeed===10)assert(run.missilesIntercepted>=1,'these naturally timed shield routes must exercise automatic defense');
    console.log(`  ${run.time.toFixed(2)}s; ${run.health} health; ${run.missilesIntercepted} automatic interceptions; ${run.missilesDodged} actual dodges.`);
  });
}
console.log(`${checks} automatic missile-shield checks passed.`);
