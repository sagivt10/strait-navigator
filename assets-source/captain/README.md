# Original captain source

This is the original procedural Blender 4.3 authoring script for the approved caricature. No downloaded meshes or textures are used. The shipped runtime asset is `dist/captain-trump-v4.glb`; the exact final measured contract is alongside this file.

Run from a Blender 4.3 installation:

    blender --background --python build_model.py -- /absolute/output/directory

The script rebuilds the GLB, editable Blender scene, and a CPU studio preview. Its output directory is separate from the game. It does not publish or replace the runtime asset. Export metadata or binary ordering may vary across Blender versions. Rig nodes are rigid articulated objects, not a skinned skeleton. Runtime reactions are in `dist/captain-animation.js`.
