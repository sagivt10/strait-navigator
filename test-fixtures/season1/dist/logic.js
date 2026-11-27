export const COURSE_LENGTH=1800, CHANNEL_HALF_WIDTH=54, MAX_SPEED=14;
export const INTERCEPT_RANGE=220;
export const SUPPORT_DELAY=3, BOOST_DURATION=8, SUPPORT_DOCK_CUTOFF=180;
export const SHIELD_DURATION=15, SHIELD_CHARGES=2;
export const MAX_SUPPORT_EARNED=2, MAX_INTERCEPTS=2, MAX_HEALTH=2, SUPPORT_PASSES_REQUIRED=2;
export const SUPPORT_DROP_LIFETIME=45, SUPPORT_PICKUP_RADIUS=8, SUPPORT_DROP_DISTANCE=70;
export const ROUTE_POINTS=[[0,0,64],[.18,-24,60],[.39,35,48],[.58,93,44],[.76,121,51],[1,58,64]];
export function channelAt(z){const p=Math.max(0,Math.min(1,-z/COURSE_LENGTH));let i=0;while(i<ROUTE_POINTS.length-2&&p>ROUTE_POINTS[i+1][0])i++;const[a,x,w]=ROUTE_POINTS[i],[b,xx,ww]=ROUTE_POINTS[i+1],t=(p-a)/(b-a),s=t*t*(3-2*t);return{center:x+(xx-x)*s,halfWidth:w+(ww-w)*s};}
export const DOCK={x:channelAt(-COURSE_LENGTH).center+10,z:-COURSE_LENGTH-14};
// The original finale keeps IDs 5 and 6. Mid-route partners are appended so that
// interception targets and event histories remain stable across this revision.
export const DRONES=[
  {z:-230,phase:2.4,period:19,height:26,radius:14},
  {z:-430,phase:3.2,period:21,height:29,radius:15},
  {z:-760,phase:1.5,period:18,height:25,radius:20,pair:true,pairCenterZ:-777.5,pairOffset:-15},
  {z:-1020,phase:4.4,period:23,height:29,radius:21,pair:true,pairCenterZ:-1037.5,pairOffset:-15},
  {z:-1360,phase:2,period:21,height:28,radius:16},
  {z:-1605,phase:5,period:22,height:26,radius:34,pair:true,pairCenterZ:-1622.5,pairOffset:-18},
  {z:-1640,phase:5,period:22,height:28,radius:34,pair:true,pairCenterZ:-1622.5,pairOffset:18},
  {z:-795,phase:1.5,period:18,height:27,radius:20,pair:true,pairCenterZ:-777.5,pairOffset:15},
  {z:-1055,phase:4.4,period:23,height:27,radius:21,pair:true,pairCenterZ:-1037.5,pairOffset:15},
];
// Single warnings teach one fixed target. Later gaps fire opposite-bank pairs.
// Their compact, separated circles leave traversable water, not a channel wall.
// Preserve the original first four indices when adding the two quieter gaps.
export const MISSILE_ZONES=[
  {z:-630,side:-1,triggerRange:70},
  {z:-915,side:-1,paired:true,triggerRange:40},
  {z:-1215,side:1,paired:true,triggerRange:50},
  {z:-1490,side:-1,paired:true,triggerRange:45},
  {z:-350,side:1,triggerRange:22},
  {z:-1705,side:1,paired:true,triggerRange:22},
];
function freshSupportSeed(){
  if(globalThis.crypto?.getRandomValues)return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
  return Math.floor(Math.random()*0x100000000)>>>0;
}
export function createRun({supportSeed}={}){
  const seed=Number.isFinite(supportSeed)?supportSeed>>>0:freshSupportSeed();
  return{
  x:0,z:8,heading:0,speed:0,exposure:0,time:0,distance:0,state:'playing',nearBank:false,detected:false,
  health:MAX_HEALTH,hits:0,invulnerable:0,missiles:[],missileCooldowns:MISSILE_ZONES.map(()=>0),missileId:0,
  missilesDodged:0,lastHit:'',lastHitTime:-100,activeDrone:-1,lockStage:'clear',dockProgress:0,dockStart:null,
  droneDodges:0,dodgedDrones:[],failedDrones:[],droneEncounter:null,interceptsLeft:1,intercepted:[],lastIntercept:null,
  supportCharges:0,supportEarned:0,supportProgress:0,supportPassedDrones:[],supportPending:null,supportDrop:null,
  supportSeed:seed,supportRandomState:seed,supportDispatched:0,lastSupportDispatch:null,
  supportDelivered:0,lastSupportDelivery:null,supportCollected:0,lastSupportPickup:null,
  supportIgnored:0,lastSupportIgnored:null,boostUntil:0,
  shieldUntil:0,shieldCharges:0,missilesIntercepted:0,lastShieldIntercept:null,
};}
export function droneAt(drone,time){
  const a=time*Math.PI*2/drone.period+drone.phase;
  if(drone.pair){
    const ch=channelAt(drone.pairCenterZ),x=ch.center+Math.sin(a)*(ch.halfWidth-34)+drone.pairOffset,z=drone.z+Math.cos(a*.5)*3;
    return{x,z,y:drone.height+Math.sin(time*.7+drone.phase)*.8,scanX:x+Math.sin(a*1.7)*2,scanZ:z-3,radius:drone.radius};
  }
  const ch=channelAt(drone.z),span=ch.halfWidth-12;
  return{x:ch.center+Math.sin(a)*span,z:drone.z+Math.cos(a*.5)*5,y:drone.height+Math.sin(time*.7+drone.phase)*.8,scanX:ch.center+Math.sin(a)*span+Math.sin(a*1.7)*4,scanZ:drone.z+Math.cos(a*.5)*5-3,radius:drone.radius};
}
function clearSupport(run){run.supportPending=null;run.supportDrop=null;run.boostUntil=0;run.shieldUntil=0;run.shieldCharges=0;run.lastShieldIntercept=null;}
function shieldActive(run){return run.shieldCharges>0&&run.shieldUntil>run.time;}
function expireShield(run){if(!shieldActive(run)){run.shieldUntil=0;run.shieldCharges=0;}}
export function damage(run,reason){
  if(run.invulnerable>0||run.state!=='playing')return false;
  run.health--;run.hits++;run.invulnerable=3.5;run.lastHit=reason;
  if(reason==='drone'&&run.activeDrone>=0&&!run.failedDrones.includes(run.activeDrone))run.failedDrones.push(run.activeDrone);
  run.lastHitTime=run.time;run.speed*=reason==='missile'?.55:.75;run.exposure=.05;
  if(run.health<=0){run.state='lost';clearSupport(run);}
  return true;
}
// Earn at most two drops from distinct clean forward passages. Existing dodge
// events still drive character/audio feedback, but merely leaving a cone or
// reversing to revisit it cannot earn another support point.
function trackSupportProgress(run){
  for(let id=0;id<DRONES.length;id++){
    const past=DRONES[id].z-run.z;
    if(past<=28||past>=85||run.intercepted.includes(id)||run.failedDrones.includes(id)||!run.dodgedDrones.includes(id)||run.supportPassedDrones.includes(id))continue;
    run.supportPassedDrones.push(id);
    if(run.supportEarned>=MAX_SUPPORT_EARNED)continue;
    run.supportProgress++;
    if(run.supportProgress>=SUPPORT_PASSES_REQUIRED){
      run.supportProgress=0;run.supportEarned++;run.supportCharges=Math.min(MAX_SUPPORT_EARNED,run.supportCharges+1);
    }
  }
}
// A serializable per-run Mulberry32 stream advances only for actual dispatches.
// Frame rate, waiting for space and ignored frames never reroll the reward.
function nextSupportRandom(run){
  let value=run.supportRandomState=(run.supportRandomState+0x6D2B79F5)>>>0;
  value=Math.imul(value^(value>>>15),value|1);
  value^=value+Math.imul(value^(value>>>7),value|61);
  return((value^(value>>>14))>>>0)/0x100000000;
}
function dispatchSupport(run){
  if(run.state!=='playing'||run.supportCharges<1||run.supportPending||run.supportDrop||run.distance>=COURSE_LENGTH-SUPPORT_DOCK_CUTOFF||run.z<=-COURSE_LENGTH+SUPPORT_DOCK_CUTOFF)return;
  const eligible=[];
  if(run.boostUntil<=run.time)eligible.push('boost');
  if(run.interceptsLeft<MAX_INTERCEPTS)eligible.push('intercept');
  if(run.health<MAX_HEALTH)eligible.push('health');
  if(!shieldActive(run))eligible.push('shield');
  if(!eligible.length)return;
  const kind=eligible[Math.floor(nextSupportRandom(run)*eligible.length)];
  const z=run.z-SUPPORT_DROP_DISTANCE,ch=channelAt(z),id=run.supportDispatched+1,side=id%2?1:-1;
  const x=Math.max(ch.center-ch.halfWidth+12,Math.min(ch.center+ch.halfWidth-12,run.x+side*22));
  run.supportCharges--;run.supportDispatched++;
  run.lastSupportDispatch={id,kind,at:run.time,x,z};
  run.supportPending={...run.lastSupportDispatch,deliverAt:run.time+SUPPORT_DELAY};
}
function updateSupportDelivery(run){
  const p=run.supportPending;
  if(p&&run.time>=p.deliverAt){
    run.supportDrop={id:p.id,kind:p.kind,x:p.x,z:p.z,spawnedAt:p.deliverAt,expiresAt:p.deliverAt+SUPPORT_DROP_LIFETIME,radius:SUPPORT_PICKUP_RADIUS};
    run.supportDelivered++;run.lastSupportDelivery={id:p.id,kind:p.kind,at:p.deliverAt,x:p.x,z:p.z};run.supportPending=null;
  }
  if(run.supportDrop&&run.time>=run.supportDrop.expiresAt){
    const d=run.supportDrop;
    run.supportIgnored++;run.lastSupportIgnored={id:d.id,kind:d.kind,at:d.expiresAt,x:d.x,z:d.z};run.supportDrop=null;
  }
}
function collectSupportDrop(run){
  const d=run.supportDrop;
  if(!d||Math.hypot(run.x-d.x,run.z-d.z)>d.radius)return;
  // If an existing inventory has become full, leave the crate available until
  // there is room. Delivery and reward are separate observable events.
  if(d.kind==='intercept'&&run.interceptsLeft>=MAX_INTERCEPTS||d.kind==='boost'&&run.boostUntil>run.time||d.kind==='health'&&run.health>=MAX_HEALTH||d.kind==='shield'&&shieldActive(run))return;
  if(d.kind==='boost')run.boostUntil=run.time+BOOST_DURATION;
  else if(d.kind==='health')run.health=Math.min(MAX_HEALTH,run.health+1);
  else if(d.kind==='shield'){run.shieldUntil=run.time+SHIELD_DURATION;run.shieldCharges=SHIELD_CHARGES;}
  else run.interceptsLeft=Math.min(MAX_INTERCEPTS,run.interceptsLeft+1);
  run.supportCollected++;run.lastSupportPickup={id:d.id,kind:d.kind,at:run.time,x:d.x,z:d.z};run.supportDrop=null;
}
function launchMissiles(run){
  for(let i=0;i<MISSILE_ZONES.length;i++){
    const zone=MISSILE_ZONES[i];
    if(Math.abs(run.z-zone.z)>=zone.triggerRange||run.time<run.missileCooldowns[i])continue;
    const targetZ=run.z-Math.cos(run.heading)*35,targetChannel=channelAt(targetZ),coast=channelAt(zone.z);
    const targetX=Math.max(targetChannel.center-targetChannel.halfWidth+12,Math.min(targetChannel.center+targetChannel.halfWidth-12,run.x));
    const count=zone.paired?2:1;
    for(let shot=0;shot<count;shot++){
      // A second target is offset inward by 27m and 8m along the route. It is
      // fixed at launch, launched from the other coast and never homes in.
      const inward=targetX>targetChannel.center?-1:1;
      const x=shot?Math.max(targetChannel.center-targetChannel.halfWidth+12,Math.min(targetChannel.center+targetChannel.halfWidth-12,targetX+inward*27)):targetX;
      run.missiles.push({id:++run.missileId,start:run.time,impactAt:run.time+3.2,x,z:targetZ-shot*8,fromX:coast.center+zone.side*(shot?-1:1)*(coast.halfWidth+17),fromZ:zone.z,radius:10,resolved:false});
    }
    run.missileCooldowns[i]=run.time+(zone.paired?11.5:9.5);
  }
}
// Fictional automatic defense reacts only to a nearby, imminent fixed-target
// missile. A salvo consumes one charge per missile, never one per frame.
function interceptThreateningMissiles(run,dt){
  for(const m of run.missiles){
    if(!shieldActive(run))break;
    if(m.resolved||run.time<m.impactAt-.8||m.impactAt<run.time-dt||Math.hypot(run.x-m.x,run.z-m.z)>m.radius+8)continue;
    const p=Math.max(0,Math.min(1,(run.time-m.start-.7)/Math.max(.1,m.impactAt-m.start-.7)));
    const event={id:m.id,at:run.time,from:{x:run.x,y:2.4,z:run.z},target:{x:m.fromX+(m.x-m.fromX)*p,y:5*(1-p)+Math.sin(p*Math.PI)*12,z:m.fromZ+(m.z-m.fromZ)*p}};
    m.intercepted=true;m.resolved=true;m.interceptedAt=run.time;m.shieldIntercept=event;
    run.shieldCharges--;run.missilesIntercepted++;run.lastShieldIntercept=event;
    if(run.shieldCharges===0)run.shieldUntil=0;
  }
}
export function stepRun(run,input,dt){
  dt=Number.isFinite(dt)?Math.min(.05,Math.max(0,dt)):0;
  if(dt===0){
    // Retain zero-time sensor refresh for targeting, without advancing any
    // gameplay events, rewards, timers or random state while time is stopped.
    if(run.state==='playing'){
      run.activeDrone=detectDrone(run);run.detected=run.activeDrone>=0;
      run.lockStage=run.detected?(run.exposure>.6?'locked':'acquiring'):'clear';
    }
    return run;
  }
  if(run.state==='docking'){
    clearSupport(run);run.time+=dt;run.dockProgress=Math.min(1,run.dockProgress+dt/3.5);
    const p=run.dockProgress,s=p*p*(3-2*p);
    run.x=run.dockStart.x+(DOCK.x-run.dockStart.x)*s;run.z=run.dockStart.z+(DOCK.z-run.dockStart.z)*s;
    run.heading=run.dockStart.heading*(1-s);run.speed=run.dockStart.speed*(1-s);
    if(p>=1){run.state='won';run.speed=0;}return run;
  }
  if(run.state!=='playing')return run;
  run.time+=dt;run.invulnerable=Math.max(0,run.invulnerable-dt);expireShield(run);updateSupportDelivery(run);
  const throttle=Math.max(-1,Math.min(1,input.throttle||0)),steer=Math.max(-1,Math.min(1,input.steer||0));
  // An eight-second boost raises the speed target, never teleports the hull.
  // Normal steering/reverse/braking retain their original behavior.
  const boosted=run.boostUntil>run.time;
  const target=throttle>0?MAX_SPEED*(boosted?2:1)*throttle:throttle<0?4*throttle:0;
  const acceleration=throttle<0&&run.speed>0?7:throttle?3.8:1.7;
  run.speed+=Math.max(-acceleration*dt,Math.min(acceleration*dt,target-run.speed));
  run.heading-=steer*.65*Math.min(1,.25+Math.abs(run.speed)/6)*dt*Math.sign(run.speed||1);
  run.x-=Math.sin(run.heading)*run.speed*dt;run.z-=Math.cos(run.heading)*run.speed*dt;
  run.z=Math.max(-COURSE_LENGTH-36,Math.min(24,run.z));
  const ch=channelAt(run.z),offset=run.x-ch.center;run.nearBank=Math.abs(offset)>ch.halfWidth-3;
  if(Math.abs(offset)>ch.halfWidth){run.x=ch.center+Math.sign(offset)*ch.halfWidth;run.speed*=.96;}
  run.activeDrone=detectDrone(run);run.detected=run.activeDrone>=0;
  run.exposure=Math.max(0,Math.min(1,run.exposure+(run.detected?1.05:-.35)*dt));
  run.lockStage=run.detected?(run.exposure>.6?'locked':'acquiring'):'clear';
  if(run.exposure>=1)damage(run,'drone');
  if(run.state!=='playing')return run;
  trackDroneEscape(run,dt);trackSupportProgress(run);launchMissiles(run);
  interceptThreateningMissiles(run,dt);
  for(const m of run.missiles)if(!m.resolved&&run.time>=m.impactAt){
    m.resolved=true;if(Math.hypot(run.x-m.x,run.z-m.z)<m.radius+2)damage(run,'missile');else run.missilesDodged++;
  }
  run.missiles=run.missiles.filter(m=>run.time<m.impactAt+1.7);
  run.distance=Math.max(run.distance,Math.min(COURSE_LENGTH,-run.z));
  if(run.state!=='playing')return run;
  collectSupportDrop(run);
  const angle=((run.heading+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;
  if(run.z<=-COURSE_LENGTH+3&&Math.abs(run.x-DOCK.x)<10&&Math.abs(angle)<.5&&Math.abs(run.speed)<3.2){
    run.state='docking';run.heading=angle;run.dockStart={x:run.x,z:run.z,heading:angle,speed:run.speed};run.dockProgress=0;
    run.missiles=[];run.exposure=0;run.detected=false;run.lockStage='clear';clearSupport(run);
  }
  dispatchSupport(run);
  return run;
}

// Reward a clean escape or clean passage beyond a drone, once per drone; never reward its hit.
function trackDroneEscape(run,dt){
  if(run.state!=='playing')return;
  if(run.detected){
    if(!run.droneEncounter||run.droneEncounter.id!==run.activeDrone)run.droneEncounter={id:run.activeDrone,peak:0,hits:run.hits,clear:0};
    const e=run.droneEncounter;e.peak=Math.max(e.peak,run.exposure);e.clear=0;
  }else if(run.droneEncounter){
    const e=run.droneEncounter;e.clear+=dt;
    if(e.clear>=1.15){
      if(e.peak>=.25&&run.hits===e.hits&&!run.failedDrones.includes(e.id)&&!run.dodgedDrones.includes(e.id)&&!run.intercepted.includes(e.id)){run.droneDodges++;run.dodgedDrones.push(e.id);}
      run.droneEncounter=null;
    }
  }
  for(let id=0;id<DRONES.length;id++){
    if(run.intercepted.includes(id))continue;
    const past=DRONES[id].z-run.z;
    if(past>28&&past<85&&!run.dodgedDrones.includes(id)&&!run.failedDrones.includes(id)){run.droneDodges++;run.dodgedDrones.push(id);}
  }
}
function detectDrone(run){return DRONES.findIndex((d,id)=>{if(run.intercepted.includes(id))return false;const p=droneAt(d,run.time);return Math.hypot(run.x-p.scanX,run.z-p.scanZ)<p.radius+1.5;});}
// Fictional countermeasure: automatic nearest eligible forward/covering target.
export function selectInterceptTarget(run){if(run.state!=='playing'||run.interceptsLeft<1)return -1;let best=-1,bestDistance=Infinity;const fx=-Math.sin(run.heading),fz=-Math.cos(run.heading);for(let id=0;id<DRONES.length;id++){if(run.intercepted.includes(id))continue;const p=droneAt(DRONES[id],run.time),dx=p.x-run.x,dz=p.z-run.z,distance=Math.hypot(dx,dz,p.y-2.4),cover=Math.hypot(run.x-p.scanX,run.z-p.scanZ)<p.radius+1.5;if(distance>INTERCEPT_RANGE||(!cover&&dx*fx+dz*fz<0))continue;if(distance<bestDistance){bestDistance=distance;best=id;}}return best;}
export function fireIntercept(run){const id=selectInterceptTarget(run);if(id<0)return false;const p=droneAt(DRONES[id],run.time);run.interceptsLeft--;run.intercepted.push(id);run.lastIntercept={id,at:run.time,from:{x:run.x,y:2.4,z:run.z},target:{x:p.x,y:p.y,z:p.z}};if(run.droneEncounter?.id===id)run.droneEncounter=null;run.activeDrone=detectDrone(run);run.detected=run.activeDrone>=0;if(!run.detected)run.exposure=Math.min(run.exposure,.15);run.lockStage=run.detected?(run.exposure>.6?'locked':'acquiring'):'clear';return true;}
