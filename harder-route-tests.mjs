import assert from 'node:assert/strict';
import {COURSE_LENGTH,DOCK,DRONES,MISSILE_ZONES,channelAt,createRun,droneAt,stepRun} from './dist/logic.js';
import {simulateHarderRoute} from './harder-route-simulate.mjs';
let checks=0;
function check(name,fn){fn();checks++;console.log(`PASS: ${name}`);}

check('1.8km route retains two single introductions and the enlarged original finale',()=>{
  assert.equal(COURSE_LENGTH,1800);assert.equal(DRONES.length,9);
  assert.equal(DRONES[0].z,-230);assert.equal(DRONES[1].z,-430);
  assert(!DRONES[0].pair&&!DRONES[1].pair);
  assert.equal(DRONES[5].z,-1605);assert.equal(DRONES[6].z,-1640);
  assert.equal(DRONES[5].radius,34);assert.equal(DRONES[6].radius,34);
});
check('three separate paired-drone sectors with moderate mid-route scan radii',()=>{
  const pairs=new Map();
  for(const [id,d] of DRONES.entries())if(d.pair){if(!pairs.has(d.pairCenterZ))pairs.set(d.pairCenterZ,[]);pairs.get(d.pairCenterZ).push({id,...d});}
  assert.equal(pairs.size,3);
  for(const group of pairs.values()){
    assert.equal(group.length,2);assert.equal(Math.abs(group[0].z-group[1].z),35);
    assert.equal(group[0].period,group[1].period);assert.equal(group[0].phase,group[1].phase);
    assert.equal(group[0].pairOffset,-group[1].pairOffset);
    if(group[0].pairCenterZ>-1500)for(const d of group)assert(d.radius>=18&&d.radius<=22);
  }
});
check('paired patrols use their own curved-channel center at every sampled phase',()=>{
  for(const d of DRONES.filter(d=>d.pair))for(let time=0;time<46;time+=.25){
    const p=droneAt(d,time),ch=channelAt(d.pairCenterZ);
    assert(Number.isFinite(p.x)&&Number.isFinite(p.z));
    assert(Math.abs(p.x-ch.center)<ch.halfWidth);
    const counterpart=DRONES.find(other=>other!==d&&other.pairCenterZ===d.pairCenterZ);
    const q=droneAt(counterpart,time);assert(Math.abs((q.x-p.x)-(counterpart.pairOffset-d.pairOffset))<1e-9);
  }
});
check('original salvos keep their indices and two added gaps preserve the single-to-pair introduction',()=>{
  assert.equal(MISSILE_ZONES[0].z,-630);assert(!MISSILE_ZONES[0].paired);
  assert.deepEqual(MISSILE_ZONES.slice(0,4).map(zone=>zone.z),[-630,-915,-1215,-1490]);
  assert.equal(MISSILE_ZONES.length,6);assert.equal(MISSILE_ZONES.filter(zone=>zone.paired).length,4);
  assert.deepEqual(MISSILE_ZONES.slice(4),[{z:-350,side:1,triggerRange:22},{z:-1705,side:1,paired:true,triggerRange:22}]);
  const run=createRun();assert.equal(run.missileCooldowns.length,MISSILE_ZONES.length);
  for(const zone of MISSILE_ZONES){
    const r=createRun();r.z=zone.z;r.x=channelAt(zone.z).center;stepRun(r,{},1/60);
    assert.equal(r.missiles.length,zone.paired?2:1);
    if(zone.paired){const[a,b]=r.missiles,ch=channelAt(zone.z);assert((a.fromX-ch.center)*(b.fromX-ch.center)<0);}
  }
});
check('all salvo targets are separate fixed circles with3.2sec warning and an open lane',()=>{
  for(const zone of MISSILE_ZONES)for(const offset of[-28,0,28]){
    const run=createRun();run.z=zone.z;run.x=channelAt(zone.z).center+offset;stepRun(run,{},1/60);
    const fixed=run.missiles.map(m=>({id:m.id,x:m.x,z:m.z}));
    for(const m of run.missiles){assert(m.impactAt-m.start>=3.2-1e-9);assert.equal(m.radius,10);assert.equal(m.resolved,false);}
    if(zone.paired){
      const[a,b]=run.missiles;assert(Math.hypot(a.x-b.x,a.z-b.z)>a.radius+b.radius+4,'hit circles must not overlap into one wall');
      const ch=channelAt(a.z),left=ch.center-ch.halfWidth+5,right=ch.center+ch.halfWidth-5;
      assert([left,right].some(x=>run.missiles.every(m=>Math.abs(x-m.x)>m.radius+2)),'at least one bank-side navigable lane remains outside both circles');
    }
    run.x+=6;for(let n=0;n<120;n++)stepRun(run,{},1/60);
    for(const original of fixed){const m=run.missiles.find(m=>m.id===original.id);assert.equal(m.x,original.x);assert.equal(m.z,original.z);}
  }
});
check('paired salvos cannot repeat during their telegraph and existing damage cooldown remains',()=>{
  const run=createRun(),zone=MISSILE_ZONES.find(z=>z.paired);run.z=zone.z;run.x=channelAt(zone.z).center;
  stepRun(run,{},1/60);const ids=run.missileId;
  for(let n=0;n<180;n++)stepRun(run,{},1/60);assert.equal(run.missileId,ids);
  assert(run.missileCooldowns[MISSILE_ZONES.indexOf(zone)]-run.missiles[0].start>=11.5);
});

const routes=[];
const cases=[
  {supportSeed:0,kinds:['boost','boost'],health:1,shots:[5],throttle:.9},
  {supportSeed:1,kinds:['intercept','boost'],health:1,shots:[5,6]},
  {supportSeed:8,kinds:['boost','intercept'],health:1,shots:[5,6]},
  {supportSeed:11,kinds:['intercept','intercept'],health:1,shots:[2,4,5],useAmmoEarly:true},
];
for(const dt of[1/20,1/30,1/60])for(const example of cases){
  const {supportSeed,kinds,health,shots,useAmmoEarly=false,throttle=1}=example;
  check(`${Math.round(1/dt)}fps complete route with automatic ${kinds.join(' then ')} physically collected`,()=>{
    const r=simulateHarderRoute({dt,supportSeed,useAmmoEarly,throttle});routes.push(r);
    assert.equal(r.state,'won');assert.equal(r.health,health);assert.equal(r.nearBankFrames,0);
    assert.equal(r.z,DOCK.z);assert.equal(r.x,DOCK.x);assert.equal(r.maxSpeed,(kinds.includes('boost')?28:14)*throttle);
    assert.equal(r.supportEarned,2);assert.equal(r.dispatches.length,2);assert.equal(r.deliveries.length,2);assert.equal(r.pickups.length,2);assert.equal(r.ignored.length,0);
    assert.deepEqual(r.pickups.map(p=>p.kind),kinds);assert.deepEqual(r.shots.map(s=>s.id),shots);
    for(const p of r.pickups){
      const dispatch=r.dispatches.find(q=>q.id===p.id),delivery=r.deliveries.find(q=>q.id===p.id);
      assert(p.at>delivery.at);assert(p.at<delivery.at+45);assert.equal(p.x,dispatch.x);assert.equal(p.z,dispatch.z);
      assert(Math.abs(delivery.at-dispatch.at-3)<1e-9);
    }
    assert(r.missilesDodged>=5);assert(r.seconds>140&&r.seconds<160);
    for(let i=1;i<r.hits.length;i++)assert(r.hits[i].time-r.hits[i-1].time>=3.5-.05);
    console.log(`  ${r.seconds}s; ${r.health} health; two automatic crates collected; ${r.missilesDodged} missiles dodged; no bank contact.`);
  });
}
check('the same seed and visible-input pilot remain consistent across all three frame rates',()=>{
  for(const {supportSeed,kinds,health} of cases){
    const group=routes.filter(r=>r.supportSeed===supportSeed);
    assert(Math.max(...group.map(r=>r.seconds))-Math.min(...group.map(r=>r.seconds))<.3);
    for(const r of group){assert.deepEqual(r.dispatches.map(p=>p.kind),kinds);assert.equal(r.health,health);}
  }
});
for(const dt of[1/20,1/30,1/60])for(const {supportSeed,kinds} of cases){
  check(`${Math.round(1/dt)}fps route safely ignores automatic ${kinds.join(' then ')} and receives the queued drop`,()=>{
    const r=simulateHarderRoute({dt,supportSeed,collect:false,intercept:false});
    assert.equal(r.state,'won');assert.equal(r.health,2);assert.equal(r.shots.length,0);assert.equal(r.nearBankFrames,0);assert.equal(r.maxSpeed,14);
    assert.equal(r.supportEarned,2);assert.equal(r.dispatches.length,2);assert.equal(r.deliveries.length,2);assert.equal(r.pickups.length,0);assert.equal(r.ignored.length,2);
    assert.deepEqual(r.dispatches.map(p=>p.kind),kinds);assert.deepEqual(r.ignored.map(p=>p.kind),kinds);
    assert(r.dispatches[1].at>=r.deliveries[0].at+45);assert(r.dispatches[1].at<=r.deliveries[0].at+45+dt+.001);
  });
}
check('ammo-full eligibility substitutes a useful shield instead of wasting a random ammo drop',()=>{
  const r=simulateHarderRoute({supportSeed:11});
  assert.deepEqual(r.pickups.map(p=>p.kind),['intercept','shield']);assert.equal(r.state,'won');assert.equal(r.shots.length,2);
});
check('100 seeded voyages at each of 20/30/60fps have a winning full or 90% throttle policy, without forced rewards or bank contact',()=>{
  for(const dt of[1/20,1/30,1/60])for(let supportSeed=0;supportSeed<100;supportSeed++){
    const full=simulateHarderRoute({supportSeed,dt});
    const r=full.state==='won'?full:simulateHarderRoute({supportSeed,dt,throttle:.9});
    assert.equal(r.state,'won',`seed ${supportSeed}`);assert(r.health>=1);assert.equal(r.nearBankFrames,0);assert.equal(r.dispatches.length,2);assert.equal(r.pickups.length,2);
    assert(r.shots.length>=1&&r.shots.length<=2);assert.equal(r.maxSpeed,(r.pickups.some(p=>p.kind==='boost')?28:14)*(full.state==='won'?1:.9));
  }
});
check('steady center sailing without evasive inputs still loses to unchanged harder hazards',()=>{
  const r=simulateHarderRoute({avoid:false,collect:false,intercept:false,supportSeed:0});assert.equal(r.state,'lost');assert.equal(r.health,0);assert.equal(r.hits.length,2);
});
console.log(`${checks} harder-route checks passed.`);
