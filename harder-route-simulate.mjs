import {pathToFileURL} from 'node:url';
import {COURSE_LENGTH,DOCK,DRONES,MAX_SPEED,channelAt,createRun,droneAt,stepRun,selectInterceptTarget,fireIntercept} from './dist/logic.js';

// A reproducible player policy using only public run state, visible hazards and
// controls: choose the open bank for the next drone group, steer to announced
// supply coordinates, and save the interception inventory for the final pair.
export function pilot(run,{throttle=1,avoid=true,collect=true,margin=10,lookAhead=45}={}){
  const ahead=channelAt(run.z-lookAhead);
  let targetX=ahead.center,targetZ=run.z-lookAhead;
  const upcoming=DRONES.map((d,id)=>({...d,id})).filter(d=>!run.intercepted.includes(d.id)&&run.z-d.z>-25&&run.z-d.z<120).sort((a,b)=>Math.abs(run.z-a.z)-Math.abs(run.z-b.z));
  if(avoid&&upcoming.length){
    const drone=upcoming[0],eta=Math.max(0,run.z-drone.z)/Math.max(6,run.speed);
    const p=droneAt(drone,run.time+eta),ch=channelAt(drone.z);
    const scanCenter=p.scanX-(drone.pair?drone.pairOffset:0);
    targetX=ahead.center+(scanCenter>ch.center?-1:1)*(ahead.halfWidth-margin);
  }
  // Pick the bank with most room from the complete fixed salvo, rather than
  // switching direction for each of two simultaneous warning circles.
  if(avoid){
    const threats=run.missiles.filter(m=>!m.resolved&&m.z<run.z+15&&m.z>run.z-100);
    if(threats.length){
      const left=ahead.center-ahead.halfWidth+margin,right=ahead.center+ahead.halfWidth-margin;
      const clearance=x=>Math.min(...threats.map(m=>Math.abs(x-m.x)));
      targetX=clearance(left)>clearance(right)?left:right;
    }
  }
  const drop=collect&&(run.supportPending||run.supportDrop);
  if(drop){targetX=drop.x;targetZ=drop.z;}
  if(run.distance>COURSE_LENGTH-80){targetX=DOCK.x;targetZ=run.z-lookAhead;}
  const forward=Math.max(drop?10:lookAhead,run.z-targetZ);
  const desired=Math.atan2(-(targetX-run.x),forward);
  let error=desired-run.heading;
  while(error>Math.PI)error-=Math.PI*2;
  while(error<-Math.PI)error+=Math.PI*2;
  return{throttle:run.distance>COURSE_LENGTH-60?.18:throttle,steer:Math.max(-1,Math.min(1,-error*3))};
}

export function simulateHarderRoute({dt=1/30,throttle=1,supportSeed=0,intercept=true,useAmmoEarly=false,...options}={}){
  const run=createRun({supportSeed});
  const hits=[],dispatches=[],deliveries=[],pickups=[],ignored=[],shots=[];
  let maxSpeed=0,nearBankFrames=0,lastDispatched=0,lastDelivered=0,lastCollected=0,lastIgnored=0;
  const route=[];
  for(let frame=0;frame<320/dt&&['playing','docking'].includes(run.state);frame++){
    const target=selectInterceptTarget(run);
    if(intercept&&((run.z<-1470&&[5,6].includes(target))||(useAmmoEarly&&run.interceptsLeft===2&&target>=0))){
      if(fireIntercept(run))shots.push({...run.lastIntercept});
    }
    const oldHits=run.hits;
    stepRun(run,pilot(run,{throttle,...options}),dt);
    if(run.supportDispatched!==lastDispatched){lastDispatched=run.supportDispatched;dispatches.push({...run.lastSupportDispatch});}
    if(run.supportIgnored!==lastIgnored){lastIgnored=run.supportIgnored;ignored.push({...run.lastSupportIgnored});}
    if(run.hits>oldHits)hits.push({z:+run.z.toFixed(2),time:+run.time.toFixed(2),cause:run.lastHit,drone:run.activeDrone});
    if(run.supportDelivered!==lastDelivered){lastDelivered=run.supportDelivered;deliveries.push({...run.lastSupportDelivery});}
    if(run.supportCollected!==lastCollected){lastCollected=run.supportCollected;pickups.push({...run.lastSupportPickup});}
    maxSpeed=Math.max(maxSpeed,run.speed);
    if(run.nearBank)nearBankFrames++;
    if(frame%Math.round(1/dt)===0)route.push({time:+run.time.toFixed(2),x:+run.x.toFixed(2),z:+run.z.toFixed(2),health:run.health});
  }
  return{state:run.state,health:run.health,hits,seconds:+run.time.toFixed(2),z:+run.z.toFixed(2),x:+run.x.toFixed(2),missilesDodged:run.missilesDodged,nearBankFrames,maxSpeed:+maxSpeed.toFixed(2),supportEarned:run.supportEarned,supportPassedDrones:run.supportPassedDrones,supportSeed:run.supportSeed,dispatches,deliveries,pickups,ignored,shots,route};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  for(const dt of[1/20,1/30,1/60])for(const supportSeed of[0,1,5,8]){
    const {route,...result}=simulateHarderRoute({dt,supportSeed});
    console.log(JSON.stringify({fps:1/dt,...result}));
  }
}
