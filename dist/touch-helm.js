// Release locks the throttle, not the turn rate: the ship keeps its current heading.
const limit = n => Math.max(-1, Math.min(1, Number.isFinite(n) ? n : 0));
export function helmDrag(x,y,radius){
  const radiusSafe = Math.max(1,radius);
  const factor=Math.min(1,radiusSafe/(Math.hypot(x,y)||1));
  const dx=x*factor,dy=y*factor;
  const dead=n=>Math.abs(n)<.14?0:limit(n);
  return {steer:dead(dx/radiusSafe),throttle:dead(-dy/radiusSafe),dx,dy};
}
export function releaseCruise(previous,{steer=0,throttle=0}={}){
  if(throttle<0||!throttle&&!steer)return 0;
  return throttle>0?limit(throttle):Math.max(0,limit(previous));
}
export function resolveThrottle(cruise,touch,accelerate,brake){
  if(accelerate||brake)return Number(!!accelerate)-Number(!!brake);
  return touch || Math.max(0,limit(cruise));
}
