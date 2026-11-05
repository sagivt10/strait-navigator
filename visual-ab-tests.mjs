import assert from 'node:assert/strict';
import fs from 'node:fs';
await import('./integration-tests.mjs');
const initial=getGameTestState(),run=initial.run;
assert.equal(initial.visualMode,'B','upgraded sea is the normal view on every fresh load');
assert(fs.readFileSync('dist/game.js','utf8').includes("setVisualMode('B');"),'old query links cannot change the default');
assert(!fs.readFileSync('dist/index.html','utf8').includes('id="visual-toggle"'),'public A/B switch removed at user request');
assert(fs.readFileSync('dist/index.html','utf8').includes('CAPTAIN TRUMP · SATIRICAL GAME'));

const snapshot=()=>JSON.stringify({run,state:getGameTestState().state,input:getGameTestState().input,farCamera:getGameTestState().farCamera});
const before=snapshot(),ocean=initial.ocean,atmosphere=initial.atmosphere;
for(let i=0;i<100;i++){
  initial.setVisualMode('A');
  let s=getGameTestState();assert.equal(s.visualMode,'A');assert(s.sea.visible);assert(!s.ocean.root.visible);assert(!s.atmosphere.sky.visible);assert.equal(s.sun.castShadow,false);assert.equal(s.hemisphere.intensity,2);assert.equal(snapshot(),before);
  initial.setVisualMode('B');
  s=getGameTestState();assert.equal(s.visualMode,'B');assert(!s.sea.visible);assert(s.ocean.root.visible);assert(s.atmosphere.sky.visible);assert.equal(s.sun.castShadow,true);assert.equal(s.hemisphere.intensity,1.35);assert.equal(snapshot(),before);
  assert.equal(s.ocean,ocean);assert.equal(s.atmosphere,atmosphere);
}
assert(fs.readFileSync('dist/game.js','utf8').includes("if(visualMode==='B')ocean.update"),'new ocean has no per-frame updates in original mode');
assert(!fs.readFileSync('dist/index.html','utf8').includes('id="support-options"'));
assert(fs.readFileSync('dist/style.css','utf8').includes('.supply-cue'));
assert(fs.readFileSync('dist/game.js','utf8').includes("visualMode==='A'&&Math.abs(run.speed)>1"));
console.log('PASS: upgraded B sea defaults every load; 200 internal mode switches preserve game state, controls, camera, health, interception and existing visual instances. Original lighting/sea restore and enhanced lighting/sea enable correctly.');
