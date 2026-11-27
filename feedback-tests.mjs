import assert from 'node:assert/strict';
import test from 'node:test';
import {pointSnapshot,pointChanges} from './dist/points-feed.js';
import {DRONES,HAZARD_PACE,MISSILE_WARNING,MISSILE_LIFT,droneAt,MAX_SPEED,createRun,stepRun,MISSILE_ZONES,channelAt} from './dist/logic.js';
test('HUD shows actual earned category points, not duplicates, and a clear 100-point milestone',()=>{
 const initial=pointSnapshot({distance:99,droneDodges:0,cleanMissileZones:[0]});
 const next=pointSnapshot({distance:102,droneDodges:1,cleanMissileZones:[0,0,4],supportCollected:1,hits:1});
 assert.deepEqual(pointChanges(initial,next).map(x=>x.points),[35,75,180,-400,100]);
 assert.deepEqual(pointChanges(next,next),[]);
});
test('hazard movement and missile warning duration scale with ordinary boat speed',()=>{
 assert.equal(HAZARD_PACE,MAX_SPEED/14);
 const d=DRONES[0],p=droneAt(d,0),q=droneAt(d,d.period/HAZARD_PACE);
 assert(Math.abs(p.x-q.x)<1e-10);
 assert(Math.abs(MISSILE_WARNING*HAZARD_PACE-3.2)<1e-12);
 assert(MISSILE_WARNING>2.9&&MISSILE_LIFT>0.6);
 const r=createRun({supportSeed:2});r.z=MISSILE_ZONES[0].z;r.x=channelAt(r.z).center;stepRun(r,{throttle:0},.05);
 assert.equal(r.missiles[0].impactAt-r.missiles[0].start,MISSILE_WARNING);
});
