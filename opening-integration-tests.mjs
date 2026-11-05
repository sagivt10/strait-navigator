import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {OPENING_QUOTE,ARCHIVE_QUOTES} from './dist/quotes.js';
import {channelAt} from './dist/logic.js';
let harness=await fs.readFile(new URL('./integration-tests.mjs',import.meta.url),'utf8');
const marker="el('help').click()";
assert(harness.includes(marker));harness=harness.slice(0,harness.indexOf(marker));
harness=harness.replace("from './dist/logic.js'",`from ${JSON.stringify(new URL('./dist/logic.js',import.meta.url).href)}`);
harness+='\nglobalThis.openingHarness={advance,el,globalHandlers};';
await import('data:text/javascript;base64,'+Buffer.from(harness).toString('base64'));
const {advance,el,globalHandlers}=globalThis.openingHarness;
const state=()=>globalThis.getGameTestState();
let played=[],ends=[],accept=true,checks=0;
function check(name,fn){fn();checks++;console.log('PASS: '+name);}
function fresh({warm=false,muted=false}={}){
 if(el('audio').textContent==='♪')el('audio').click();
 if(state().state==='help')el('start').click();
 const s=state();s.cancelOpeningSpeech(true);s.archiveBuffers.clear();s.quoteDirector.random=()=>0;
 played=[];ends=[];accept=true;
 s.soundscape.playClip=(buffer,onEnded)=>{if(!accept)return false;played.push(buffer.id);if(onEnded)ends.push(onEnded);return true;};
 if(warm)s.archiveBuffers.set('gulf',{id:'gulf',duration:OPENING_QUOTE.duration});
 if(muted)el('audio').click();
 el('start').click();return state();
}
function load(id){state().archiveBuffers.set(id,{id,duration:id==='gulf'?OPENING_QUOTE.duration:ARCHIVE_QUOTES[id].duration});}

check('selected seven-second opening is separate from all event pools',()=>{
 assert.equal(OPENING_QUOTE.file,'trump-gulf-mexico.mp3');assert.equal(OPENING_QUOTE.duration,7.027);
 assert.equal(OPENING_QUOTE.text,'We also took the Gulf of Mexico, and now it’s the Gulf of America.');
 assert(!Object.hasOwn(ARCHIVE_QUOTES,'gulf'));
});
check('warm audio starts exactly once from Start without delaying steering or spending event history',()=>{
 const s=fresh({warm:true});assert.deepEqual(played,['gulf']);assert.equal(s.state,'playing');assert(s.openingSpeech.playing);
 assert.equal(s.quoteDirector.last,null);assert.equal(s.quoteDirector.nextAt,0);
 el('forward').handlers.get('pointerdown')({preventDefault(){},pointerId:1});advance(2);
 assert(s.run.z<8&&s.run.speed>1);assert.deepEqual(played,['gulf']);el('forward').handlers.get('pointerup')({pointerId:1});
});
check('cold buffer can arrive during the opening window and starts once on a later frame',()=>{
 const s=fresh();assert(s.openingSpeech.pending);assert.deepEqual(played,[]);advance(1);load('gulf');advance(.3);
 assert.deepEqual(played,['gulf']);advance(2);assert.deepEqual(played,['gulf']);
});
check('all event speech waits for actual opening completion plus quiet tail, not estimated duration',()=>{
 const s=fresh({warm:true});load('winning');load('war');advance(10);
 assert(s.openingSpeech.playing);assert.equal(s.archiveMoment('droneEscape'),false);assert.equal(s.archiveMoment('incomingMissile'),false);
 assert.deepEqual(played,['gulf']);ends[0]();assert.equal(s.archiveMoment('droneEscape'),false);advance(.4);
 assert.equal(s.archiveMoment('droneEscape'),true);assert.deepEqual(played,['gulf','winning']);
});
check('nearby missile remains visible and first-war queue plays only after opening completes',()=>{
 const s=fresh({warm:true});load('war');advance(1);
 s.run.z=-630;s.run.x=channelAt(s.run.z).center;advance(.1);
 assert(s.run.missiles.some(m=>!m.resolved));assert.deepEqual(played,['gulf']);assert(state().pendingWar);
 ends[0]();advance(.5);assert.deepEqual(played,['gulf','war']);assert.equal(s.quoteDirector.counts.war,1);
});
check('missing or late-loaded audio expires without a mid-voyage opening or spent quote history',()=>{
 const s=fresh();advance(8.2);assert(!s.openingSpeech.pending);load('gulf');advance(1);
 assert.deepEqual(played,[]);assert.equal(s.quoteDirector.last,null);load('winning');assert(s.archiveMoment('droneEscape'));
});
check('blocked playback retries briefly without consuming until accepted',()=>{
 const s=fresh();load('gulf');accept=false;advance(1);assert(!s.openingSpeech.played);assert.deepEqual(played,[]);
 accept=true;advance(.3);assert.deepEqual(played,['gulf']);assert(s.openingSpeech.played);
});
check('muted starts stay silent after unmute, and the next unmuted new voyage starts it',()=>{
 fresh({warm:true,muted:true});assert.deepEqual(played,[]);el('audio').click();advance(1);assert.deepEqual(played,[]);
 el('restart').click();assert.deepEqual(played,['gulf']);
});
check('muting pending or playing audio cancels it and unmute cannot restart it',()=>{
 for(const warm of [false,true]){const s=fresh({warm});el('audio').click();load('gulf');advance(.5);el('audio').click();advance(1);
 assert(!s.openingSpeech.pending&&!s.openingSpeech.playing);assert.deepEqual(played,warm?['gulf']:[]);}
});
check('restart invalidates the old end callback and plays once for the new run',()=>{
 fresh({warm:true});const oldEnd=ends[0];el('restart').click();assert.deepEqual(played,['gulf','gulf']);
 oldEnd();assert(state().openingSpeech.playing);advance(.4);assert(state().openingSpeech.playing);ends[1]();advance(.4);
 assert(!state().openingSpeech.busy(state().run.time));
});
check('pause, help and hidden-tab cancellation never start it on resume',()=>{
 for(const action of ['blur','help','hidden']){
  const s=fresh({warm:true});if(action==='help')el('help').click();else if(action==='hidden'){document.hidden=true;globalHandlers.get('visibilitychange')();document.hidden=false;}else globalHandlers.get('blur')();
  assert(!s.openingSpeech.playing);ends[0]();if(action==='help')el('start').click();else el('resume').click();advance(1);
  assert.deepEqual(played,['gulf']);assert(!s.openingSpeech.pending);
 }
});
check('loss or victory cancels opening playback and cannot revive it through stale callbacks',()=>{
 for(const ending of ['lost','won']){const s=fresh({warm:true});const end=ends[0];s.run.state=ending;advance(.1);assert.equal(state().state,ending);
 assert(!s.openingSpeech.playing&&!s.openingSpeech.pending);end();advance(.5);assert.deepEqual(played,['gulf']);}
});
check('failed-run results replay creates a fresh opening, without changing the results flow',()=>{
 const s=fresh({warm:true});s.run.state='lost';advance(.1);assert(!el('result').classList.contains('hidden'));
 el('again').click();assert.equal(state().state,'playing');assert.deepEqual(played,['gulf','gulf']);assert.equal(state().run.health,2);
});

// Exercise the real gesture-unlock/fetch/decode chain with controlled network and audio stubs.
fresh();const s=state(),oldFetch=globalThis.fetch,oldUnlock=s.soundscape.unlock,oldCtx=s.soundscape.ctx;
const requests=[];let resolveGulf;
globalThis.window={};s.soundscape.unlock=async()=>true;s.soundscape.ctx={decodeAudioData:async data=>data};
globalThis.fetch=url=>{requests.push(url);return new Promise(resolve=>{if(url.endsWith(OPENING_QUOTE.file))resolveGulf=()=>resolve({ok:true,arrayBuffer:async()=>({id:'gulf',duration:OPENING_QUOTE.duration})});});};
el('restart').click();await new Promise(resolve=>setImmediate(resolve));
assert.equal(requests[0],'./'+OPENING_QUOTE.file);assert.equal(requests.filter(u=>u.endsWith(OPENING_QUOTE.file)).length,1);
advance(.6);assert.deepEqual(played,[]);resolveGulf();await new Promise(resolve=>setImmediate(resolve));advance(.3);
assert.deepEqual(played,['gulf']);checks++;console.log('PASS: real Start unlock requests opening first, decodes asynchronously, and plays once after load');
delete globalThis.window;globalThis.fetch=oldFetch;s.soundscape.unlock=oldUnlock;s.soundscape.ctx=oldCtx;
console.log(`PASS: ${checks} opening-game integration checks; playback and WebGL are stubbed.`);
