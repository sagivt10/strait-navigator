import assert from 'node:assert/strict';
import { Group } from './dist/vendor/three.module.js';
import { CaptainAnimator, CAPTAIN_EVENTS } from './dist/captain-animation.js';

let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`PASS: ${name}`); }
function close(a, b, label, tolerance = 1e-11) {
  assert(Math.abs(a - b) <= tolerance, `${label}: ${a} differs from ${b}`);
}
function capture(node) {
  return [...node.position.toArray(), ...node.rotation.toArray().slice(0, 3), ...node.scale.toArray()];
}
function snapshot(f) { return [capture(f.root), ...f.arms.map(capture)]; }
function fixture(offsets = false) {
  const root = new Group(); root.position.set(0, 1.65, 3); root.scale.setScalar(.8);
  const arms = [new Group(), new Group()];
  arms[0].position.set(-.86, 2.57, 0); arms[1].position.set(.86, 2.57, 0);
  root.add(...arms);
  if (offsets) {
    root.position.x = .17; root.rotation.set(.025, -.12, .015);
    arms[0].rotation.set(.05, .02, -.03); arms[1].rotation.set(-.04, -.01, .06);
  }
  const f = { root, arms, time: 0 };
  f.rest = snapshot(f);
  f.animator = new CaptainAnimator({ root, captainArms: arms });
  f.context = Object.freeze({ state: 'playing', speech: 0 });
  return f;
}
function advance(f, seconds, fps = 60, context = f.context, inspect) {
  const count = Math.round(seconds * fps);
  assert(Math.abs(count / fps - seconds) < 1e-8, `use frame-aligned seconds: ${seconds} at ${fps}`);
  for (let i = 0; i < count; i++) {
    f.time += 1 / fps;
    f.animator.update(1 / fps, f.time, context);
    if (inspect) inspect(f);
  }
}
function comparePose(a, b, label) {
  const left = snapshot(a), right = snapshot(b);
  for (let i = 0; i < left.length; i++) for (let j = 0; j < left[i].length; j++) close(left[i][j], right[i][j], `${label} node ${i} channel ${j}`);
}
function assertAnchored(f) {
  assert.deepEqual(f.root.position.toArray(), f.rest[0].slice(0, 3), 'gesture cannot displace root');
  close(f.root.rotation.x, f.rest[0][3], 'gesture cannot pitch feet into deck');
  close(f.root.rotation.z, f.rest[0][5], 'gesture cannot roll feet into deck');
  assert.deepEqual(f.root.scale.toArray(), f.rest[0].slice(6), 'root scale unchanged');
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(f.arms[i].position.toArray(), f.rest[i + 1].slice(0, 3), 'shoulder stays attached');
    assert.deepEqual(f.arms[i].scale.toArray(), f.rest[i + 1].slice(6), 'arm scale unchanged');
    close(f.arms[i].rotation.y, f.rest[i + 1][4], 'unowned shoulder axis unchanged');
  }
}
function assertBounded(f) {
  for (const node of snapshot(f)) for (const channel of node) assert(Number.isFinite(channel), 'every transform finite');
  assert(Math.abs(f.root.rotation.y - f.rest[0][4]) < 3.3, 'bounded root yaw');
  assert(Math.abs(f.root.position.x - f.rest[0][0]) <= .120001, 'bounded dance sway');
  assert(f.root.position.y >= f.rest[0][1] - 1e-9 && f.root.position.y <= f.rest[0][1] + .120001, 'bounded dance lift');
  for (let i = 0; i < 2; i++) {
    assert(Math.abs(f.arms[i].rotation.x - f.rest[i + 1][3]) < 1.5, 'bounded arm pitch');
    assert(Math.abs(f.arms[i].rotation.z - f.rest[i + 1][5]) < 2.4, 'bounded arm lift');
  }
}
function expectedDance(f, time) {
  close(f.root.rotation.y, f.rest[0][4] + Math.PI + Math.sin(time * 2) * .14, 'original dance yaw');
  close(f.root.rotation.z, f.rest[0][5] + Math.sin(time * 4) * .045, 'original dance roll');
  close(f.root.position.x, f.rest[0][0] + Math.sin(time * 2) * .12, 'original dance sway');
  close(f.root.position.y, f.rest[0][1] + Math.abs(Math.sin(time * 4)) * .12, 'original dance bounce');
  for (let i = 0; i < 2; i++) {
    close(f.arms[i].rotation.x, f.rest[i + 1][3] - .8 + Math.sin(time * 4 + i * Math.PI) * .65, 'original dance arm swing');
    close(f.arms[i].rotation.z, f.rest[i + 1][5] + Math.sin(time * 4) * .12, 'original dance arm roll');
  }
}

check('public events, transform validation, and read-only state getters', () => {
  assert(Object.isFrozen(CAPTAIN_EVENTS));
  assert.equal(CAPTAIN_EVENTS.INCOMING_MISSILE, 'incomingMissile');
  assert.throws(() => new CaptainAnimator({ root: {} }), TypeError);
  const f = fixture();
  assert.equal(f.animator.activeEvent, null);
  assert.equal(f.animator.eventElapsed, 0);
  assert.throws(() => { f.animator.activeEvent = 'hit'; }, TypeError);
  assert.throws(() => { f.animator.eventElapsed = 2; }, TypeError);
  assert.equal(f.animator.trigger('unknown'), false);
});

check('idle and speech exactly preserve original equations with captured rest offsets', () => {
  const f = fixture(true);
  for (const speech of [-100, 0, .2, 1, 100, NaN, Infinity]) {
    for (const time of [0, .25, 1.5, 10, 180]) {
      const context = Object.freeze({ state: 'playing', speech });
      f.animator.update(0, time, context);
      const reaction = Number.isFinite(speech) ? Math.max(0, Math.min(1, speech)) : 0;
      close(f.root.rotation.y, f.rest[0][4] + reaction * .45 + Math.sin(time * .6) * .04, 'idle yaw');
      close(f.arms[0].rotation.x, f.rest[1][3] - .2, 'idle left arm');
      close(f.arms[1].rotation.x, f.rest[2][3] - .2 - reaction * .3, 'speech right arm');
      assertAnchored(f);
    }
  }
});

for (const fps of [20, 30, 60]) {
  check(`finite, anchored, bounded gestures and smooth releases at ${fps} fps`, () => {
    for (const [event, duration] of [['incomingMissile', 2], ['cleanDodge', 1.5], ['hit', 1]]) {
      const f = fixture(true);
      f.animator.update(0, 0, f.context);
      assert(f.animator.trigger(event));
      let before = snapshot(f);
      advance(f, duration, fps, f.context, () => {
        assertAnchored(f); assertBounded(f);
        const after = snapshot(f);
        for (let i = 0; i < 3; i++) for (let j = 0; j < 9; j++) assert(Math.abs(after[i][j] - before[i][j]) < 1.1, 'no hard single-frame pose snap');
        before = after;
      });
      assert.equal(f.animator.activeEvent, null, 'gesture completes at advertised duration');
      close(f.root.rotation.y, f.rest[0][4] + Math.sin(f.time * .6) * .04, 'returns to idle yaw');
      close(f.arms[0].rotation.x, f.rest[1][3] - .2, 'returns to idle arm');
      close(f.arms[1].rotation.z, f.rest[2][5], 'returns to idle arm roll');
    }
  });
  check(`original victory dance equivalence and end priority at ${fps} fps`, () => {
    const f = fixture(true); f.animator.trigger('hit'); advance(f, .1, fps);
    const won = Object.freeze({ state: 'won', speech: 1 });
    advance(f, 10, fps, won, () => {
      expectedDance(f, f.time); assertBounded(f);
      assert.equal(f.animator.activeEvent, null);
      for (const event of Object.values(CAPTAIN_EVENTS)) assert.equal(f.animator.trigger(event), false);
    });
  });
}

check('equal poses at matched animation times across 20/30/60 fps', () => {
  for (const event of Object.values(CAPTAIN_EVENTS)) {
    const samples = [20, 30, 60].map(fps => {
      const f = fixture(true); f.animator.update(0, 0, f.context); f.animator.trigger(event); advance(f, .6, fps); return f;
    });
    comparePose(samples[0], samples[1], event); comparePose(samples[0], samples[2], event);
  }
  const samples = [20, 30, 60].map(fps => {
    const f = fixture(); f.animator.update(0, 0, f.context);
    f.animator.trigger('cleanDodge'); advance(f, .3, fps);
    f.animator.trigger('incomingMissile'); advance(f, .3, fps);
    f.animator.trigger('hit'); advance(f, .3, fps); return f;
  });
  comparePose(samples[0], samples[1], 'preemption'); comparePose(samples[0], samples[2], 'preemption');
});

check('priority hit > missile > dodge, duplicate suppression, and no queued stale celebration', () => {
  const f = fixture();
  assert(f.animator.trigger('cleanDodge'));
  assert.equal(f.animator.trigger('cleanDodge'), false);
  advance(f, .3);
  assert(f.animator.trigger('incomingMissile'));
  assert.equal(f.animator.trigger('cleanDodge'), false);
  advance(f, .3);
  assert(f.animator.trigger('hit'));
  assert.equal(f.animator.trigger('incomingMissile'), false);
  assert.equal(f.animator.trigger('cleanDodge'), false, 'same-frame success suppressed after damage');
  assert.equal(f.animator.trigger('hit'), false, 'damage spam does not extend gesture');
  advance(f, 1.5);
  assert.equal(f.animator.activeEvent, null);
  assert.equal(f.animator.trigger('cleanDodge'), false, 'short post-hit celebration quiet period');
  advance(f, 1);
  assert.equal(f.animator.activeEvent, null, 'nothing replayed after hit');
  assert(f.animator.trigger('cleanDodge'), 'genuinely later clean dodge remains available');
});

check('per-event cooldown rejects immediate repeated gestures but eventually expires', () => {
  for (const [event, duration] of [['incomingMissile', 2], ['cleanDodge', 1.5], ['hit', 1]]) {
    const f = fixture(); assert(f.animator.trigger(event)); advance(f, duration);
    assert.equal(f.animator.trigger(event), false, 'no back-to-back spam');
    advance(f, 1); assert(f.animator.trigger(event));
  }
});

check('pause/help freeze poses, cooldowns and event age, then resume without advancing the gesture', () => {
  const f = fixture(), reference = fixture();
  f.animator.trigger('incomingMissile'); reference.animator.trigger('incomingMissile');
  advance(f, .3); advance(reference, .3);
  const before = snapshot(f), age = f.animator.eventElapsed;
  for (const state of ['paused', 'help']) advance(f, 5, 60, Object.freeze({ state, speech: 1 }), () => {
    assert.deepEqual(snapshot(f), before); assert.equal(f.animator.eventElapsed, age);
    assert.equal(f.animator.trigger('hit'), false);
  });
  advance(f, .3); advance(reference, .3);
  comparePose(f, reference, 'frozen phase resumes'); close(f.animator.eventElapsed, reference.animator.eventElapsed, 'frozen age resumes');
  advance(f, 1.4); assert.equal(f.animator.activeEvent, null);
  assert.equal(f.animator.trigger('incomingMissile'), false, 'pause cannot consume cooldown');
  advance(f, 1); assert(f.animator.trigger('incomingMissile'));
});

check('current-state event argument handles the first frame after resume without admitting paused events', () => {
  const f = fixture();
  advance(f, .2, 60, { state: 'paused' });
  assert.equal(f.animator.trigger('hit'), false);
  assert.equal(f.animator.trigger('hit', 'paused'), false);
  assert(f.animator.trigger('hit', 'playing'), 'event before the first resumed update is retained');
  advance(f, .1);
  assert.equal(f.animator.activeEvent, 'hit');
  assert.equal(f.animator.trigger('incomingMissile', 'help'), false);
  f.animator.reset();
  assert.equal(f.animator.trigger('hit', 'won'), false);
  assert.equal(f.animator.trigger('hit', 'lost'), false);
});

check('won dance also freezes under pause/help and resumes its phase', () => {
  const f = fixture(), reference = fixture(), won = Object.freeze({ state: 'won' });
  advance(f, .5, 60, won); advance(reference, .5, 60, won);
  const before = snapshot(f); advance(f, 4, 60, { state: 'paused' }); assert.deepEqual(snapshot(f), before);
  advance(f, .5, 60, won); advance(reference, .5, 60, won); comparePose(f, reference, 'resumed dance');
});

check('lost discards reactions and returns smoothly to rest, including loss after pause', () => {
  for (const paused of [false, true]) {
    const f = fixture(true); f.animator.trigger('cleanDodge'); advance(f, .5);
    if (paused) advance(f, 3, 60, { state: 'paused' });
    const before = snapshot(f);
    f.animator.update(0, f.time, { state: 'lost' });
    assert.deepEqual(snapshot(f), before, 'loss begins at the displayed pose');
    assert.equal(f.animator.activeEvent, null);
    assert.equal(f.animator.trigger('cleanDodge'), false);
    advance(f, .5, 60, { state: 'lost', speech: 1 });
    assert.deepEqual(snapshot(f), f.rest, 'loss settles exactly to rest');
    advance(f, 5, 60, { state: 'lost' }); assert.deepEqual(snapshot(f), f.rest, 'no stale replay or idle after loss');
  }
});

check('intro discards stale reactions, reset restores all rest transforms and accepts first-frame events', () => {
  const f = fixture(true); f.animator.trigger('incomingMissile'); advance(f, .5);
  f.animator.update(0, f.time, { state: 'intro' });
  assert.equal(f.animator.activeEvent, null); assert.equal(f.animator.trigger('hit'), false);
  f.root.position.z = 99; f.root.scale.x = 4; f.arms[0].position.y = 20;
  f.animator.reset(); assert.deepEqual(snapshot(f), f.rest);
  assert.equal(f.animator.eventElapsed, 0); assert(f.animator.trigger('incomingMissile'), 'reset is ready before next update');
  advance(f, .5); f.animator.reset(); assert.deepEqual(snapshot(f), f.rest);
  assert(f.animator.trigger('hit'), 'reset cleared old cooldown');
});

check('a higher-priority trigger is continuous at zero dt', () => {
  const f = fixture(); f.animator.trigger('cleanDodge'); advance(f, .5);
  let before = snapshot(f); assert(f.animator.trigger('incomingMissile'));
  f.animator.update(0, f.time, f.context); assert.deepEqual(snapshot(f), before);
  advance(f, .5); before = snapshot(f); assert(f.animator.trigger('hit'));
  f.animator.update(0, f.time, f.context); assert.deepEqual(snapshot(f), before);
});

check('invalid time/delta input stays finite and bounded', () => {
  const f = fixture();
  for (const time of [NaN, Infinity, -Infinity, -10, 1e308]) {
    for (const dt of [NaN, Infinity, -Infinity, -1, 0, 1e308]) {
      for (const state of ['playing', 'paused', 'help', 'won', 'lost']) {
        f.animator.update(dt, time, { state, speech: NaN }); assertBounded(f);
      }
    }
  }
});

check('context/game objects remain untouched and fixed animation buffers are reused', () => {
  const f = fixture();
  const run = Object.freeze({ state: 'playing', health: 3, hits: 0, missileId: 1, x: 0, z: -200 });
  const context = Object.freeze({ state: 'playing', speech: .4, run });
  const serialized = JSON.stringify(context);
  const buffers = [f.animator._pose, f.animator._from, f.animator._nextAllowed, f.animator._rootRest, f.animator._leftRest, f.animator._rightRest];
  f.animator.trigger('incomingMissile'); advance(f, 20, 60, context);
  assert.equal(JSON.stringify(context), serialized);
  [f.animator._pose, f.animator._from, f.animator._nextAllowed, f.animator._rootRest, f.animator._leftRest, f.animator._rightRest].forEach((buffer, i) => assert.equal(buffer, buffers[i], 'fixed buffer identity'));
  assert.equal(f.root.children[0], f.arms[0]); assert.equal(f.root.children[1], f.arms[1]);
});

console.log(`PASS: ${checks} captain animation checks, including 20/30/60 fps coverage.`);
