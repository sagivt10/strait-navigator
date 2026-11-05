import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {ARCHIVE_QUOTES,QuoteDirector} from './dist/quotes.js';
import {channelAt} from './dist/logic.js';

let checks=0;
function check(name,fn){fn();checks++;console.log(`PASS: ${name}`);}
const snapshot=q=>({last:q.last,nextAt:q.nextAt,activeUntil:q.activeUntil,counts:{...q.counts},finaleUsed:q.finaleUsed});
const pristine=()=>snapshot(new QuoteDirector());
const DODGE_QUOTES=['winning','winbig','bomb'];

check('new excerpt has its exact asset, duration and original wording',()=>{
  assert.deepEqual(ARCHIVE_QUOTES.bomb,{id:'bomb',file:'trump-bomb-dodge.mp3',duration:2.534,text:'Bomb the shit out of them.'});
});
check('all three missile-dodge choices remain reachable at their random boundaries',()=>{
  for(const [random,id] of [[0,'winning'],[1/3-1e-9,'winning'],[1/3,'winbig'],[2/3-1e-9,'winbig'],[2/3,'bomb'],[.999999,'bomb'],[1,'bomb']]){
    const q=new QuoteDirector(()=>random);
    assert.equal(q.choose('missileDodge',0)?.id,id,`random ${random}`);
    assert.equal(q.counts[id],1);
  }
});
check('bomb is excluded from warnings, drone escapes, setbacks, victory and unknown events',()=>{
  const expected={incomingMissile:['war'],droneEscape:['winning','winbig'],setback:['war'],victory:['full'],unknown:[]};
  for(const [event,pool] of Object.entries(expected)){
    const seen=new Set();
    for(let i=0;i<=100;i++){
      const q=new QuoteDirector(()=>i/100),clip=q.choose(event,0);
      if(clip)seen.add(clip.id);
      assert.equal(q.counts.bomb,0,`${event} cannot consume the dodge-only quote`);
    }
    assert.deepEqual([...seen].sort(),pool.toSorted(),`${event} retains its original pool`);
  }
});
check('no consecutive repeats and each short clip is capped at two per voyage',()=>{
  const q=new QuoteDirector(()=>.999),events=[...Array(5).fill('missileDodge'),'incomingMissile','missileDodge'];
  const picked=events.map((event,i)=>q.choose(event,i*60)?.id);
  assert.deepEqual(picked,['bomb','winbig','bomb','winbig','winning','war','winning']);
  for(let i=1;i<picked.length;i++)assert.notEqual(picked[i],picked[i-1]);
  for(const id of DODGE_QUOTES)assert.equal(q.counts[id],2,`${id} reaches its two-play cap`);
  const before=snapshot(q);
  for(let i=0;i<20;i++)assert.equal(q.choose('missileDodge',500+i*60),null);
  assert.deepEqual(snapshot(q),before,'exhausted pool cannot spend counts or cooldown');
});
check('dodge speech respects active duration and the full randomized cooldown',()=>{
  const q=new QuoteDirector(()=>.999);
  assert.equal(q.choose('missileDodge',10)?.id,'bomb');
  assert.equal(q.activeUntil,10+2.534+.35);
  assert.equal(q.nextAt,10+28+.999*16);
  const before=snapshot(q);
  for(const at of [q.activeUntil-.001,q.activeUntil,q.nextAt-.001]){
    let called=false;
    assert.equal(q.choose('missileDodge',at,()=>{called=true;return true;}),null);
    assert.equal(called,false,'blocked selection must not attempt playback');
    assert.deepEqual(snapshot(q),before);
  }
  assert.equal(q.choose('missileDodge',q.nextAt)?.id,'winbig');
});
check('first-warning priority and victory still cannot overlap dodge speech',()=>{
  for(const event of ['incomingMissile','victory']){
    const q=new QuoteDirector(()=>.999);
    assert.equal(q.choose('missileDodge',0)?.id,'bomb');
    assert.equal(q.choose(event,q.activeUntil-.001),null);
    assert.equal(q.choose(event,q.activeUntil)?.id,event==='incomingMissile'?'war':'full');
  }
});
check('rejected dodge acceptance commits no history, counts, active time or cooldown',()=>{
  const q=new QuoteDirector(()=>.999),before=snapshot(q),offered=[];
  for(let i=0;i<3;i++)assert.equal(q.choose('missileDodge',40,clip=>{offered.push(clip.id);return false;}),null);
  assert.deepEqual(offered,['bomb','bomb','bomb']);
  assert.deepEqual(snapshot(q),before);
  assert.equal(q.choose('missileDodge',40,()=>true)?.id,'bomb');
  assert.equal(q.counts.bomb,1);
});
check('reset restores dodge eligibility along with existing history and finale state',()=>{
  const q=new QuoteDirector(()=>.999);
  for(const [i,event] of ['missileDodge','droneEscape','missileDodge','victory'].entries())q.choose(event,i*60);
  assert.equal(q.counts.bomb,2);assert.equal(q.finaleUsed,true);
  q.reset();assert.deepEqual(snapshot(q),pristine());
  assert.equal(q.choose('missileDodge',0)?.id,'bomb');
});

// Reuse the existing DOM/Three initialization with the real production modules.
// Only rendering and audio output are stubbed, as in the other headless suites.
let harness=await fs.readFile(new URL('./integration-tests.mjs',import.meta.url),'utf8');
const marker="el('help').click()";
assert(harness.includes(marker),'integration initialization marker must exist');
harness=harness.slice(0,harness.indexOf(marker));
harness=harness.replace("from './dist/logic.js'",`from ${JSON.stringify(new URL('./dist/logic.js',import.meta.url).href)}`);
harness+='\nglobalThis.missileDodgeHarness={advance,el,globalHandlers};';
await import('data:text/javascript;base64,'+Buffer.from(harness).toString('base64'));
const {advance,el,globalHandlers}=globalThis.missileDodgeHarness;
const game=()=>globalThis.getGameTestState();
let played=[],attempts=0,mode='accept';
function fresh(random=.999){
  if(el('audio').textContent==='♪')el('audio').click();
  if(game().state==='help')el('start').click();
  el('start').click();
  const s=game();
  s.archiveBuffers.clear();s.quoteDirector.random=()=>random;
  played=[];attempts=0;mode='accept';
  s.soundscape.playClip=buffer=>{
    attempts++;
    if(mode==='throw')throw new Error('Playback unavailable');
    if(mode==='reject')return false;
    played.push(buffer.id);return true;
  };
  return s;
}
function load(...ids){for(const id of ids)game().archiveBuffers.set(id,{id,duration:ARCHIVE_QUOTES[id].duration});}
function launchMissile({z=-630,time=40}={}){
  const r=game().run;r.time=time;r.z=z;r.x=channelAt(z).center;r.speed=0;
  const previous=r.missileId;advance(1/60);
  assert(r.missileId>previous,'real stepRun must launch a new missile');
  return r.missiles.filter(m=>!m.resolved);
}
function expectPristine(){assert.deepEqual(snapshot(game().quoteDirector),pristine());}

check('real missile launch stays silent until its safe resolution triggers bomb exactly once',()=>{
  const s=fresh();load('bomb');const [missile]=launchMissile();
  assert.equal(s.run.missilesDodged,0);assert.equal(missile.resolved,false);
  assert.deepEqual(played,[]);expectPristine();
  advance(3.1);assert.deepEqual(played,[]);assert.equal(s.run.missilesDodged,0);
  advance(.15);assert.equal(missile.resolved,true);assert.equal(s.run.missilesDodged,1);
  assert.equal(s.run.hits,0);assert.deepEqual(played,['bomb']);assert.equal(attempts,1);
  assert.equal(s.quoteDirector.counts.bomb,1);assert.equal(game().pendingWar,null);
  advance(2);assert.deepEqual(played,['bomb']);assert.equal(attempts,1,'unchanged counter cannot replay');
});
check('real missile-dodge event can still choose either existing winning quote',()=>{
  for(const [random,id] of [[0,'winning'],[.5,'winbig'],[.999,'bomb']]){
    const s=fresh(random);load(...DODGE_QUOTES);launchMissile();advance(3.25);
    assert.equal(s.run.missilesDodged,1);assert.deepEqual(played,[id]);assert.equal(s.quoteDirector.counts[id],1);
  }
});
check('dodge quote waits for the last unresolved missile in a real paired salvo',()=>{
  const s=fresh();load('bomb');const missiles=launchMissile({z:-915});
  assert.equal(missiles.length,2);missiles[1].impactAt+=.4;
  advance(3.25);assert.equal(s.run.missilesDodged,1);assert.equal(missiles[1].resolved,false);
  assert.deepEqual(played,[]);expectPristine();
  advance(.45);assert.equal(s.run.missilesDodged,2);assert.deepEqual(played,['bomb']);
});
check('existing incoming war speech suppresses the following real dodge without overlap',()=>{
  const s=fresh();load('war','bomb');launchMissile();assert.deepEqual(played,['war']);
  const before=snapshot(s.quoteDirector);advance(3.25);
  assert.equal(s.run.missilesDodged,1);assert.deepEqual(played,['war']);
  assert.deepEqual(snapshot(s.quoteDirector),before);
  advance(3);assert.deepEqual(played,['war'],'suppressed dodge is not queued for stale playback');
});
check('actual missile hit and delayed setback never select the dodge-only clip',()=>{
  const s=fresh();load('bomb');const [missile]=launchMissile();
  s.run.x=missile.x;s.run.z=missile.z;advance(3.25);advance(1);
  assert.equal(s.run.hits,1);assert.equal(s.run.missilesDodged,0);
  assert.deepEqual(played,[]);assert.equal(attempts,0);expectPristine();
});
check('drone-escape event wiring does not use bomb even with only that buffer loaded',()=>{
  const s=fresh();load('bomb');s.run.time=40;s.run.droneDodges++;advance(1/60);
  assert.deepEqual(played,[]);assert.equal(attempts,0);expectPristine();
});
check('missing dodge buffer does not consume eligibility or replay after late loading',()=>{
  const s=fresh();launchMissile();advance(3.25);
  assert.equal(s.run.missilesDodged,1);assert.equal(attempts,0);expectPristine();
  load('bomb');advance(.5);assert.deepEqual(played,[]);expectPristine();
  launchMissile({time:100});advance(3.25);
  assert.equal(s.run.missilesDodged,2);assert.deepEqual(played,['bomb']);assert.equal(s.quoteDirector.counts.bomb,1);
});
check('rejected or throwing playback preserves eligibility until a later real dodge',()=>{
  for(const rejection of ['reject','throw']){
    const s=fresh();load('bomb');mode=rejection;launchMissile();advance(3.25);
    assert.equal(s.run.missilesDodged,1);assert.equal(attempts,1);assert.deepEqual(played,[]);expectPristine();
    mode='accept';advance(.5);assert.equal(attempts,1,'failed dodge is not queued');expectPristine();
    launchMissile({time:100});advance(3.25);
    assert.deepEqual(played,['bomb']);assert.equal(s.quoteDirector.counts.bomb,1);
  }
});
check('muted dodge consumes nothing and unmuting cannot replay the stale event',()=>{
  const s=fresh();load('bomb');el('audio').click();launchMissile();advance(3.25);
  assert.equal(s.run.missilesDodged,1);assert.equal(attempts,0);expectPristine();
  el('audio').click();advance(.5);assert.deepEqual(played,[]);expectPristine();
  launchMissile({time:100});advance(3.25);
  assert.deepEqual(played,['bomb']);assert.equal(s.quoteDirector.counts.bomb,1);
});
check('game integration enforces shared cooldown and no repeats after accepted bomb',()=>{
  const s=fresh();load(...DODGE_QUOTES);s.run.time=40;
  assert.equal(s.archiveMoment('missileDodge'),true);assert.deepEqual(played,['bomb']);
  const before=snapshot(s.quoteDirector);
  for(const at of [s.quoteDirector.activeUntil-.001,s.quoteDirector.activeUntil,s.quoteDirector.nextAt-.001]){
    s.run.time=at;assert.equal(s.archiveMoment('missileDodge'),false);
    assert.deepEqual(snapshot(s.quoteDirector),before);assert.equal(attempts,1);
  }
  s.run.time=s.quoteDirector.nextAt;assert.equal(s.archiveMoment('missileDodge'),true);
  assert.deepEqual(played,['bomb','winbig']);
});
check('pause and help reject direct dodge playback without spending it',()=>{
  for(const pausedState of ['paused','help']){
    fresh();load('bomb');
    if(pausedState==='paused')globalHandlers.get('blur')();else el('help').click();
    assert.equal(game().state,pausedState);assert.equal(game().archiveMoment('missileDodge'),false);
    assert.equal(attempts,0);expectPristine();
  }
});
check('loss and victory block dodge playback before and after the frame displays the end',()=>{
  for(const ending of ['lost','won']){
    const s=fresh();load('bomb');s.run.state=ending;s.run.missilesDodged++;
    assert.equal(game().state,'playing','display state has not caught up yet');
    assert.equal(s.archiveMoment('missileDodge'),false);expectPristine();
    advance(1/60);assert.equal(game().state,ending);
    assert.equal(s.archiveMoment('missileDodge'),false);advance(4);
    assert.deepEqual(played,[]);assert.equal(attempts,0);expectPristine();
  }
});
check('restart clears dodge history and stale counters, then accepts a new real dodge',()=>{
  const s=fresh();load('bomb');launchMissile();advance(3.25);
  assert.deepEqual(played,['bomb']);assert.equal(s.quoteDirector.counts.bomb,1);
  el('restart').click();assert.notEqual(game().run,s.run);expectPristine();
  assert.equal(game().run.missilesDodged,0);advance(.2);
  assert.deepEqual(played,['bomb'],'old dodge is not replayed on reset');
  launchMissile();advance(3.25);
  assert.deepEqual(played,['bomb','bomb']);assert.equal(game().quoteDirector.counts.bomb,1);
});

// Observe complete voyages using the established route pilot and actual physics.
// Quote events follow the production counter ordering and unresolved-missile guard.
// Unlike the headless integration above, this observes the director directly so
// 100 route/RNG combinations can run without rendering a scene on every frame.
let routeSource=await fs.readFile(new URL('./harder-route-simulate.mjs',import.meta.url),'utf8');
routeSource=routeSource.replace("from './dist/logic.js'",`from ${JSON.stringify(new URL('./dist/logic.js',import.meta.url).href)}`);
const routeStep='stepRun(run,pilot(run,{throttle,...options}),dt);';
assert(routeSource.includes(routeStep),'route simulation step marker must exist');
routeSource=routeSource.replace(routeStep,`${routeStep}\n    options.onStep?.(run);`);
const {simulateHarderRoute:simulate}=await import('data:text/javascript;base64,'+Buffer.from(routeSource).toString('base64'));
let routesWithBomb=0;
check('complete natural voyages can select bomb while preserving war priority and speech safeguards',()=>{
  for(let seed=1;seed<=100;seed++){
    let rng=seed,lastMissile=0,hits=0,droneDodges=0,missileDodges=0,setbackAt=Infinity;
    let firstMissileAt=null,firstWarAt=null;
    const playedOnRoute=[];
    const q=new QuoteDirector(()=>{rng=(Math.imul(1664525,rng)+1013904223)>>>0;return rng/2**32;});
    const supportSeed=[0,1,8,5][seed%4];
    const result=simulate({supportSeed,throttle:supportSeed===0?.9:1,intercept:true,dt:1/60,onStep(run){
      function event(kind){
        if(run.state!=='playing')return;
        if(kind!=='incomingMissile'&&run.missiles.some(m=>!m.resolved))return;
        const before=snapshot(q),clip=q.choose(kind,run.time,()=>true);
        if(!clip)return;
        assert(run.time>=before.activeUntil,`seed ${seed} cannot overlap active speech`);
        assert(run.time>=before.nextAt||(kind==='incomingMissile'&&before.counts.war===0),`seed ${seed} preserves cooldown except first war`);
        assert.notEqual(clip.id,before.last,`seed ${seed} cannot repeat the previous quote`);
        assert(q.counts[clip.id]<=2,`seed ${seed} respects each short clip's cap`);
        if(clip.id==='bomb'){
          assert.equal(kind,'missileDodge');assert(run.missilesDodged>0);
          assert(!run.missiles.some(m=>!m.resolved),'natural bomb follows safe missile resolution');
        }
        if(clip.id==='war'&&firstWarAt===null)firstWarAt=run.time;
        playedOnRoute.push({id:clip.id,event:kind,time:run.time});
      }
      if(run.missileId>lastMissile){lastMissile=run.missileId;firstMissileAt??=run.time;event('incomingMissile');}
      if(run.hits>hits){hits=run.hits;setbackAt=run.time+.75;}
      if(run.droneDodges>droneDodges){droneDodges=run.droneDodges;event('droneEscape');}
      if(run.missilesDodged>missileDodges){missileDodges=run.missilesDodged;event('missileDodge');}
      if(run.time>=setbackAt){setbackAt=Infinity;event('setback');}
    }});
    assert.equal(result.state,'won',`seed ${seed} completes its natural route`);
    assert.notEqual(firstWarAt,null,`seed ${seed} must select the first-warning quote`);
    assert.equal(firstWarAt,firstMissileAt,`seed ${seed} preserves immediate first-warning priority`);
    if(playedOnRoute.some(clip=>clip.id==='bomb'))routesWithBomb++;
    if(seed===3)assert(playedOnRoute.some(clip=>clip.id==='bomb'),'known natural route must exercise bomb, not just direct test events');
  }
  assert(routesWithBomb>0,'accepted natural playback must not starve the new dodge quote');
});

console.log(`PASS: ${checks} missile-dodge quote checks, including real event wiring and 100 complete routes (${routesWithBomb} selecting bomb).`);
