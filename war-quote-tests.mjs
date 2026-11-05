import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {ARCHIVE_QUOTES,QuoteDirector} from './dist/quotes.js';
import {channelAt,DOCK} from './dist/logic.js';

let checks=0;
function check(name,fn){fn();checks++;console.log(`PASS: ${name}`);}
const snapshot=q=>({last:q.last,nextAt:q.nextAt,activeUntil:q.activeUntil,counts:{...q.counts},finaleUsed:q.finaleUsed});

check('rejected acceptance never commits count, cooldown, active duration or finale',()=>{
  const q=new QuoteDirector(()=>0),before=snapshot(q);
  for(const event of ['incomingMissile','droneEscape','victory']){
    assert.equal(q.choose(event,40,()=>false),null);
    assert.deepEqual(snapshot(q),before);
  }
  assert.equal(q.choose('incomingMissile',40,()=>true)?.id,'war');
  assert.equal(q.counts.war,1);
});
check('first incoming war bypasses cooldown only after active speech ends',()=>{
  const q=new QuoteDirector(()=>0);
  assert.equal(q.choose('droneEscape',10)?.id,'winning');
  let called=false;
  assert.equal(q.choose('incomingMissile',q.activeUntil-.001,()=>{called=true;return true;}),null);
  assert.equal(called,false);
  const activeUntil=q.activeUntil;
  assert(activeUntil<q.nextAt);
  assert.equal(q.choose('incomingMissile',activeUntil)?.id,'war');
  assert.equal(q.counts.war,1);
});
check('later war respects cooldown, no repeat, two-play cap and reset',()=>{
  const q=new QuoteDirector(()=>0);
  assert.equal(q.choose('incomingMissile',0)?.id,'war');
  assert.equal(q.choose('incomingMissile',100),null);
  assert.equal(q.choose('droneEscape',100)?.id,'winning');
  assert.equal(q.choose('incomingMissile',110),null);
  assert.equal(q.choose('incomingMissile',150)?.id,'war');
  assert.equal(q.choose('droneEscape',200)?.id,'winning');
  assert.equal(q.choose('incomingMissile',250),null);
  q.reset();
  assert.equal(q.counts.war,0);assert.equal(q.activeUntil,0);
  assert.equal(q.choose('incomingMissile',0)?.id,'war');
});
check('setback use already satisfies first-war priority and finale remains once',()=>{
  const q=new QuoteDirector(()=>0);
  assert.equal(q.choose('setback',0)?.id,'war');
  assert.equal(q.choose('droneEscape',30)?.id,'winning');
  assert.equal(q.choose('incomingMissile',35),null);
  assert.equal(q.choose('victory',40)?.id,'full');
  assert.equal(q.choose('victory',100),null);
});

// Reuse only the existing headless DOM/Three scene initialization, not its test cases.
// The game and module imports remain real; only WebGL rendering and playback are stubbed.
let harness=await fs.readFile(new URL('./integration-tests.mjs',import.meta.url),'utf8');
const marker="el('help').click()";
assert(harness.includes(marker),'integration initialization marker must exist');
harness=harness.slice(0,harness.indexOf(marker));
harness=harness.replace("from './dist/logic.js'",`from ${JSON.stringify(new URL('./dist/logic.js',import.meta.url).href)}`);
harness+='\nglobalThis.warHarness={advance,el,globalHandlers};';
await import('data:text/javascript;base64,'+Buffer.from(harness).toString('base64'));
const {advance,el,globalHandlers}=globalThis.warHarness;
const state=()=>globalThis.getGameTestState();
let played=[],attempts=0,accept=true;
function fresh(){
  if(el('audio').textContent==='♪')el('audio').click();
  el('start').click();
  const s=state();
  s.archiveBuffers.clear();s.quoteDirector.random=()=>0;
  played=[];attempts=0;accept=true;
  s.soundscape.playClip=(buffer)=>{attempts++;if(!accept)return false;played.push(buffer.id);return true;};
  return s;
}
function load(id){state().archiveBuffers.set(id,{id,duration:ARCHIVE_QUOTES[id].duration});}
function enterMissileZone(){const r=state().run;r.time=40;r.z=-630;r.x=channelAt(r.z).center;advance(1/60);}
function expectPristine(){const q=state().quoteDirector;assert.equal(q.counts.war,0);assert.equal(q.last,null);assert.equal(q.nextAt,0);assert.equal(q.activeUntil,0);}

check('missing buffer stays unconsumed; queued first war plays once after load',()=>{
  fresh();enterMissileZone();expectPristine();assert.equal(attempts,0);
  const pending=state().pendingWar;assert(pending);assert.equal(pending.missileId,state().run.missileId);
  assert(Math.abs(pending.expiresAt-state().run.time-3.2)<1e-9);
  advance(.75);expectPristine();load('war');advance(1/60);
  assert.deepEqual(played,['war']);assert.equal(state().pendingWar,null);assert.equal(state().quoteDirector.counts.war,1);
  advance(.5);assert.deepEqual(played,['war']);
});
check('rejected playback remains eligible and queue retries without spending quote',()=>{
  fresh();load('war');accept=false;enterMissileZone();expectPristine();assert(attempts>=1);assert(state().pendingWar);
  advance(.2);expectPristine();accept=true;advance(1/60);
  assert.deepEqual(played,['war']);assert.equal(state().pendingWar,null);assert.equal(state().quoteDirector.counts.war,1);
});
check('muted warning neither plays, consumes nor queues',()=>{
  fresh();load('war');el('audio').click();enterMissileZone();expectPristine();
  assert.equal(attempts,0);assert.equal(state().pendingWar,null);
  el('audio').click();advance(.2);assert.deepEqual(played,[]);
});
check('muting discards existing queue and unmute does not replay stale warning',()=>{
  fresh();enterMissileZone();assert(state().pendingWar);el('audio').click();advance(1/60);
  assert.equal(state().pendingWar,null);load('war');el('audio').click();advance(.2);
  expectPristine();assert.deepEqual(played,[]);
});
check('queued warning waits for active speech without overlap then bypasses cooldown',()=>{
  const s=fresh();load('winning');load('war');s.run.time=40;
  assert.equal(s.archiveMoment('droneEscape'),true);enterMissileZone();
  assert.deepEqual(played,['winning']);assert(state().pendingWar);
  advance(2.5);assert.deepEqual(played,['winning']);advance(.3);
  assert.deepEqual(played,['winning','war']);assert.equal(state().pendingWar,null);
});
check('speech longer than queue lifetime is never interrupted by stale war',()=>{
  const s=fresh();load('winbig');load('war');s.quoteDirector.random=()=>.99;s.run.time=40;
  assert.equal(s.archiveMoment('droneEscape'),true);enterMissileZone();assert(state().pendingWar);
  advance(3.25);assert.equal(state().pendingWar,null);advance(.8);
  assert.deepEqual(played,['winbig']);assert.equal(s.quoteDirector.counts.war,0);
});
check('queue expiry prevents playing a clip loaded after the missile resolves',()=>{
  fresh();enterMissileZone();advance(3.25);assert.equal(state().pendingWar,null);
  load('war');advance(.2);expectPristine();assert.deepEqual(played,[]);
});
check('queue is tied to its original unresolved missile, not another missile',()=>{
  fresh();enterMissileZone();const missile=state().run.missiles[0];missile.resolved=true;
  state().run.missiles.push({...missile,id:999,resolved:false,impactAt:state().run.time+10});
  load('war');advance(1/60);assert.equal(state().pendingWar,null);expectPristine();assert.deepEqual(played,[]);
});
check('explicit queue deadline expires even if a matching missile remains unresolved',()=>{
  fresh();enterMissileZone();const s=state();s.run.missiles[0].impactAt=s.run.time+100;
  s.run.time=s.pendingWar.expiresAt;load('war');s.retryFirstWarning();
  assert.equal(state().pendingWar,null);expectPristine();assert.deepEqual(played,[]);
});
check('pause clears queue and resume cannot start stale playback',()=>{
  fresh();enterMissileZone();globalHandlers.get('blur')();load('war');advance(.1);
  assert.equal(state().state,'paused');assert.equal(state().pendingWar,null);assert.deepEqual(played,[]);
  el('resume').click();advance(.2);expectPristine();assert.deepEqual(played,[]);
});
check('help clears queue without hidden playback',()=>{
  fresh();enterMissileZone();el('help').click();load('war');advance(.1);
  assert.equal(state().state,'help');assert.equal(state().pendingWar,null);assert.deepEqual(played,[]);
  el('start').click();advance(.1);expectPristine();assert.deepEqual(played,[]);
});
check('loss and victory discard queue with no warning playback after the end',()=>{
  for(const ending of ['lost','won']){
    fresh();enterMissileZone();state().run.state=ending;load('war');advance(.1);
    assert.equal(state().state,ending);assert.equal(state().pendingWar,null);assert.deepEqual(played,[]);expectPristine();
    state().run.missiles=[];
    assert.equal(state().archiveMoment('incomingMissile'),false);
    assert.equal(state().archiveMoment('setback'),false,'delayed setback cannot play after game end');
    expectPristine();assert.deepEqual(played,[]);
  }
});
check('run end is honored even before the frame updates its display state',()=>{
  fresh();load('war');state().run.state='lost';
  assert.equal(state().state,'playing');
  assert.equal(state().archiveMoment('incomingMissile'),false);
  assert.equal(state().archiveMoment('setback'),false);
  expectPristine();assert.deepEqual(played,[]);
});
check('automatic docking discards pending warning',()=>{
  fresh();enterMissileZone();const s=state();s.run.z=-1799.9;s.run.x=DOCK.x;s.run.speed=2;
  load('war');advance(.1);assert.equal(state().state,'docking');assert.equal(state().pendingWar,null);assert.deepEqual(played,[]);expectPristine();
});
check('restart clears pending warning and first-warning eligibility resets',()=>{
  fresh();enterMissileZone();assert(state().pendingWar);el('restart').click();
  assert.equal(state().pendingWar,null);expectPristine();load('war');advance(.2);assert.deepEqual(played,[]);
  enterMissileZone();assert.deepEqual(played,['war']);assert.equal(state().quoteDirector.counts.war,1);
});

// Observe the new harder-route pilot with real supply detours. Playback RNG
// varies across 100 voyages; movement/physics/outcome are not mocked.
let routeSource=await fs.readFile(new URL('./harder-route-simulate.mjs',import.meta.url),'utf8');
routeSource=routeSource.replace("from './dist/logic.js'",`from ${JSON.stringify(new URL('./dist/logic.js',import.meta.url).href)}`);
const routeStep='stepRun(run,pilot(run,{throttle,...options}),dt);';
assert(routeSource.includes(routeStep),'route simulation step marker must exist');
routeSource=routeSource.replace(routeStep,`${routeStep}\n    options.onStep?.(run);`);
const {simulateHarderRoute:simulate}=await import('data:text/javascript;base64,'+Buffer.from(routeSource).toString('base64'));
check('100 successful routes select first war at first missile with accepting playback',()=>{
  let observed=0;
  for(let seed=1;seed<=100;seed++){
    let rng=seed,lastMissile=0,hits=0,droneDodges=0,missileDodges=0,setbackAt=Infinity;
    let firstMissileAt=null,firstWarAt=null;
    const q=new QuoteDirector(()=>{rng=(Math.imul(1664525,rng)+1013904223)>>>0;return rng/2**32;});
    const supportSeed=[0,1,8,5][seed%4];
    const result=simulate({supportSeed,throttle:supportSeed===0?.9:1,intercept:true,dt:1/60,onStep(run){
      function event(kind){
        if(run.state!=='playing')return;
        if(kind!=='incomingMissile'&&run.missiles.some(m=>!m.resolved))return;
        const clip=q.choose(kind,run.time,()=>true);
        if(clip?.id==='war'&&firstWarAt===null)firstWarAt=run.time;
      }
      if(run.missileId>lastMissile){lastMissile=run.missileId;firstMissileAt??=run.time;event('incomingMissile');}
      if(run.hits>hits){hits=run.hits;setbackAt=run.time+.75;}
      if(run.droneDodges>droneDodges){droneDodges=run.droneDodges;event('droneEscape');}
      if(run.missilesDodged>missileDodges){missileDodges=run.missilesDodged;event('missileDodge');}
      if(run.time>=setbackAt){setbackAt=Infinity;if(['playing','lost'].includes(run.state))event('setback');}
    }});
    assert.equal(result.state,'won',`seed ${seed} completes the route`);
    assert.notEqual(firstWarAt,null,`seed ${seed} must play war`);
    assert.equal(firstWarAt,firstMissileAt,`seed ${seed} must play at its first warning`);
    assert(q.counts.war<=2);observed++;
  }
  assert.equal(observed,100);
});

console.log(`PASS: ${checks} focused first-war checks, including 100 successful full-route playback simulations.`);
