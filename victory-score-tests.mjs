import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from './dist/vendor/three.module.js';
let harness=await fs.readFile('integration-tests.mjs','utf8');
harness=harness.slice(0,harness.indexOf("el('help').click()"));
harness=harness.replace("from './dist/logic.js'",`from ${JSON.stringify(new URL('./dist/logic.js',import.meta.url).href)}`);
harness+='\nglobalThis.victoryHarness={advance,el,globalHandlers};';
await import('data:text/javascript;base64,'+Buffer.from(harness).toString('base64'));
const {advance,el,globalHandlers}=victoryHarness;
let ended;
function startWin(mode='success'){
 if(['won','lost'].includes(getGameTestState().state)){if(getGameTestState().finaleAudioPlaying){ended?.();advance(12);}else advance(12);el('again').click();}else el('start').click();
 const q=getGameTestState();q.archiveBuffers.clear();if(mode!=='missing')q.archiveBuffers.set('full',{duration:21.5});
 q.soundscape.playClip=(_buffer,callback)=>{if(mode==='throw')throw new Error('Audio blocked');if(mode==='blocked')return false;ended=callback;return true;};
 q.run.state='won';q.run.distance=1800;q.run.time=140;q.run.speed=0;advance(.1);return q.run;
}
let run=startWin();assert(el('result').classList.contains('hidden'));assert(el('again').disabled);
advance(3.3);let q=getGameTestState();assert(q.finaleAudioPlaying);assert(q.celebrationResults);assert(!el('result').classList.contains('hidden'));assert(el('body').classList.contains('celebrating-score'));
assert(el('score-report').innerHTML.includes('YOUR VOYAGE'));assert(el('score-report').innerHTML.includes('PRACTICE'));
const stableScore=el('score-report').innerHTML,frameStart=q.captain.rotation.y;
el('again').click();el('restart').click();assert.equal(getGameTestState().run,run,'both replay paths locked during speech');
advance(.35);assert.notEqual(getGameTestState().captain.rotation.y,frameStart,'captain continues dancing while score visible');
assert.equal(el('score-report').innerHTML,stableScore,'no per-frame score rerender');
for(const [w,h] of [[320,568],[390,844],[812,375],[1188,761]]){
 globalThis.innerWidth=w;globalThis.innerHeight=h;globalHandlers.get('resize')();advance(2);
 const v=getGameTestState().victoryViewport(w,h);assert.deepEqual(rendererSize,{width:v.width,height:v.height});
 assert(v.width>0&&v.height>0);assert.equal(rendered.camera.aspect,v.width/v.height);
 assert(v.portrait?v.height+v.panelHeight===h:v.width+v.panelWidth===w,'separate canvas and panel partition');
 rendered.scene.updateMatrixWorld(true);rendered.camera.updateMatrixWorld(true);
 const center=new THREE.Vector3();getGameTestState().captain.getWorldPosition(center);center.y+=1.8;
 const projection=center.clone().project(rendered.camera);assert(Math.abs(projection.x)<.9&&Math.abs(projection.y)<.9,`captain center remains in unobscured scene ${w}x${h}`);
}
assert.equal(getGameTestState().finaleAudioPlaying,true);ended();advance(.6);
assert(!getGameTestState().celebrationResults);assert(!el('again').disabled);assert(!el('body').classList.contains('celebrating-score'));
assert.deepEqual(rendererSize,{width:1188,height:761});el('again').click();assert.equal(getGameTestState().state,'playing');assert(el('result').classList.contains('hidden'));assert.equal(getGameTestState().scoreRevealed,false);
for(const mode of ['missing','blocked','throw']){
 startWin(mode);advance(3.3);assert(getGameTestState().celebrationResults,`${mode}: score reveals on schedule`);assert(!getGameTestState().finaleAudioPlaying);assert.equal(getGameTestState().quoteDirector.finaleUsed,false);advance(7);assert(!getGameTestState().celebrationResults);assert(!el('again').disabled);
}
startWin();el('audio').click();advance(3.3);assert(!getGameTestState().finaleAudioPlaying);advance(8);assert(!el('again').disabled);el('audio').click();
startWin();advance(3.3);assert(getGameTestState().finaleAudioPlaying);const staleEnded=ended;el('audio').click();advance(1.1);assert(!getGameTestState().celebrationResults);assert(!el('again').disabled);el('audio').click();el('again').click();staleEnded();advance(.1);assert.equal(getGameTestState().state,'playing');assert.equal(getGameTestState().celebrationFinishAt,-100,'stale audio completion cannot modify replay');
startWin();el('audio').click();advance(1.2);el('audio').click();advance(3.5);assert(!getGameTestState().finaleAudioPlaying,'unmuting does not start a late speech after results');assert(getGameTestState().endQuotePlayed);
startWin();advance(3.3);globalHandlers.get('blur')();advance(1.1);assert(!getGameTestState().celebrationResults);assert(!el('again').disabled);
el('again').click();q=getGameTestState();q.run.state='lost';q.run.health=0;q.run.hits=2;advance(.1);assert(!el('result').classList.contains('hidden'));assert(!q.celebrationResults);assert(!el('again').disabled);assert(el('score-report').innerHTML.includes('KEEP PRACTICING'));el('restart').click();assert.equal(getGameTestState().state,'lost');el('again').click();assert.equal(getGameTestState().state,'playing');
console.log('PASS: speech-time score reveal, preserved dance/audio, locked replay, score stability, four non-overlapping scene/panel viewports with captain-center projection, natural audio completion, missing/blocked/throwing/muted audio, blur, stale callback, and failure replay.');
