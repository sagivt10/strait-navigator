import assert from 'node:assert/strict';
import {simulateHarderRoute} from './harder-route-simulate.mjs';
const cases=[
  {supportSeed:0,kinds:['boost','boost'],shots:[5],throttle:.9},
  {supportSeed:1,kinds:['intercept','boost'],shots:[5,6]},
  {supportSeed:8,kinds:['boost','intercept'],shots:[5,6]},
  {supportSeed:11,kinds:['intercept','intercept'],shots:[2,4,5],useAmmoEarly:true},
];
for(const dt of[1/60,1/30,1/20])for(const {supportSeed,kinds,shots,useAmmoEarly=false,throttle=1} of cases){
  const r=simulateHarderRoute({dt,supportSeed,useAmmoEarly,throttle});
  assert.equal(r.state,'won');assert(r.health>=1);assert.equal(r.nearBankFrames,0);
  assert.equal(r.pickups.length,2,'both automatic rewards must be physically collected');
  assert.deepEqual(r.pickups.map(p=>p.kind),kinds);assert.equal(r.deliveries.length,2);assert.deepEqual(r.shots.map(s=>s.id),shots);
  assert.equal(r.shots.length,1+kinds.filter(kind=>kind==='intercept').length,'all and only earned interception ammo is used');
  assert.equal(r.maxSpeed,(kinds.includes('boost')?28:14)*throttle);
  console.log(`PASS: ${1/dt}fps seed ${supportSeed} (${kinds.join(' → ')}): ${r.seconds}s, ${r.health} health, two physical pickups, ${r.shots.length} interceptions, zero bank contacts.`);
}
