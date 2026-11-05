// Original procedural sky and reflection environment. No external imagery.
export function createAtmosphere(THREE, {scene, sunDirection}) {
  const direction = sunDirection.clone().normalize();
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {sunDirection: {value: direction}},
    vertexShader: `varying vec3 vDirection; void main(){vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec3 vDirection; uniform vec3 sunDirection;
      void main(){vec3 d=normalize(vDirection);float h=max(d.y,0.);float s=max(dot(d,sunDirection),0.);
      vec3 horizon=vec3(.53,.67,.72),zenith=vec3(.12,.31,.48);
      vec3 col=mix(horizon,zenith,pow(h,.48));
      col+=vec3(.48,.25,.09)*pow(s,14.)*(1.-h*.45);
      col+=vec3(4.,2.8,1.5)*smoothstep(.9994,.99985,s);
      col=mix(vec3(.11,.21,.25),col,smoothstep(-.2,.015,d.y));
      gl_FragColor=vec4(col,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1800,32,16),skyMaterial);
  sky.frustumCulled=false;sky.renderOrder=-100;scene.add(sky);
  let environment=null;
  if(typeof window!=='undefined'){
    const size=96,faces=[];
    const maps=[(u,v)=>[1,-v,-u],(u,v)=>[-1,-v,u],(u,v)=>[u,1,v],(u,v)=>[u,-1,-v],(u,v)=>[u,-v,1],(u,v)=>[-u,-v,-1]];
    const srgb=x=>Math.round(255*(x<=.0031308?12.92*x:1.055*Math.pow(x,1/2.4)-.055));
    for(const map of maps){
      const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
      const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(size,size);
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        const d=map((x+.5)/size*2-1,(y+.5)/size*2-1),length=Math.hypot(...d);for(let k=0;k<3;k++)d[k]/=length;
        const h=Math.max(0,d[1]),t=Math.pow(h,.48),s=Math.max(0,d[0]*direction.x+d[1]*direction.y+d[2]*direction.z);
        const ground=Math.max(0,Math.min(1,(d[1]+.2)/.215)),glow=Math.pow(s,14)*(1-h*.45),sun=Math.pow(s,600),i=(y*size+x)*4;
        for(let k=0;k<3;k++){const c=[.53,.67,.72][k]*(1-t)+[.12,.31,.48][k]*t+[.48,.25,.09][k]*glow+[1.5,1.1,.65][k]*sun;pixels.data[i+k]=srgb(Math.min(1,[.11,.21,.25][k]*(1-ground)+c*ground));}pixels.data[i+3]=255;
      }
      ctx.putImageData(pixels,0,0);faces.push(canvas);
    }
    environment=new THREE.CubeTexture(faces);environment.colorSpace=THREE.SRGBColorSpace;environment.needsUpdate=true;
  }
  return {sky,environment,update(camera){sky.position.copy(camera.position);},setEnabled(enabled){sky.visible=!!enabled;scene.environment=enabled?environment:null;},dispose(){scene.remove(sky);sky.geometry.dispose();skyMaterial.dispose();environment?.dispose();}};
}
