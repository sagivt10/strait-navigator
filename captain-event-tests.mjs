import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {channelAt,DOCK} from './dist/logic.js';
let harness=await fs.readFile(new URL('./integration-tests.mjs',import.meta.url),'utf8');
harness=harness.slice(0,harness.indexOf("el('help').click()"));
harness=harness.replace("from './dist/logic.js'",`from ${JSON.stringify(new URL('./dist/logic.js',import.meta.url).href)}`);
harness+='\nglobalThis.captainHarness={advance,el,globalHandlers};';
await import('data:text/javascript;base64,'+Buffer.from(harness).toString('base64'));
const {advance,el,globalHandlers}=globalThis.captainHarness;
const game=()=>globalThis.getGameTestState();
const pose=()=>{const values=[];game().captain.traverse(n=>values.push(...n.position.toArray(),...n.rotation.toArray().slice(0,3),...n.scale.toArray()));return values;};
function fresh(){el('start').click();return game();}
function missile(){const r=game().run;r.z=-630;r.x=channelAt(r.z).center;advance(1/60);}
function near(a,b){assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);}

fresh();missile();assert.equal(game().captainAnimator.activeEvent,'incomingMissile','actual missile counter triggers warning on first frame');
const r=game().run;r.hits++;r.lastHit='missile';r.lastHitTime=r.time;r.health=2;r.droneDodges++;r.missilesDodged++;advance(1/60);
assert.equal(game().captainAnimator.activeEvent,'hit','hit supersedes warning and same-frame success');
r.missileCooldowns.fill(Infinity);r.missiles=[];advance(3);
r.droneDodges++;advance(1/60);assert.equal(game().captainAnimator.activeEvent,'cleanDodge','clean drone escape has distinct event');
advance(3);r.missilesDodged++;advance(1/60);assert.equal(game().captainAnimator.activeEvent,'cleanDodge','clean missile escape has distinct event');

fresh();el('audio').click();assert.equal(el('audio').textContent,'♪');missile();assert.equal(game().captainAnimator.activeEvent,'incomingMissile','visual reaction does not depend on audio');
advance(.3);globalHandlers.get('blur')();advance(1/60);const frozen=pose(),elapsed=game().captainAnimator.eventElapsed;advance(3);
assert.deepEqual(pose(),frozen,'pause freezes all character transforms');assert.equal(game().captainAnimator.eventElapsed,elapsed);
el('resume').click();advance(.2);assert(game().captainAnimator.eventElapsed>elapsed,'resume continues reaction');
el('help').click();advance(1/60);const helpPose=pose();advance(2);assert.deepEqual(pose(),helpPose,'help freezes reaction');
el('start').click();el('restart').click();assert.equal(game().captainAnimator.activeEvent,null,'restart clears stale reaction');
advance(.1);assert.equal(game().state,'playing');assert(pose().every(Number.isFinite));

fresh();advance(.1);el('help').click();advance(.1);const resumedRun=game().run;resumedRun.z=-630;resumedRun.x=channelAt(resumedRun.z).center;el('start').click();advance(1/60);assert.equal(game().captainAnimator.activeEvent,'incomingMissile','first frame after help resumes accepts a new real warning');
fresh();advance(.1);globalHandlers.get('blur')();advance(.1);const pausedRun=game().run;pausedRun.hits++;pausedRun.lastHit='missile';pausedRun.lastHitTime=pausedRun.time;el('resume').click();advance(1/60);assert.equal(game().captainAnimator.activeEvent,'hit','first frame after pause resumes accepts damage feedback');

const s=game();s.captainAnimator.trigger('hit');s.run.health=0;s.run.state='lost';advance(1/60);
assert.equal(game().captainAnimator.activeEvent,null,'loss clears active reaction');
el('again').click();advance(.1);const winRun=game().run;winRun.z=-1799.9;winRun.x=DOCK.x;winRun.speed=2;advance(.1);advance(3.6);
assert.equal(game().state,'won');assert.equal(game().captainAnimator.activeEvent,null);
const t=game().time,captain=game().captain;
near(captain.rotation.y,Math.PI+Math.sin(t*2)*.14);near(captain.rotation.z,Math.sin(t*4)*.045);
near(captain.position.x,Math.sin(t*2)*.12);near(captain.position.y,1.65+Math.abs(Math.sin(t*4))*.12);
console.log('PASS: actual missile/hit/drone-dodge/missile-dodge event wiring, first-frame trigger, priority, muted visual reaction, pause/help/resume, reset/loss and exact victory-dance equations.');
