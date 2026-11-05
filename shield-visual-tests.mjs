import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from './dist/vendor/three.module.js';
import { createSupportVisuals } from './dist/support-visuals.js';
import { createShieldVisuals, SHIELD_EFFECT_LIFETIME } from './dist/shield-visuals.js';

const scene = new THREE.Scene();
const visuals = createShieldVisuals(THREE, { scene });
const { root } = visuals;
const get = name => root.getObjectByName(name);
const shell = get('shield-active-shell');
const dome = get('shield-forward-dome');
const tracer1 = get('shield-counter-tracer-1'), tracer2 = get('shield-counter-tracer-2');
const flash1 = get('shield-midair-flash-1'), flash2 = get('shield-midair-flash-2');
assert.deepEqual(Object.keys(visuals).sort(), ['dispose', 'reset', 'root', 'update']);
assert.equal(SHIELD_EFFECT_LIFETIME, 1.2);
assert.equal(scene.children.length, 1);
assert.equal(root.visible, false);

const objects = [], geometries = new Set(), materials = new Set(), arrays = [];
let draws = 0, triangles = 0;
root.traverse(object => {
  objects.push(object);
  if (object.geometry) {
    draws++;
    geometries.add(object.geometry);
    for (const attribute of Object.values(object.geometry.attributes)) arrays.push(attribute.array);
    if (object.isMesh) triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count)/3;
  }
  if (object.material) materials.add(object.material);
});
assert.equal(draws, 8, 'four active-shell draws plus two tracers and two flashes');
assert.equal(geometries.size, 5);
assert.equal(materials.size, 7);
assert.ok(triangles < 1500, `${triangles} bounded triangles`);
assert.equal(tracer1.geometry, tracer2.geometry);
assert.equal(flash1.geometry, flash2.geometry);
assert.notEqual(tracer1.material, tracer2.material, 'paired tracers have independent uniforms');
assert.notEqual(flash1.material, flash2.material, 'paired flashes have independent ages');
for (const object of [tracer1, tracer2, flash1, flash2]) assert.equal(object.frustumCulled, false);
for (const material of materials) {
  assert.equal(material.depthWrite, false, 'effects cannot write an opaque wall into the depth buffer');
  assert.equal(material.transparent, true);
  assert.equal(material.depthTest, true, 'ship and environment still occlude effects naturally');
  if (material.isShaderMaterial) assert.equal(material.forceSinglePass, true, 'transparent double-sided effects stay within the fixed draw budget');
}
for (let i = 0; i < dome.geometry.attributes.position.count; i++) {
  assert.ok(dome.geometry.attributes.position.getZ(i) < 1e-6, 'only the forward hemisphere exists, never an aft wall in front of the chase camera');
  assert.ok(dome.geometry.attributes.position.getY(i) >= 0);
}

function finiteScene(target = root) {
  target.updateMatrixWorld(true);
  target.traverse(object => {
    for (const value of [...object.position.toArray(), ...object.rotation.toArray().slice(0, 3), ...object.scale.toArray(), ...object.matrixWorld.elements]) assert.ok(Number.isFinite(value), object.name);
    if (object.geometry) for (const attribute of Object.values(object.geometry.attributes)) assert.ok(attribute.array.every(Number.isFinite), object.name);
    for (const uniform of Object.values(object.material?.uniforms ?? {})) {
      if (typeof uniform.value === 'number') assert.ok(Number.isFinite(uniform.value), object.name);
      else if (uniform.value.isVector3) assert.ok(uniform.value.toArray().every(Number.isFinite), object.name);
    }
  });
}
function snapshot() {
  return objects.map(object => ({ visible: object.visible, position: object.position.toArray(), rotation: object.rotation.toArray(), scale: object.scale.toArray(), uniforms: Object.fromEntries(Object.entries(object.material?.uniforms ?? {}).map(([key, entry]) => [key, entry.value?.toArray ? entry.value.toArray() : entry.value])) }));
}
function freshRun() {
  return { state: 'playing', time: 10, x: 19, z: -700, heading: .2, shieldUntil: 25, shieldCharges: 2, missilesIntercepted: 0, missiles: [], lastShieldIntercept: null };
}
function event(id, at, x = -6, y = 8) {
  return { id, at, from: { x: 19, y: 2.4, z: -700 }, target: { x, y, z: -718 } };
}
function missile(value) { return { id: value.id, intercepted: true, interceptedAt: value.at, shieldIntercept: value }; }
let run = freshRun();
visuals.update(run, 'playing');
assert.ok(root.visible && shell.visible);
assert.equal(root.userData.phase, 'active');
assert.equal(root.userData.charges, 2);
assert.deepEqual(shell.position.toArray(), [19, 0, -700]);
assert.equal(shell.rotation.y, .2);
assert.equal(get('shield-charge-1').visible, true);
assert.equal(get('shield-charge-2').visible, true);
assert.equal(tracer1.visible || tracer2.visible, false);
finiteScene();
run.shieldCharges = 1;
visuals.update(run, 'playing');
assert.equal(root.userData.charges, 1);
assert.equal(get('shield-charge-2').visible, false);
run.shieldCharges = 0;
visuals.update(run, 'playing');
assert.equal(root.visible, false, 'depleted shield shell disappears immediately');
run.shieldCharges = 2;
run.time = 25;
visuals.update(run, 'playing');
assert.equal(root.visible, false, 'expiration is exact');
run.time = 24.99;
visuals.update(run, 'playing');
assert.ok(root.visible && dome.material.uniforms.uOpacity.value < .03, 'quiet fade near expiration');

// Simultaneous pair remains visible even though lastShieldIntercept has only one.
run = freshRun();
const left = event(1, 10, -6, 8), right = event(2, 10, 35, 10);
run.missiles = [missile(left), missile(right)];
run.lastShieldIntercept = right;
run.shieldCharges = 0;
run.missilesIntercepted = 2;
for (const age of [0, .05, .20, .45, .8, 1.199]) {
  run.time = 10+age;
  const unchanged = JSON.stringify(run);
  visuals.update(run, 'playing');
  assert.equal(JSON.stringify(run), unchanged, 'visuals never alter gameplay');
  assert.equal(root.userData.interceptsVisible, 2);
  assert.equal(root.userData.phase, 'intercept');
  assert.equal(shell.visible, false, 'effects finish after both charges are spent');
  assert.deepEqual(tracer1.material.uniforms.uTarget.value.toArray(), [-6, 8, -718]);
  assert.deepEqual(tracer2.material.uniforms.uTarget.value.toArray(), [35, 10, -718]);
  assert.equal(tracer1.visible && tracer2.visible, age < .63);
  assert.equal(flash1.visible && flash2.visible, age >= .18);
  assert.deepEqual(flash1.position.toArray(), [-6, 8, -718]);
  assert.deepEqual(flash2.position.toArray(), [35, 10, -718]);
  finiteScene();
  const frozen = snapshot();
  for (const state of ['paused', 'help', 'paused']) {
    visuals.update(run, state);
    assert.deepEqual(snapshot(), frozen, 'run.time freezes the dome, tracer travel, flash size and fade');
  }
}
run.time = 11.2;
visuals.update(run, 'playing');
assert.equal(root.visible, false);
assert.equal(root.userData.interceptsVisible, 0);

// Different ages, expiry and latest-event fallback do not collapse or duplicate pairs.
run = freshRun();
run.shieldCharges = 0;
run.missiles = [missile(event(3, 9.8)), missile(event(4, 10.1, 31))];
run.lastShieldIntercept = run.missiles[1].shieldIntercept;
run.time = 10.4;
visuals.update(run, 'playing');
assert.equal(root.userData.interceptsVisible, 2);
assert.ok(flash1.material.uniforms.uAge.value > flash2.material.uniforms.uAge.value);
run.time = 11.05;
visuals.update(run, 'playing');
assert.equal(root.userData.interceptsVisible, 1);
assert.equal(get('shield-interception-1').userData.eventId, 4);
run.missiles = [];
visuals.update(run, 'playing');
assert.equal(root.userData.interceptsVisible, 1, 'latest snapshot still works if a caller omits missile list');
run.missiles = [missile(event(5, 10.4)), missile(event(6, 10.5)), missile(event(7, 10.6))];
run.lastShieldIntercept = run.missiles[2].shieldIntercept;
visuals.update(run, 'playing');
assert.equal(root.userData.interceptsVisible, 2, 'even malformed over-capacity input cannot create a third effect');
assert.deepEqual([get('shield-interception-1').userData.eventId, get('shield-interception-2').userData.eventId], [6, 7]);

for (const state of ['intro', 'docking', 'won', 'lost']) {
  visuals.update(run, state);
  assert.equal(root.visible, false, `outer ${state} hides every effect`);
  assert.ok(!shell.visible && !tracer1.visible && !tracer2.visible && !flash1.visible && !flash2.visible);
  visuals.update({ ...run, state }, 'paused');
  assert.equal(root.visible, false, `run ${state} cannot show stale effects through pause`);
}

// Supply kinds keep their own tint and mutually exclusive analytic glyph flags.
const supply = createSupportVisuals(THREE);
const supplyBadge = supply.root.getObjectByName('support-kind-badge');
const supplyRun = { time: 3.5, supportDrop: { id: 1, kind: 'shield', x: 20, z: -80, spawnedAt: 3, expiresAt: 48, radius: 8 } };
for (const [kind, color, boost, health, shield] of [
  ['shield', 0xa593ff, 0, 0, 1], ['boost', 0xffc65a, 1, 0, 0],
  ['intercept', 0x62def5, 0, 0, 0], ['health', 0xa9ef91, 0, 1, 0], ['shield', 0xa593ff, 0, 0, 1],
]) {
  supplyRun.supportDrop.kind = kind;
  supply.update(supplyRun, 'playing');
  assert.equal(supply.root.userData.kind, kind);
  assert.equal(supply.root.visible, true);
  assert.equal(supplyBadge.material.uniforms.uColor.value.getHex(), color);
  assert.equal(supplyBadge.material.uniforms.uBoost.value, boost);
  assert.equal(supplyBadge.material.uniforms.uHealth.value, health);
  assert.equal(supplyBadge.material.uniforms.uShield.value, shield);
  for (const name of ['support-crate', 'support-canopy', 'support-collection-ring']) assert.equal(supply.root.getObjectByName(name).material.color.getHex(), color);
}
assert.match(supplyBadge.material.fragmentShader, /uniform float uShield/);
assert.match(supplyBadge.material.fragmentShader, /vec2\(-\.545,-\.39\)/, 'analytic shield bottom point');
assert.match(supplyBadge.material.fragmentShader, /vec2\(-\.07,-\.17\),vec2\(-\.07,\.17\)/, 'explicit plus glyph');
supplyRun.supportDrop = null;
supplyRun.supportPending = { id: 2, kind: 'shield', x: 20, z: -80, at: 3, deliverAt: 6 };
supply.update(supplyRun, 'playing');
assert.equal(supply.root.userData.phase, 'pending');
supplyRun.supportPending = null;
supplyRun.lastSupportPickup = { id: 2, kind: 'shield', x: 20, z: -80, at: 3.5 };
supply.update(supplyRun, 'playing');
assert.equal(supply.root.userData.phase, 'pickup');
finiteScene(supply.root);
supply.dispose();

// Whole fixed pool is exercised through repeated voyages at all supported rates.
let totalFrames = 0;
for (const fps of [20, 30, 60]) {
  visuals.reset();
  run = freshRun();
  const first = missile(event(11, 11, -4)), second = missile(event(12, 11.05, 38));
  for (let frame = 0; frame < fps*48; frame++) {
    const age = (frame/fps)%16;
    run.time = age+10;
    run.x = 19+Math.sin(age)*20;
    run.z = -700-age*14;
    run.heading = Math.sin(age)*.35;
    run.shieldUntil = 25;
    run.shieldCharges = age < 1 ? 2 : age < 1.05 ? 1 : 0;
    run.missiles = age < 1 ? [] : age < 1.05 ? [first] : [first, second];
    run.lastShieldIntercept = age < 1 ? null : age < 1.05 ? first.shieldIntercept : second.shieldIntercept;
    visuals.update(run, 'playing');
    if (frame%15 === 0) finiteScene();
    totalFrames++;
  }
}
let objectIndex = 0, arrayIndex = 0;
root.traverse(object => {
  assert.equal(object, objects[objectIndex++], 'object identity remains fixed');
  if (object.geometry) {
    assert.ok(geometries.has(object.geometry));
    for (const attribute of Object.values(object.geometry.attributes)) assert.equal(attribute.array, arrays[arrayIndex++]);
  }
  if (object.material) assert.ok(materials.has(object.material));
});
assert.equal(objectIndex, objects.length);
assert.equal(arrayIndex, arrays.length);
for (const invalid of [null, {}, { time: NaN }, { time: Infinity },
  { time: 10, shieldUntil: Infinity, shieldCharges: 2, x: 0, z: 0 },
  { time: 10, missiles: [missile(event(1, 11))] },
  { time: 10, missiles: [missile(event(1, 8))] },
  { time: 10, missiles: [missile({ ...event(1, 10), from: { x: NaN, y: 2, z: 0 } })] },
  { time: 10, missiles: [missile({ ...event(1, 10), target: { x: 0, y: Infinity, z: 0 } })] },
  { time: 10, missiles: [null, { intercepted: false, shieldIntercept: event(1, 10) }] },
]) {
  visuals.update(invalid, 'playing');
  assert.equal(root.visible, false);
  finiteScene();
}

for (const material of materials) for (const source of [material.vertexShader, material.fragmentShader]) {
  if (!source) continue;
  for (const match of source.matchAll(/#include <(.*?)>/g)) assert.equal(typeof THREE.ShaderChunk[match[1]], 'string');
  assert.doesNotMatch(source, /sampler2D|texture2D|samplerCube/);
}
const source = fs.readFileSync(new URL('./dist/shield-visuals.js', import.meta.url), 'utf8');
assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|Image|TextureLoader|document|window)\s*[.(]/);
const updateSource = source.slice(source.indexOf('  function hiddenState('), source.indexOf('  function reset('));
assert.doesNotMatch(updateSource, /\bnew\s|\.push\s*\(|\.slice\s*\(|\.map\s*\(/, 'no growing collections or new GPU resources during updates');
assert.doesNotMatch(updateSource, /Date\.|performance\.|Math\.random/, 'no real-time or random clock drift while paused');
assert.match(tracer1.material.vertexShader, /center\.y \+= sin\(t\*3\.141593\)\*3\.4/, 'counter-tracer rises in a visible abstract arc');

visuals.update(freshRun(), 'playing');
visuals.reset();
assert.equal(root.visible, false);
assert.equal(root.userData.phase, 'idle');
assert.equal(root.userData.interceptsVisible, 0);
assert.equal(shell.position.length(), 0);
assert.equal(flash1.scale.x, 1);
visuals.update(freshRun(), 'playing');
assert.ok(root.visible && shell.visible, 'reset permits a fresh run');
let disposals = 0;
for (const resource of [...geometries, ...materials]) resource.addEventListener('dispose', () => disposals++);
visuals.dispose(); visuals.dispose();
assert.equal(disposals, geometries.size+materials.size, 'every shared resource is disposed exactly once');
assert.equal(scene.children.length, 0);
assert.equal(root.children.length, 0);
visuals.update(freshRun(), 'playing'); visuals.reset();
assert.equal(root.children.length, 0);
const detached = createShieldVisuals(THREE);
detached.update(freshRun(), 'playing'); detached.dispose();
console.log(`PASS: violet shield+2 supply and existing glyphs; active/expired/depleted shield; independent paired counter-tracers and midair flashes; pause/help; end/docking/reset/disposal; ${totalFrames} frames at 20/30/60 fps; ${draws} maximum draws, ${triangles} triangles, ${geometries.size} geometries/${materials.size} materials. CPU Three.js checks only; GPU shader/device rendering unverified.`);
