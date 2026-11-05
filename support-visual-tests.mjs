import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from './dist/vendor/three.module.js';
import { createSupportVisuals } from './dist/support-visuals.js';

const scene = new THREE.Scene();
const visuals = createSupportVisuals(THREE, { scene });
const { root } = visuals;
const get = name => root.getObjectByName(name);
const payload = get('support-payload'), plane = get('support-plane');
const canopy = get('support-parachute'), ring = get('support-collection-ring');
const badge = get('support-kind-badge'), crate = get('support-crate');
assert.deepEqual(Object.keys(visuals).sort(), ['dispose', 'reset', 'root', 'update']);
assert.equal(scene.children.length, 1);
assert.equal(root.visible, false);

const objects = [], geometries = new Set(), materials = new Set(), arrays = [];
let maxDrawCalls = 0, triangles = 0;
root.traverse(object => {
  objects.push(object);
  if (object.geometry) {
    maxDrawCalls++;
    geometries.add(object.geometry);
    for (const attribute of Object.values(object.geometry.attributes)) arrays.push(attribute.array);
    if (object.isMesh) triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3 * (object.count ?? 1);
  }
  if (object.material) materials.add(object.material);
});
assert.ok(maxDrawCalls <= 15, `${maxDrawCalls} possible draw calls`);
assert.ok(triangles < 10000, `${triangles} triangles`);
assert.equal(materials.size, 7);

function finiteScene() {
  root.updateMatrixWorld(true);
  root.traverse(object => {
    assert.ok(object.position.toArray().every(Number.isFinite), object.name);
    assert.ok(object.rotation.toArray().slice(0, 3).every(Number.isFinite), object.name);
    assert.ok(object.scale.toArray().every(Number.isFinite), object.name);
    assert.ok(object.matrixWorld.elements.every(Number.isFinite), object.name);
    if (object.instanceMatrix) assert.ok(object.instanceMatrix.array.every(Number.isFinite), object.name);
    if (object.geometry) for (const attribute of Object.values(object.geometry.attributes)) assert.ok(attribute.array.every(Number.isFinite), object.name);
  });
}
function pose() {
  return objects.map(object => [object.visible, ...object.position.toArray(), ...object.rotation.toArray(), ...object.scale.toArray()]);
}
function target(x, z) {
  assert.equal(payload.position.x, x);
  assert.equal(payload.position.z, z);
  assert.equal(ring.position.x, x);
  assert.equal(ring.position.z, z);
  assert.equal(badge.position.x, x);
  assert.equal(badge.position.z, z);
}

const run = {
  time: 10, x: 0, z: 0, heading: 0,
  supportPending: { id: 1, kind: 'boost', at: 10, deliverAt: 13, x: 17, z: -85 },
  supportDrop: null, lastSupportPickup: null,
};
let previousHeight = Infinity;
for (const time of [10, 10.1, 10.6, 11, 12, 12.99]) {
  run.time = time;
  run.x = 1000 * time;
  run.z = -500 * time;
  const before = JSON.stringify(run);
  visuals.update(run, 'playing');
  assert.equal(JSON.stringify(run), before, 'visuals do not mutate game state');
  assert.equal(root.userData.phase, 'pending');
  assert.ok(plane.visible && payload.visible && canopy.visible && ring.visible && badge.visible);
  target(17, -85);
  assert.equal(ring.scale.x, 8, 'collection radius is an exact 8 units, never an expanding destination overlay');
  assert.ok(payload.position.y < previousHeight);
  previousHeight = payload.position.y;
  finiteScene();
}
assert.equal(badge.material.uniforms.uBoost.value, 1);
assert.equal(crate.material.color.getHex(), 0xffc65a);
const frozenPending = pose();
for (const state of ['paused', 'help', 'paused', 'help']) {
  run.x += 100;
  visuals.update(run, state);
  assert.deepEqual(pose(), frozenPending, 'paused/help poses use only frozen run.time');
}

run.time = 13;
visuals.update(run, 'playing');
assert.equal(root.visible, false, 'stale pending state cannot remain after delivery');
run.supportPending = null;
run.supportDrop = { id: 1, kind: 'boost', spawnedAt: 13, expiresAt: 58, x: 17, z: -85, radius: 8 };
for (const time of [13, 13.3, 14.2, 20, 40, 57.999]) {
  run.time = time;
  visuals.update(run, 'playing');
  assert.equal(root.userData.phase, 'drop');
  assert.ok(payload.visible && ring.visible && badge.visible && !canopy.visible);
  assert.equal(plane.visible, time < 14.2, 'plane completes its flyby after release');
  target(17, -85);
  assert.ok(payload.position.y > .95 && payload.position.y < 1.27);
  assert.equal(ring.scale.x, 8);
  finiteScene();
}
const frozenDrop = pose();
for (let i = 0; i < 100; i++) {
  visuals.update(run, i % 2 ? 'paused' : 'help');
  assert.deepEqual(pose(), frozenDrop);
}
run.time = 58;
visuals.update(run, 'playing');
assert.equal(root.visible, false, 'uncollected crate expires at exactly 45 seconds');

run.supportDrop.kind = 'intercept';
run.time = 14;
visuals.update(run, 'playing');
assert.equal(badge.material.uniforms.uBoost.value, 0);
assert.equal(crate.material.color.getHex(), 0x62def5);
assert.equal(ring.material.color.getHex(), 0x62def5);
assert.equal(root.userData.kind, 'intercept');
assert.equal(badge.material.uniforms.uHealth.value, 0);
run.supportDrop.kind = 'health';
visuals.update(run, 'playing');
assert.equal(root.userData.kind, 'health');
assert.equal(root.userData.phase, 'drop');
assert.equal(badge.material.uniforms.uBoost.value, 0);
assert.equal(badge.material.uniforms.uHealth.value, 1);
assert.equal(crate.material.color.getHex(), 0xa9ef91);
assert.equal(ring.material.color.getHex(), 0xa9ef91);
assert.equal(badge.material.uniforms.uColor.value.getHex(), 0xa9ef91);
assert.equal(get('support-canopy').material.color.getHex(), 0xa9ef91);
assert.ok(payload.visible && ring.visible && badge.visible);
target(17, -85);
finiteScene();
for (const state of ['intro', 'docking', 'won', 'lost']) {
  visuals.update(run, state);
  assert.equal(root.visible, false, `no unclaimed supply during ${state}`);
  assert.ok(!payload.visible && !plane.visible && !ring.visible && !badge.visible);
}

run.supportDrop = null;
run.lastSupportPickup = { id: 1, kind: 'health', at: 14, x: 17, z: -85 };
for (const time of [14, 14.5, 15.09]) {
  run.time = time;
  visuals.update(run, 'playing');
  assert.equal(root.userData.phase, 'pickup');
  assert.ok(!payload.visible && !canopy.visible && !plane.visible, 'collected crate vanishes immediately');
  assert.equal(ring.position.x, 17);
  assert.equal(ring.position.z, -85);
  finiteScene();
}
run.time = 15.1;
visuals.update(run, 'playing');
assert.equal(root.visible, false);
run.time = 13.99;
visuals.update(run, 'playing');
assert.equal(root.visible, false, 'future pickup cannot play early');

// Fixed storage over many pending/delivered/collected/expired/replayed cycles.
const pending = { id: 2, kind: 'health', at: 0, deliverAt: 3, x: -29, z: -500 };
const dropped = { id: 2, kind: 'health', spawnedAt: 3, expiresAt: 48, x: -29, z: -500, radius: 8 };
const collected = { id: 2, kind: 'health', at: 30, x: -29, z: -500 };
for (let frame = 0; frame < 9000; frame++) {
  run.time = (frame / 60) % 50;
  pending.kind = dropped.kind = collected.kind = ['boost', 'intercept', 'health'][Math.floor(frame / 3000)];
  run.supportPending = run.time < 3 ? pending : null;
  run.supportDrop = run.time >= 3 && run.time < 30 ? dropped : null;
  run.lastSupportPickup = run.time >= 30 ? collected : null;
  visuals.update(run, 'playing');
  if (frame % 120 === 0) finiteScene();
}
let objectIndex = 0, arrayIndex = 0;
root.traverse(object => {
  assert.equal(object, objects[objectIndex++]);
  if (object.geometry) {
    assert.ok(geometries.has(object.geometry));
    for (const attribute of Object.values(object.geometry.attributes)) assert.equal(attribute.array, arrays[arrayIndex++]);
  }
  if (object.material) assert.ok(materials.has(object.material));
});
assert.equal(objectIndex, objects.length);
assert.equal(arrayIndex, arrays.length);

for (const invalid of [null, {}, { time: NaN }, { time: Infinity }, { time: 1, supportPending: { ...pending, x: NaN } }, { time: 1, supportPending: { ...pending, deliverAt: 0 } }, { time: 1, supportPending: { ...pending, kind: 'other' } }, { time: 4, supportDrop: { ...dropped, z: Infinity } }]) {
  visuals.update(invalid, 'playing');
  assert.equal(root.visible, false);
  finiteScene();
}
run.time = 1; run.supportPending = pending; run.supportDrop = null; run.lastSupportPickup = null;
visuals.update(run, 'playing');
visuals.reset();
assert.equal(root.visible, false);
assert.equal(root.userData.phase, 'idle');
assert.equal(root.userData.kind, undefined);
assert.equal(payload.position.length(), 0);
assert.equal(canopy.scale.x, 1);
visuals.update(run, 'playing');
assert.ok(root.visible && canopy.visible, 'replay works after reset');
target(-29, -500);

for (const shader of [badge.material.vertexShader, badge.material.fragmentShader]) {
  for (const match of shader.matchAll(/#include <(.*?)>/g)) assert.equal(typeof THREE.ShaderChunk[match[1]], 'string');
  assert.doesNotMatch(shader, /#include <(?:tonemapping|colorspace)_pars_fragment>/);
  assert.doesNotMatch(shader, /sampler2D|texture2D|samplerCube/);
}
assert.match(badge.material.vertexShader, /modelViewMatrix \* vec4\(0\., 0\., 0\., 1\.\)/, 'badge faces the camera');
const source = fs.readFileSync(new URL('./dist/support-visuals.js', import.meta.url), 'utf8');
assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|Image|TextureLoader|document|window)\s*[.(]/, 'no network, DOM or external assets');
const updates = source.slice(source.indexOf('  function validTarget('), source.indexOf('  function reset('));
assert.doesNotMatch(updates, /\bnew\s|\.push\s*\(|\.slice\s*\(|\.map\s*\(/, 'no growing allocations or geometry/material construction per update');

let disposals = 0;
for (const resource of [...geometries, ...materials]) resource.addEventListener('dispose', () => disposals++);
visuals.dispose(); visuals.dispose();
assert.equal(disposals, geometries.size + materials.size, 'all resources disposed exactly once');
assert.equal(scene.children.length, 0);
assert.equal(root.children.length, 0);
visuals.update(run, 'playing'); visuals.reset();
assert.equal(root.children.length, 0);
const detached = createSupportVisuals(THREE);
detached.update(run, 'playing'); detached.dispose();
console.log(`PASS: support plane/parachute/sea crate; fixed world targets; exact pickup ring; ×2/+1/heart life colors; pause/help; expiry/collection/end cleanup; ${maxDrawCalls} draw calls, ${triangles} triangles; 9,000-frame stable resources; reset/idempotent disposal. CPU Three.js checks only, not GPU visual QA.`);
