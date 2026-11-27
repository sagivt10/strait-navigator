import test from 'node:test';
import assert from 'node:assert/strict';
import {helmDrag,releaseCruise,resolveThrottle} from './dist/touch-helm.js';
import {scoreRun,SCORING_RULES} from './dist/scoring.js';
import {createRun,stepRun,DRONES,MISSILE_ZONES,MAX_SPEED,MAX_SUPPORT_EARNED,HULL_WIDTH_SCALE,HULL_LENGTH_SCALE,channelAt} from './dist/logic.js';
import {scoreMarkup} from './dist/score-view.js';
import {simulateHarderRoute} from './harder-route-simulate.mjs';
test('release preserves forward throttle but not turning; stop and brake are explicit',()=>{
 const drag=helmDrag(24,-42,42);
 assert(drag.steer>.3&&drag.throttle>.8);
 const pace=releaseCruise(0,drag);
 assert.equal(resolveThrottle(pace,0,false,false),pace);
 assert.equal(releaseCruise(pace,{throttle:0,steer:.7}),pace);
 assert.equal(releaseCruise(pace,{throttle:0,steer:0}),0);
 assert.equal(releaseCruise(pace,{throttle:-.7,steer:.5}),0);
 assert.equal(resolveThrottle(pace,0,false,true),-1);
 const r=createRun({supportSeed:4});
 const heading=r.heading;
 for(let i=0;i<100;i++)stepRun(r,{throttle:pace,steer:0},.02);
 assert(r.speed>5);assert.equal(r.heading,heading);
});
test('points ledger sums exactly, seconds always matter in ranked window, hits and timing both itemized',()=>{
 const run={state:'won',time:142,health:2,hits:1,distance:1800,supportCollected:2,droneDodges:4,cleanMissileZones:[0,0,1,1,4,82]};
 const a=scoreRun(run),b=scoreRun({...run,time:143}),slow=scoreRun({...run,time:300}),slow2=scoreRun({...run,time:301});
 assert.equal(a.total-b.total,14);
 assert.equal(slow.total-slow2.total,2);
 assert.equal(scoreRun({...run,hits:2}).total,a.total-400);
 assert.equal(a.nearMisses,3);
 assert.equal(a.rows.find(r=>r.id==='near-misses').points,225);
 assert.equal(a.rows.find(r=>r.id==='clean-passes').points,140);
 assert.equal(a.rows.find(r=>r.id==='supplies').points,360);
 assert(a.rows.find(r=>r.id==='time-charged').points<0);
 assert.equal(a.earned-a.deducted,a.subtotal);
 assert.equal(a.rows.reduce((s,e)=>s+e.points,0),a.total);
 const loss=scoreRun({...run,state:'lost'});
 assert.equal(loss.rows.find(r=>r.id==='time').points,0);
 assert.equal(loss.rows.find(r=>r.id==='time-charged').points,0);
 const markup=scoreMarkup(run);
 for(const label of ['Close missile escapes','Clean drone passes','Time spent','Damage taken','Supply crates collected'])assert(markup.includes(label));
 assert.equal(SCORING_RULES.maxSupplies,MAX_SUPPORT_EARNED);
});
test('course has paced extra encounters, supplies cap, and a larger silhouette',()=>{
 assert.equal(DRONES.length,11);assert.equal(MISSILE_ZONES.length,8);
 assert(MAX_SPEED>14&&MAX_SPEED<=15.5);assert.equal(MAX_SUPPORT_EARNED,3);
 assert(HULL_WIDTH_SCALE>1&&HULL_LENGTH_SCALE>HULL_WIDTH_SCALE);
 const run=createRun({supportSeed:1});run.z=MISSILE_ZONES[6].z;run.x=channelAt(run.z).center;
 run.intercepted=DRONES.map((_,i)=>i);
 stepRun(run,{throttle:0,steer:0},.05);assert.equal(run.missileId,1);
 // Additional one-shot volleys don't camp a stopped player.
 for(let i=0;i<280;i++)stepRun(run,{throttle:0,steer:0},.05);
 assert.equal(run.missileId,1);
});
test('benchmark route remains completable with original policy, 3 drops available and clean skill rewards bounded',()=>{
 const runs=[0,1,5,8,16,27,36].map(seed=>simulateHarderRoute({supportSeed:seed}));
 assert(runs.filter(r=>r.state==='won').length>=4);
 assert(runs.some(r=>r.deliveries.length===3));
 for(const r of runs){assert(r.supportEarned<=3);assert(r.pickups.length<=3);}
});
