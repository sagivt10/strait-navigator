import assert from 'node:assert/strict';
import {LeaderboardClient} from './dist/leaderboard-client.js';
import {ReplayOutbox} from './dist/replay-outbox.js';
import {REPLAY_VERSION} from './dist/replay.js';
import {liveScoreMarkup,leaderboardMarkup} from './dist/live-score-view.js';
const challenge={id:'run-1',token:'opaque',seed:5,version:REPLAY_VERSION,expiresAt:'2030-01-01T00:00:00Z'};
const replay={version:REPLAY_VERSION,events:[[.05,1,0]]};
const saved=new Map(),outbox={async list(){return [...saved.values()]},async put(item){saved.set(item.challenge.id,structuredClone(item))},async delete(id){saved.delete(id)}};
let calls=[],fail=1;
const entry={id:'run-1',name:'Captain',rank:1,score:150,time:20,health:0,status:'lost'};
const client=new LeaderboardClient({outbox,wait:async()=>{},fetcher:async(path,init)=>{
 calls.push({path,body:init.body});if(path.endsWith('/runs'))return Response.json(challenge);
 if(fail-- >0)throw new Error('offline');return Response.json({entry,rank:1,board:{entries:[entry],total:1}});
}});
assert.deepEqual(await client.begin(),challenge);
const item=client.queue(challenge,'Captain',replay);await item.persistence;assert(item.persisted);assert.equal(saved.size,1);
const [a,b]=await Promise.all([client.submit(item),client.submit(item)]);assert.equal(a.entry.id,b.entry.id);assert.equal(calls.filter(c=>c.path.endsWith('/submit')).length,2);assert.equal(saved.size,0);assert.equal(calls[1].body,calls[2].body,'retry uses exact same run token/replay');
const permanent=new LeaderboardClient({outbox,wait:async()=>{},fetcher:async()=>Response.json({error:{message:'expired'}},{status:410})});
const expired={...challenge,expiresAt:'2000-01-01T00:00:00Z'};saved.set(challenge.id,{challenge:expired,body:{token:expired.token,name:'Captain',replay}});
const results=await permanent.retryPending();assert.equal(results.length,1);assert.equal(results[0].status,'rejected');assert.equal(saved.size,0,'expired item is checked with server, then removed');
const brokenStorage={async list(){throw Error('blocked')},async put(){throw Error('full')},async delete(){throw Error('blocked')}};
const offline=new LeaderboardClient({outbox:brokenStorage,wait:async()=>{},fetcher:async()=>{throw Error('offline')}});
assert.equal(await offline.begin(),null);assert.deepEqual(await offline.retryPending(),[]);
const pending=offline.queue(challenge,'Captain',replay);await assert.rejects(()=>offline.submit(pending));assert.equal(pending.persisted,false);assert(offline.pending.has(challenge.id));
const many=new LeaderboardClient({outbox,wait:async()=>{},fetcher:async()=>{throw Error('offline')}});
for(let i=0;i<5;i++)await many.queue({...challenge,id:`run-${i}`},'Captain',replay).persistence;
assert.equal(saved.size,5,'no silent last-three eviction');
const html=liveScoreMarkup({state:'lost',time:10,health:0,hits:2,distance:50},{state:'saved',entry:{...entry,rank:88},board:{entries:[entry],total:100}});
assert(html.includes('Your voyage ranks 88 of 100'));assert(!html.includes('Fictional sample'));assert(!html.includes('DEMO'));assert(!html.includes('No upload'));
const safe=leaderboardMarkup({entries:[{...entry,name:'<img src=x onerror=alert(1)>'}],total:1});assert(!safe.includes('<img'));
const outside=leaderboardMarkup({entries:[entry],total:100,current:{...entry,id:'different',rank:88}});assert(outside.includes('>88</span>'));assert(!outside.includes('data-final-position="88"'));
console.log('PASS: challenge fallback, exact idempotent retry, concurrent submission dedupe, persistent outbox >3 entries, expired receipt recovery, storage-denial safety, live labels/global rank/XSS.');

const priorIDB=Object.getOwnPropertyDescriptor(globalThis,'indexedDB');
try{Object.defineProperty(globalThis,'indexedDB',{configurable:true,get(){throw Error('SecurityError');}});const denied=new ReplayOutbox();await assert.rejects(()=>denied.list());new LeaderboardClient();}finally{if(priorIDB)Object.defineProperty(globalThis,'indexedDB',priorIDB);else delete globalThis.indexedDB;}
console.log('PASS: blocked IndexedDB getter cannot prevent game initialization.');
