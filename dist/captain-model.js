import {CaptainAnimator} from './captain-animation.js';

// Original Blender caricature: Y up, front -Z, identity articulated pivots.
// Validate before removing the old character. A missing asset keeps the game playable.
export function installCaptainModel({holder,model,previousAnimator,arms,enhanced=false}) {
  const nextArms=['upper_armL','upper_armR'].map(name=>model?.getObjectByName(name));
  if(!model?.isObject3D||!model.getObjectByName('Captain_Root')||nextArms.some(node=>!node?.isObject3D)) {
    throw new Error('Captain model is missing its required root or shoulder pivots.');
  }
  model.traverse(node=>{
    if(!node.position.toArray().concat(node.quaternion.toArray(),node.scale.toArray()).every(Number.isFinite))throw new Error('Captain model has an invalid transform.');
  });
  previousAnimator.reset();
  // Stern clearance for the wider articulated hands during turn transitions.
  holder.position.z=3.55;
  const animator=new CaptainAnimator({root:holder,captainArms:nextArms,articulated:true});
  const oldParts=holder.children.slice();
  for(const part of oldParts)holder.remove(part);
  model.traverse(node=>{if(node.isMesh){node.castShadow=enhanced;node.receiveShadow=enhanced;}});
  holder.add(model);
  arms.splice(0,arms.length,...nextArms);
  // Materials may be shared with the vessel; only dispose private geometries.
  const oldGeometries=new Set();for(const part of oldParts)part.traverse(node=>{if(node.isMesh)oldGeometries.add(node.geometry);});
  for(const geometry of oldGeometries)try{geometry.dispose();}catch(error){console.warn('Old captain geometry could not be released.',error);}
  return animator;
}

// Do not let an optional visual upgrade indefinitely block the already loaded game.
// A late response is ignored; it must never swap rigs during a voyage.
export async function loadOptionalCaptain(loader,timeoutMs=12000) {
  let timer;
  try {
    return await Promise.race([
      loader.loadAsync('./captain-trump-v4.glb').catch(error=>{console.warn('Captain asset failed; retaining the original character.',error);return null;}),
      new Promise(resolve=>{timer=setTimeout(()=>resolve(null),timeoutMs);})
    ]);
  } catch(error) { console.warn('Captain asset unavailable; retaining original character.',error);return null; } finally { clearTimeout(timer); }
}
