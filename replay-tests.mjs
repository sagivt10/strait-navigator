import assert from 'node:assert/strict';
import {createRun,stepRun,fireIntercept,selectInterceptTarget} from './dist/logic.js';
import {scoreRun} from './dist/scoring.js';
import {ReplayRecorder,replayRun,REPLAY_VERSION,MAX_REPLAY_EVENTS,MAX_REPLAY_BYTES} from './dist/replay.js';
import {pilot} from './harder-route-simulate.mjs';
let count=0,interceptions=0,pickups=0;
for(const fps of [20,30,60,120,240]) for(const seed of [0,1,5,8]) {
 const run=createRun({supportSeed:seed}),recorder=new ReplayRecorder();
 while(['playing','docking'].includes(run.state)&&run.time<320){
  const target=selectInterceptTarget(run);
  if(run.z<-1470&&[5,6].includes(target)&&fireIntercept(run)){recorder.intercept();interceptions++;}
  const controls=pilot(run),dt=1/fps;recorder.frame(controls,dt);stepRun(run,controls,dt);
 }
 assert(['won','lost'].includes(run.state));assert.equal(recorder.error,null);
 const result=replayRun(seed,JSON.parse(JSON.stringify(recorder.snapshot())));
 assert.deepEqual(result.run,run);assert.deepEqual(result.result,scoreRun(run));
 if(run.state==='won')assert(run.distance>=1797&&run.distance<=1800);pickups+=run.supportCollected;count++;
}
for(const seed of [0,5]){
 const run=createRun({supportSeed:seed}),recorder=new ReplayRecorder();let i=0;
 while(['playing','docking'].includes(run.state)&&run.time<320){const dt=[0,.05,1/60,.03333333333333333][i++%4];const controls={throttle:1,steer:0};recorder.frame(controls,dt);stepRun(run,controls,dt);}
 assert.equal(run.state,'lost');assert.deepEqual(replayRun(seed,recorder.snapshot()).run,run);count++;
}
for(const event of [[NaN,0,0],[.051,0,0],[-.01,0,0],[.01,Infinity,0],[.01,0,1.01],['i'],[.01,0],null,{}])assert.throws(()=>replayRun(0,{version:REPLAY_VERSION,events:[event]}));
assert.throws(()=>replayRun(-1,{version:REPLAY_VERSION,events:[]}));
assert.throws(()=>replayRun(0,{version:'old',events:[]}));
assert.throws(()=>replayRun(0,{version:REPLAY_VERSION,events:[[.05,0,0]]}));
const slow=new ReplayRecorder();for(let i=0;i<12001;i++)slow.frame({throttle:0,steer:0},.05);assert(slow.error);assert.equal(slow.snapshot(),null);
const huge=new ReplayRecorder();for(let i=0;i<=MAX_REPLAY_EVENTS;i++)huge.frame({throttle:0,steer:0},0);assert(huge.error);assert.equal(huge.snapshot(),null);
assert(interceptions>0&&pickups>0);
console.log(`PASS: ${count} actual voyages replay exactly at 20–240 fps and mixed zero/variable dt; ${interceptions} ordered interceptions, ${pickups} physical pickups; malformed/time/event limits reject.`);

const bytes=new ReplayRecorder();bytes.bytes=MAX_REPLAY_BYTES-1;bytes.frame({throttle:1/3,steer:Math.PI/4},1/60);assert(bytes.error.includes('upload size'));assert.equal(bytes.snapshot(),null);console.log('PASS: exact encoded replay byte limit switches to practice before oversized submission.');
