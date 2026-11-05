import * as THREE from './vendor/three.module.js';

// Procedural billboard particles. Fixed storage: one draw for all smoke/spray/fire,
// plus at most eight water rings. No textures, DOM, lights or per-frame allocations.
const CAPACITY = 384, RINGS = 8, SOURCES = 24;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const vertexShader = `
attribute vec3 center; attribute vec2 extent; attribute vec3 tint;
attribute float alpha; attribute float style;
varying vec2 uvParticle; varying vec3 colorParticle; varying float opacityParticle; varying float kind;
void main(){
 uvParticle=uv; colorParticle=tint; opacityParticle=alpha; kind=style;
 vec4 p=modelViewMatrix*vec4(center,1.0);
 p.xy+=position.xy*extent;
 gl_Position=projectionMatrix*p;
}`;
const fragmentShader = `
precision mediump float;
varying vec2 uvParticle; varying vec3 colorParticle; varying float opacityParticle; varying float kind;
void main(){
 vec2 q=uvParticle*2.0-1.0;
 float r=length(q);
 float shape=1.0-smoothstep(0.16,1.0,r);
 if(kind>1.5){
  float lobes=0.08*sin(q.x*14.0+q.y*7.0)+0.06*cos(q.y*17.0-q.x*6.0);
  shape=1.0-smoothstep(0.22,1.0,r+lobes);
 }else if(kind<0.5){shape=pow(max(0.0,1.0-r),1.7);}
 float a=shape*opacityParticle;
 if(a<0.008)discard;
 gl_FragColor=vec4(colorParticle,a);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

export class HazardEffects {
 constructor(scene) {
  this.scene=scene; this.disposed=false; this.cursor=0; this.ringCursor=0;
  this.time=0; this.smokeClock=0; this.hitHeat=0;
  this.root=new THREE.Group(); this.root.name='hazard-effects'; scene.add(this.root);
  this.particles=Array.from({length:CAPACITY},()=>({life:0,age:0,x:0,y:0,z:0,vx:0,vy:0,vz:0,size:0,stretch:1,growth:0,drag:0,gravity:0,opacity:0,r:1,g:1,b:1,kind:0}));
  this.sources=Array.from({length:SOURCES},()=>({id:null,x:0,y:0,z:0,clock:0,last:-100}));
  const base=new THREE.PlaneGeometry(1,1);
  const geometry=new THREE.InstancedBufferGeometry();
  geometry.index=base.index; geometry.attributes.position=base.attributes.position; geometry.attributes.uv=base.attributes.uv;
  this.attributes={};
  for(const [name,size] of [['center',3],['extent',2],['tint',3],['alpha',1],['style',1]]) {
   const a=new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY*size),size);
   a.setUsage(THREE.DynamicDrawUsage); geometry.setAttribute(name,a); this.attributes[name]=a;
  }
  geometry.instanceCount=CAPACITY;
  this.geometry=geometry; this.base=base;
  this.material=new THREE.ShaderMaterial({vertexShader,fragmentShader,transparent:true,depthWrite:false,depthTest:true,toneMapped:false});
  this.batch=new THREE.Mesh(geometry,this.material); this.batch.frustumCulled=false; this.batch.renderOrder=4; this.root.add(this.batch);
  this.ringGeometry=new THREE.RingGeometry(.87,1,48);
  this.rings=Array.from({length:RINGS},()=>{
   const material=new THREE.MeshBasicMaterial({color:0xd5f7ff,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false});
   const mesh=new THREE.Mesh(this.ringGeometry,material); mesh.rotation.x=-Math.PI/2; mesh.visible=false; mesh.renderOrder=3; this.root.add(mesh);
   return {mesh,age:0,life:0,radius:1};
  });
 }
 _emit(x,y,z,vx,vy,vz,size,life,kind,opacity,growth,gravity=0,stretch=1) {
  const p=this.particles[this.cursor]; this.cursor=(this.cursor+1)%CAPACITY;
  p.x=x;p.y=y;p.z=z;p.vx=vx;p.vy=vy;p.vz=vz;p.size=size;p.life=life;p.age=0;p.kind=kind;p.opacity=opacity;p.growth=growth;p.gravity=gravity;p.stretch=stretch;p.drag=kind===1?.4:1.1;
  if(kind===0){p.r=1;p.g=.64;p.b=.23;}
  else if(kind===1){p.r=.73;p.g=.9;p.b=.98;}
  else if(kind===2){p.r=.14;p.g=.16;p.b=.18;}
  else {p.r=.72;p.g=.78;p.b=.8;}
 }
 // Call only while the rocket is visible. Position is the rocket's WORLD center.
 // Source slots expire automatically, so IDs may be unique for the whole run.
 trail(id,position,dt=1/60) {
  if(this.disposed||!position||!Number.isFinite(position.x+position.y+position.z))return;
  let source=null;
  for(const s of this.sources)if(s.id===id){source=s;break;}
  if(!source){source=this.sources[0];for(const s of this.sources)if(s.id===null||s.last<source.last)source=s;
   source.id=id;source.x=position.x;source.y=position.y;source.z=position.z;source.clock=0;
  }
  source.last=this.time;
  source.clock+=clamp(dt,0,.1);
  const distance=Math.hypot(position.x-source.x,position.y-source.y,position.z-source.z);
  const count=Math.min(8,Math.max(Math.floor(source.clock/.035),Math.floor(distance/1.3)));
  if(count>0){
   source.clock=0;
   for(let i=0;i<count;i++){
    const t=(i+1)/count,x=source.x+(position.x-source.x)*t,y=source.y+(position.y-source.y)*t,z=source.z+(position.z-source.z)*t;
    this._emit(x,y,z,.35,.6,0,.7,.9,3,.52,2.6);
    if(i===count-1)this._emit(x,y,z,0,0,0,.65,.16,0,.85,.6);
   }
   source.x=position.x;source.y=position.y;source.z=position.z;
  }
 }
 impact({x,z,hitShip=false,radius=5}) {
  if(this.disposed||!Number.isFinite(x+z))return;
  const ring=this.rings[this.ringCursor]; this.ringCursor=(this.ringCursor+1)%RINGS;
  ring.age=0;ring.life=2.4;ring.radius=clamp(radius,3,12);ring.mesh.position.set(x,.3,z);ring.mesh.visible=true;ring.mesh.scale.setScalar(.5);ring.mesh.material.opacity=.85;
  // Large vertical spray reads above the horizon even in a bow-mounted camera.
  this._emit(x,2,z,0,1,0,9,.25,0,1,15,0,.8);
  this._emit(x,4,z,0,5,0,5,.65,0,.9,4,0,1.5);
  for(let i=0;i<32;i++){
   const a=i*2.399963,spread=2+Math.random()*8;
   this._emit(x,1,z,Math.cos(a)*spread,9+Math.random()*16,Math.sin(a)*spread,.45+Math.random()*.7,1.6+Math.random()*.65,1,.95,.35,15,2.6);
  }
  for(let i=0;i<10;i++){
   const a=i*2.399963;
   this._emit(x+Math.cos(a)*1.7,2+Math.random()*3,z+Math.sin(a)*1.7,Math.cos(a),3+Math.random()*2,Math.sin(a),2.5,2+Math.random(),hitShip?2:3,.5,3.3);
  }
  if(hitShip)this.shipHit({x,z,heading:0});
 }
 shipHit({x,z,heading=0}) {
  if(this.disposed||!Number.isFinite(x+z+heading))return;
  this.hitHeat=4;
  const sx=x+Math.sin(heading)*2,sz=z+Math.cos(heading)*2;
  for(let i=0;i<14;i++)this._emit(sx,2.5,sz,(Math.random()-.5)*3,2+Math.random()*4,(Math.random()-.5)*3,1.2+Math.random(),2.3+Math.random(),2,.7,2.2);
  for(let i=0;i<6;i++)this._emit(sx,2.2,sz,(Math.random()-.5)*4,3+Math.random()*5,(Math.random()-.5)*4,.5,.6,0,.9,.8,5);
 }
 // health uses the game's 0..2 hull scale. Omit/leave 2 for an undamaged ship.
 // camera is accepted for API compatibility; billboarding uses view matrices.
 update(dt,time,{shipX=0,shipZ=0,shipHeading=0,health=2,camera=null}={}) {
  if(this.disposed)return;
  dt=Number.isFinite(dt)?clamp(dt,0,.1):0; this.time=Number.isFinite(time)?time:this.time+dt;
  this.hitHeat=Math.max(0,this.hitHeat-dt);
  const damage=clamp(2-health,0,2);
  if((damage>0||this.hitHeat>0)&&Number.isFinite(shipX+shipZ+shipHeading)){
   this.smokeClock+=dt; const interval=damage>=2?.07:.14;
   if(this.smokeClock>=interval){this.smokeClock%=interval;
    const x=shipX-Math.sin(shipHeading)*3+Math.cos(shipHeading)*1.3,z=shipZ-Math.cos(shipHeading)*3-Math.sin(shipHeading)*1.3;
    this._emit(x,2.8,z,.5,2.2+damage*.5,.2,1.1,2.5+damage*.4,2,.4+damage*.1,1.7);
    if(this.hitHeat>0)this._emit(x,2.4,z,0,2,0,.8,.3,0,.55,1.1);
   }
  }else this.smokeClock=0;
  const a=this.attributes;
  for(let i=0;i<CAPACITY;i++){
   const p=this.particles[i];p.age+=dt;
   if(p.age>=p.life){a.alpha.array[i]=0;continue;}
   const fade=p.age/p.life,drag=Math.exp(-p.drag*dt);
   p.vx*=drag;p.vz*=drag;p.vy-=p.gravity*dt;
   p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
   if(p.y<.12&&p.kind===1){p.life=0;a.alpha.array[i]=0;continue;}
   const size=p.size+p.growth*p.age;
   a.center.array[i*3]=p.x;a.center.array[i*3+1]=p.y;a.center.array[i*3+2]=p.z;
   a.extent.array[i*2]=size;a.extent.array[i*2+1]=size*p.stretch;
   a.tint.array[i*3]=p.r;a.tint.array[i*3+1]=p.g;a.tint.array[i*3+2]=p.b;
   a.alpha.array[i]=p.opacity*Math.pow(1-fade,p.kind===0?1.5:.8);a.style.array[i]=p.kind;
  }
  for(const name in a)a[name].needsUpdate=true;
  for(const r of this.rings)if(r.mesh.visible){r.age+=dt;const p=r.age/r.life;
   if(p>=1){r.mesh.visible=false;continue;}
   r.mesh.scale.setScalar(.5+p*r.radius*3);r.mesh.material.opacity=.75*(1-p)*(1-p);
  }
  for(const s of this.sources)if(this.time-s.last>1)s.id=null;
 }
 reset(){
  if(this.disposed)return;
  for(const p of this.particles){p.life=0;p.age=0;}
  for(const s of this.sources){s.id=null;s.last=-100;s.clock=0;}
  for(const r of this.rings){r.mesh.visible=false;r.life=0;}
  this.attributes.alpha.array.fill(0);this.attributes.alpha.needsUpdate=true;
  this.cursor=0;this.ringCursor=0;this.hitHeat=0;this.smokeClock=0;this.time=0;
 }
 dispose(){
  if(this.disposed)return;this.reset();this.disposed=true;this.scene.remove(this.root);
  this.geometry.dispose();this.base.dispose();this.material.dispose();this.ringGeometry.dispose();
  for(const r of this.rings)r.mesh.material.dispose();this.root.clear();
 }
}
