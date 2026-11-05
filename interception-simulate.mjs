import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const path=process.argv[2]||new URL('./dist/logic.js',import.meta.url).pathname;
const m=await import(pathToFileURL(path));
const {COURSE_LENGTH,DOCK,DRONES,channelAt,createRun,droneAt,stepRun}=m;

function pilot(r,{throttle=1,kind='avoid',lookAhead=45,margin=10}={}){
  const ahead=channelAt(r.z-lookAhead);
  let targetX=ahead.center;
  if(kind==='avoid')for(let id=0;id<DRONES.length;id++){
    if(r.intercepted?.includes(id))continue;
    const d=DRONES[id],dz=r.z-d.z;
    if(dz>-20&&dz<100){
      const p=droneAt(d,r.time+Math.max(0,dz)/Math.max(6,r.speed));
      targetX=ahead.center+(p.scanX>ahead.center?-1:1)*(ahead.halfWidth-margin);
    }
  }
  if(kind==='left')targetX=ahead.center-(ahead.halfWidth-margin);
  if(kind==='right')targetX=ahead.center+(ahead.halfWidth-margin);
  if(kind!=='center')for(const threat of r.missiles)if(!threat.resolved){
    targetX=ahead.center+(threat.x>ahead.center?-1:1)*(ahead.halfWidth-margin);
  }
  if(r.distance>COURSE_LENGTH-80)targetX=DOCK.x;
  const desired=Math.atan2(-(targetX-r.x),lookAhead);
  let error=desired-r.heading;
  while(error>Math.PI)error-=2*Math.PI;
  while(error<-Math.PI)error+=2*Math.PI;
  return{throttle:r.distance>COURSE_LENGTH-60?.18:throttle,steer:Math.max(-1,Math.min(1,-error*3))};
}

export function simulate({startZ=8,startTime=0,health=2,intercept=false,interceptZ=-1430,dt=1/30,...options}={}){
  const run=createRun();
  run.z=startZ;run.x=channelAt(startZ).center;run.time=startTime;run.health=health;
  if(startZ<0){run.distance=-startZ;run.speed=14;}
  let interceptAt=null,healthAtFinal=null,nearBankFrames=0,shots=0;
  const hits=[];
  for(let i=0;i<300/dt&&['playing','docking'].includes(run.state);i++){
    if(intercept&&m.selectInterceptTarget&&run.interceptsLeft>0&&run.z<interceptZ){
      const target=m.selectInterceptTarget(run),id=typeof target==='number'?target:target?.id??target?.index;
      if(id>=5){
        m.fireIntercept(run);shots++;
        if(run.interceptsLeft===0)interceptAt={z:run.z,time:run.time,id};
      }
    }
    const before=run.hits;
    stepRun(run,pilot(run,options),dt);
    if(healthAtFinal===null&&run.z<-1490)healthAtFinal=run.health;
    if(run.nearBank)nearBankFrames++;
    if(run.hits>before)hits.push({z:+run.z.toFixed(2),time:+run.time.toFixed(2),cause:run.lastHit,drone:run.activeDrone});
  }
  return{state:run.state,health:run.health,hits,seconds:+(run.time-startTime).toFixed(2),z:+run.z.toFixed(2),x:+run.x.toFixed(2),missilesDodged:run.missilesDodged,healthAtFinal,interceptAt,shots,nearBankFrames};
}

if(import.meta.url===pathToFileURL(process.argv[1]).href){
const full=[];
for(const kind of ['avoid','center','left','right'])for(const throttle of [1,.9,.8,.7])for(const intercept of [false,true]){
  if(intercept&&!m.fireIntercept)continue;
  full.push({kind,throttle,intercept,...simulate({kind,throttle,intercept})});
}
const ending=[];
for(let startTime=0;startTime<18;startTime+=2)for(const kind of ['avoid','center'])for(const intercept of [false,true]){
  if(intercept&&!m.fireIntercept)continue;
  ending.push({kind,startTime,intercept,...simulate({startZ:-1480,startTime,kind,intercept})});
}
const results={source:path,full,ending};
const out=process.argv[3];
if(out)await fs.writeFile(out,JSON.stringify(results,null,2));
for(const kind of ['avoid','center','left','right'])for(const intercept of [false,true]){
  const rows=full.filter(r=>r.kind===kind&&r.intercept===intercept);
  if(!rows.length)continue;
  console.log(JSON.stringify({scope:'full',kind,intercept,wins:rows.filter(r=>r.state==='won').length,runs:rows.length,health:rows.map(r=>r.health),lateHits:rows.map(r=>r.hits.filter(h=>h.z<-1490).length),shots:rows.map(r=>r.shots)}));
}
for(const kind of ['avoid','center'])for(const intercept of [false,true]){
  const rows=ending.filter(r=>r.kind===kind&&r.intercept===intercept);
  if(!rows.length)continue;
  console.log(JSON.stringify({scope:'ending',kind,intercept,wins:rows.filter(r=>r.state==='won').length,runs:rows.length,totalHits:rows.reduce((sum,r)=>sum+r.hits.length,0),health:rows.map(r=>r.health),shots:rows.map(r=>r.shots)}));
}
}
