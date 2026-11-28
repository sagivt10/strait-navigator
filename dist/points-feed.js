import {SCORING_RULES as rules} from './scoring.js?v=22';
const progressStep=100;
const size=v=>Array.isArray(v)?new Set(v).size:0;
export const pointSnapshot=(run={})=>({distance:Math.floor((run.distance||0)/progressStep),drone:run.droneDodges||0,missile:size(run.cleanMissileZones),supply:run.supportCollected||0,hits:run.hits||0});
export function pointChanges(a,b){
 return [
  [b.drone-a.drone,rules.pointsPerCleanPass,'Clean drone pass'],
  [b.missile-a.missile,rules.pointsPerNearMiss,'Close missile escape'],
  [b.supply-a.supply,rules.pointsPerSupply,'Supply collected'],
  [b.hits-a.hits,-rules.pointsPerHit,'Hull damage'],
  [b.distance-a.distance,progressStep*rules.pointsPerMetre,'Route progress'],
 ].filter(([n])=>n>0).map(([n,rate,label])=>({points:n*rate,label}));
}
export function makePointsFeed(container, limit=2){
 let prev=pointSnapshot();
 function reset(run){prev=pointSnapshot(run);container?.replaceChildren?.();}
 return {reset,tick(run){
  const next=pointSnapshot(run),changes=pointChanges(prev,next);prev=next;
  if(typeof container?.append!=='function')return;
  for(const {points,label} of changes){
   const el=document.createElement('div'),value=document.createElement('strong'),caption=document.createElement('span');
   el.className='point-flash '+(points>0?'point-positive':'point-negative');
   value.textContent=(points>0?'+':'−')+Math.abs(points).toLocaleString('en-US');
   caption.textContent=label;el.append(value,caption);container.append(el);
   if(container.children.length>limit)container.firstElementChild?.remove();
   setTimeout(()=>el.remove(),2300);
  }
 }};
}
