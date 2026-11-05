import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {replayRun,REPLAY_VERSION} from './dist/replay.js';
import {scoreRun} from './dist/scoring.js';
let resolveStart,resolveSubmit,createCalls=0,queued;
globalThis.rankedTestClient={
 begin(){createCalls++;return new Promise(resolve=>{resolveStart=resolve;});},
 retryPending(){return Promise.resolve([]);},
 queue(challenge,name,replay){queued={challenge,body:{name,replay}};return queued;},
 submit(){return new Promise(resolve=>{resolveSubmit=resolve;});},
 board(){return Promise.resolve({entries:[],total:0});},
};
let harness=await fs.readFile('integration-tests.mjs','utf8');
harness=harness.slice(0,harness.indexOf("el('help').click()"));
harness=harness.replace("from './dist/logic.js'",`from ${JSON.stringify(new URL('./dist/logic.js',import.meta.url).href)}`);
harness=harness.replace("({begin:()=>null,retryPending:()=>Promise.resolve([]),board:()=>new Promise(()=>{})})",'globalThis.rankedTestClient');
harness=harness.replace('celebrationResults,scoreRevealed,victoryViewport});','celebrationResults,scoreRevealed,victoryViewport,rankedChallenge,replayRecorder,rankedResult,starting});');
harness+='\nglobalThis.rankedHarness={advance,el,key,globalHandlers};';
await import('data:text/javascript;base64,'+Buffer.from(harness).toString('base64'));
const {advance,el,key,globalHandlers}=rankedHarness;
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const challenge={id:'test-run-1',token:'opaque',seed:8,version:REPLAY_VERSION,expiresAt:'2030-01-01T00:00:00Z'};
el('start').click();el('start').click();assert.equal(createCalls,1);assert.equal(getGameTestState().state,'starting');
el('help').click();assert.equal(getGameTestState().state,'starting','Help cannot interrupt pending start');
globalHandlers.get('blur')();resolveStart(challenge);await flush();assert.equal(getGameTestState().state,'paused','blur while waiting remains paused');
assert.equal(getGameTestState().run.supportSeed,8);assert.equal(el('rank-mode').textContent,'Ranked voyage');
el('resume').click();key('keydown','ArrowUp');
for(let i=0;i<240&&getGameTestState().state==='playing';i++)advance(1);
assert.equal(getGameTestState().state,'lost');assert(queued);
const verified=replayRun(challenge.seed,queued.body.replay);assert.equal(verified.run.state,'lost');assert.deepEqual(scoreRun(getGameTestState().run),verified.result);assert.equal(el('score-report').innerHTML.includes('DEMO'),false);assert(el('score-report').innerHTML.includes('SAVING'));
const oldSubmit=resolveSubmit;
el('again').click();assert.equal(createCalls,2);resolveStart({...challenge,id:'test-run-2',seed:5});await flush();assert.equal(getGameTestState().run.supportSeed,5);
oldSubmit({entry:{id:'test-run-1',rank:1},board:{entries:[],total:1},verifiedRun:verified.run});await flush();assert.equal(getGameTestState().rankedResult,null,'late previous result cannot replace the new run');assert(el('result').classList.contains('hidden'));
// Expiry makes the ongoing voyage visibly practice without altering its physics.
getGameTestState().rankedChallenge.expiresAt='2000-01-01T00:00:00Z';advance(.1);assert.equal(el('rank-mode').textContent,'Practice only');assert(getGameTestState().replayRecorder.error.includes('expired'));
console.log('PASS: pending-start double click, Help guard, blur pause, server seed, actual lost-voyage replay capture, saved-state async isolation, and visible ticket expiry.');
