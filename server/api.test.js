import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi, BOARD_VERSION, MAX_BODY_BYTES } from './api.js';
import { StoreError, createSupabaseStore } from './store.js';
import { createRun, stepRun } from '../dist/logic.js';
import { REPLAY_VERSION, replayRun } from '../dist/replay.js';

function harness() {
  let clock = Date.parse('2026-11-05T00:00:00Z');
  const verifiedRuns = new Map();
  const runs = new Map(), entries = new Map(), counts = new Map();
  const board = () => {
    const sorted = [...entries.values()].sort((a,b) => b.score-a.score || a.time-b.time || b.health-a.health || a.submittedAt.localeCompare(b.submittedAt) || a.id.localeCompare(b.id)).map((e,i)=>({...e,rank:i+1}));
    return {entries:sorted.slice(0,100),total:sorted.length,version:BOARD_VERSION};
  };
  const store = {
    async rate(key,scope,limit,seconds) { const bucket=`${key}:${scope}:${Math.floor(clock/1000/seconds)}`; const n=(counts.get(bucket)||0)+1;counts.set(bucket,n);return n<=limit; },
    async create(r) { runs.set(r.id,{...r,submitted:false});return r; },
    async get(id) { return runs.get(id)||null; },
    async board() { return board(); },
    async submit(p) {
      // Synchronous mutation simulates the database transaction's serialized lock.
      const r=runs.get(p.id);
      if(r.submitted && r.digest!==p.digest)throw new StoreError('conflict');
      if(!r.submitted){if(Date.parse(r.expires_at)<clock)throw new StoreError('expired');r.submitted=true;r.digest=p.digest;verifiedRuns.set(r.id,p.verified_run);const s=p.result;entries.set(r.id,{id:r.id,name:p.name,score:s.total,total:s.total,time:s.time,health:s.health,status:s.status,submittedAt:new Date(clock).toISOString(),version:BOARD_VERSION});}
      const b=board(),entry=b.entries.find(e=>e.id===r.id);return {entry,rank:entry.rank,board:b,verifiedRun:verifiedRuns.get(r.id)};
    },
  };
  const handle=createApi({store,env:{LEADERBOARD_RATE_SALT:'test-only-salt-abcdefghijklmnopqrstuvwxyz'},now:()=>clock});
  const call=async(path,method='GET',body,headers={})=>{
    const req=new Request(`https://game.example${path}`,{method,...(body===undefined?{}:{body:typeof body==='string'?body:JSON.stringify(body)}),headers:{'content-type':'application/json',...headers}});
    const response=await handle(req,{ip:'192.0.2.1'});return {status:response.status,data:await response.json(),headers:response.headers};
  };
  return {call,runs,entries,advance:ms=>clock+=ms,store};
}
function lostReplay(seed) {
  const run=createRun({supportSeed:seed}),events=[];
  for(let i=0;i<12000 && !['lost','won'].includes(run.state);i++){events.push([.05,1,0]);stepRun(run,{throttle:1,steer:0},.05);}
  assert.equal(run.state,'lost');return {version:REPLAY_VERSION,events};
}
async function challenge(h){const r=await h.call('/api/runs','POST');assert.equal(r.status,201);return r.data;}
const submit=(h,c,replay,extra={})=>h.call(`/api/runs/${c.id}/submit`,'POST',{token:c.token,name:'Captain Test',replay,...extra});

test('issue opaque challenge, submit actual replay, ignore forged scores, safe concurrent retry',async()=>{
 const h=harness(),c=await challenge(h),replay=lostReplay(c.seed),expected=replayRun(c.seed,replay).result;
 assert.equal(c.version,REPLAY_VERSION);assert.equal(c.token.length,43);assert(!JSON.stringify(c).includes('token_hash'));
 h.advance(600000);
 const results=await Promise.all([submit(h,c,replay,{score:999999,total:999999,status:'won',health:2}),submit(h,c,replay)]);
 for(const r of results){assert.equal(r.status,200);assert.equal(r.data.entry.score,expected.total);assert.equal(r.data.entry.status,'lost');assert.equal(r.data.verifiedRun.state,'lost');assert.equal(r.data.verifiedRun.time,expected.time);}
 assert.equal(h.entries.size,1);assert.equal(results[0].data.entry.id,results[1].data.entry.id);
 h.advance(3600000);assert.equal((await submit(h,c,replay)).status,200,'exact retry succeeds after expiry');
 assert.equal((await submit(h,c,replay,{name:'Different'})).status,409);
 const board=await h.call('/api/leaderboard');assert.equal(board.data.total,1);assert.equal(board.headers.get('cache-control'),'no-store');assert(!JSON.stringify(board.data).includes(c.token));
});
test('wrong token, old version, nonterminal, bad controls, too-fast and expired rejected',async()=>{
 const h=harness(),c=await challenge(h),replay=lostReplay(c.seed);
 assert.equal((await submit(h,c,replay,{token:'bad'})).status,403);
 assert.equal((await submit(h,c,{...replay,version:'old'})).status,409);
 assert.equal((await submit(h,c,{version:REPLAY_VERSION,events:[[.05,0,0]]})).status,422);
 assert.equal((await submit(h,c,{version:REPLAY_VERSION,events:[[.051,1,0]]})).status,422);
 assert.equal((await submit(h,c,replay)).status,422);
 h.advance(1800001);assert.equal((await submit(h,c,replay)).status,410);assert.equal(h.entries.size,0);
});
test('every finished voyage separate even for the same name, deterministic ranks',async()=>{
 const h=harness(),a=await challenge(h),b=await challenge(h);h.advance(600000);
 assert.equal((await submit(h,a,lostReplay(a.seed))).status,200);assert.equal((await submit(h,b,lostReplay(b.seed))).status,200);
 const result=(await h.call('/api/leaderboard')).data;assert.equal(result.total,2);assert.deepEqual(result.entries.map(e=>e.rank),[1,2]);
});
test('payload caps, invalid JSON, content type, cross-origin, malformed route, durable limits',async()=>{
 const h=harness(),c=await challenge(h);
 assert.equal((await h.call(`/api/runs/${c.id}/submit`,'POST','{')).status,400);
 assert.equal((await h.call(`/api/runs/${c.id}/submit`,'POST','{}',{'content-type':'text/plain'})).status,415);
 assert.equal((await h.call(`/api/runs/${c.id}/submit`,'POST',' '.repeat(MAX_BODY_BYTES+1))).status,413);
 assert.equal((await h.call('/api/runs','POST',undefined,{origin:'https://evil.example'})).status,403);
 assert.equal((await h.call('/api/runs/nope/submit','POST',{})).status,404);
 for(let i=1;i<120;i++)assert.equal((await h.call('/api/runs','POST')).status,201);
 assert.equal((await h.call('/api/runs','POST')).status,429);
});
test('storage outage is retryable and does not expose server errors',async()=>{
 const h=harness();h.store.board=()=>{throw new Error('DO NOT EXPOSE SECRET');};
 const r=await h.call('/api/leaderboard');assert.equal(r.status,503);assert(!JSON.stringify(r.data).includes('SECRET'));
});
test('server secret key not sent as JWT, legacy key supported, RPC errors sanitized',async()=>{
 for(const secret of [true,false]){
 let init;
 const store=createSupabaseStore({SUPABASE_URL:'https://example.supabase.co',...(secret?{SUPABASE_SECRET_KEY:'sb_secret_test'}:{SUPABASE_SERVICE_ROLE_KEY:'legacy.jwt'})},async(_,options)=>{init=options;return new Response(JSON.stringify({entries:[]}));});
 await store.board(BOARD_VERSION);assert.equal(init.headers.apikey,secret?'sb_secret_test':'legacy.jwt');assert.equal(init.headers.Authorization,secret?undefined:'Bearer legacy.jwt');
 }
 const store=createSupabaseStore({SUPABASE_URL:'https://example.supabase.co',SUPABASE_SECRET_KEY:'sb_secret_test'},async()=>new Response('secret error',{status:500}));
 await assert.rejects(()=>store.board(BOARD_VERSION),e=>e.code==='unavailable');
});
test('uncertain committed submission can be recovered without a second row',async()=>{
 const h=harness(),c=await challenge(h),replay=lostReplay(c.seed);h.advance(600000);
 const submitOnce=h.store.submit;let failOnce=true;
 h.store.submit=async p=>{const result=await submitOnce(p);if(failOnce){failOnce=false;throw new StoreError('unavailable');}return result;};
 assert.equal((await submit(h,c,replay)).status,503);assert.equal(h.entries.size,1);
 const retry=await submit(h,c,replay);assert.equal(retry.status,200);assert.equal(retry.data.entry.id,c.id);assert.equal(h.entries.size,1);
});
test('token belongs to exactly one challenge and changed replay cannot overwrite an accepted run',async()=>{
 const h=harness(),a=await challenge(h),b=await challenge(h),replay=lostReplay(a.seed);h.advance(600000);
 assert.equal((await submit(h,a,replay,{token:b.token})).status,403);
 assert.equal((await submit(h,a,replay)).status,200);
 const changed=structuredClone(replay);changed.events[0][2]=.1;
 assert.equal((await submit(h,a,changed)).status,409);assert.equal(h.entries.size,1);
});
test('empty names sanitize safely; overlong names and oversized event arrays rejected',async()=>{
 const h=harness(),c=await challenge(h),replay=lostReplay(c.seed);h.advance(600000);
 assert.equal((await submit(h,c,replay,{name:'x'.repeat(257)})).status,400);
 assert.equal((await submit(h,c,{version:REPLAY_VERSION,events:Array.from({length:100001},()=>[0,0,0])})).status,400);
 const r=await submit(h,c,replay,{name:'<script>\u202e\u0000'});assert.equal(r.status,200);assert.equal(r.data.entry.name,'script');
});
