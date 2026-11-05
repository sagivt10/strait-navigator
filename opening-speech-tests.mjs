import assert from 'node:assert/strict';
import {OpeningSpeech} from './dist/opening-speech.js';

let checks = 0;
function check(name, fn) {
  fn();
  checks++;
  console.log(`PASS: ${name}`);
}
const buffer = Object.freeze({id: 'mexico', duration: 7.027});
const tick = (speech, now, play = () => true, extra = {}) => speech.tick(now, {allowed: true, buffer, play, ...extra});
const snapshot = speech => ({
  generation: speech.generation, pending: speech.pending, playing: speech.playing,
  played: speech.played, expiresAt: speech.expiresAt, retryAt: speech.retryAt,
  quietUntil: speech.quietUntil
});

check('constructor is inactive and does not attempt or reserve speech', () => {
  const speech = new OpeningSpeech();
  let calls = 0;
  assert.equal(speech.busy(0), false);
  assert.equal(tick(speech, 0, () => { calls++; return true; }), false);
  assert.equal(calls, 0);
  assert.equal(speech.pending, false);
  assert.equal(speech.playing, false);
  assert.equal(speech.played, false);
});

check('warm buffer starts once with the exact buffer and an end callback', () => {
  const speech = new OpeningSpeech();
  speech.reset(true, 12);
  assert.equal(speech.expiresAt, 20);
  assert.equal(speech.busy(12), true);
  let calls = 0;
  const play = (actual, onEnded) => {
    assert.equal(actual, buffer);
    assert.equal(typeof onEnded, 'function');
    calls++;
    return true;
  };
  assert.equal(tick(speech, 12, play), true);
  assert.equal(speech.pending, false);
  assert.equal(speech.playing, true);
  assert.equal(speech.played, true);
  for (const now of [12, 12.1, 19.027, 20, 100]) assert.equal(tick(speech, now, play), false);
  assert.equal(calls, 1);
  assert.equal(speech.busy(100), true, 'duration estimates cannot release actual playing audio');
});

check('cold buffer reserves speech and starts as soon as loading finishes', () => {
  const speech = new OpeningSpeech();
  speech.reset(true);
  let calls = 0;
  const play = () => { calls++; return true; };
  for (const now of [0, .1, .5, 2, 7.9]) {
    assert.equal(tick(speech, now, play, {buffer: undefined}), false);
    assert.equal(speech.busy(now), true);
    assert.equal(speech.played, false);
  }
  assert.equal(calls, 0);
  assert.equal(tick(speech, 7.95, play), true);
  assert.equal(calls, 1, 'missing buffers do not throttle their first available attempt');
});

check('missing audio expires at exactly eight seconds and cannot arrive late', () => {
  const speech = new OpeningSpeech();
  speech.reset(true, 10);
  assert.equal(tick(speech, 17.999, undefined, {buffer: null}), false);
  assert.equal(speech.busy(17.999), true);
  assert.equal(speech.busy(18), false);
  let calls = 0;
  const play = () => { calls++; return true; };
  assert.equal(tick(speech, 18, play), false);
  assert.equal(speech.pending, false);
  assert.equal(speech.played, false);
  for (const now of [18.1, 20, 100]) assert.equal(tick(speech, now, play), false);
  assert.equal(calls, 0);
});

check('disabled reset never becomes eligible merely by allowing or loading audio', () => {
  const speech = new OpeningSpeech();
  speech.reset(false);
  let calls = 0;
  for (const now of [0, .5, 7, 10]) {
    assert.equal(tick(speech, now, () => { calls++; return true; }), false);
    assert.equal(speech.busy(now), false);
  }
  assert.equal(calls, 0);
  assert.equal(speech.played, false);
});

check('missing play function is safe and does not consume the opening', () => {
  const speech = new OpeningSpeech();
  speech.reset(true);
  for (const play of [undefined, null, false, {}]) {
    assert.equal(speech.tick(0, {allowed: true, buffer, play}), false);
    assert.equal(speech.pending, true);
    assert.equal(speech.played, false);
  }
  assert.equal(tick(speech, .01), true);
});

check('only explicit true accepts playback; other return values remain retryable', () => {
  for (const result of [false, undefined, null, 0, 1, 'true', {}]) {
    const speech = new OpeningSpeech();
    speech.reset(true);
    assert.equal(tick(speech, 0, () => result), false);
    assert.equal(speech.pending, true);
    assert.equal(speech.played, false);
    assert.equal(speech.playing, false);
    assert.equal(speech.busy(0), true);
    assert.equal(tick(speech, .2), true);
  }
});

check('rejected and throwing starts retry no faster than 0.2 seconds', () => {
  for (const mode of ['reject', 'throw']) {
    const speech = new OpeningSpeech();
    speech.reset(true);
    let calls = 0;
    const play = () => { calls++; if (mode === 'throw') throw new Error('Audio unavailable'); return false; };
    for (const now of [0, .01, .05, .1, .199]) assert.equal(tick(speech, now, play), false);
    assert.equal(calls, 1);
    assert.equal(tick(speech, .2, play), false);
    assert.equal(calls, 2);
    assert.equal(speech.played, false);
    assert.equal(tick(speech, .399), false);
    assert.equal(tick(speech, .4), true);
    assert.equal(speech.played, true);
  }
});

check('persistent playback failure is bounded by the loading window', () => {
  const speech = new OpeningSpeech();
  speech.reset(true);
  let calls = 0;
  const play = () => { calls++; return false; };
  for (let frame = 0; frame <= 600; frame++) tick(speech, frame / 60, play);
  assert(calls > 1 && calls <= 40, `expected at most 40 attempts, saw ${calls}`);
  assert.equal(speech.pending, false);
  assert.equal(speech.playing, false);
  assert.equal(speech.played, false);
  assert.equal(speech.busy(10), false);
});

check('natural completion, not metadata, opens a 0.35-second quiet tail', () => {
  const speech = new OpeningSpeech();
  speech.reset(true);
  let ended;
  tick(speech, 0, (_buffer, onEnded) => { ended = onEnded; return true; });
  tick(speech, 20);
  assert.equal(speech.busy(20), true);
  ended();
  assert.equal(speech.playing, false);
  assert.equal(speech.played, true);
  assert.equal(speech.quietUntil, 20.35);
  assert.equal(speech.busy(20), true);
  assert.equal(speech.busy(20.349), true);
  assert.equal(speech.busy(20.35), false);
  assert.equal(tick(speech, 21), false, 'ended opening cannot replay in the same voyage');
});

check('duplicate completion callbacks never extend the quiet tail', () => {
  const speech = new OpeningSpeech();
  speech.reset(true);
  let ended;
  tick(speech, 0, (_buffer, onEnded) => { ended = onEnded; return true; });
  tick(speech, 7);
  ended();
  const quietUntil = speech.quietUntil;
  tick(speech, 7.2);
  ended();
  assert.equal(speech.quietUntil, quietUntil);
  assert.equal(speech.busy(quietUntil), false);
});

check('synchronous successful completion does not leave playback stuck', () => {
  const speech = new OpeningSpeech();
  speech.reset(true, 4);
  assert.equal(tick(speech, 4, (_buffer, ended) => { ended(); ended(); return true; }), true);
  assert.equal(speech.pending, false);
  assert.equal(speech.playing, false);
  assert.equal(speech.played, true);
  assert.equal(speech.quietUntil, 4.35);
  assert.equal(speech.busy(4.349), true);
  assert.equal(speech.busy(4.35), false);
  assert.equal(tick(speech, 5), false);
});

check('synchronous end from rejected or throwing play does not commit completion', () => {
  for (const mode of ['reject', 'throw']) {
    const speech = new OpeningSpeech();
    speech.reset(true);
    assert.equal(tick(speech, 0, (_buffer, ended) => {
      ended();
      if (mode === 'throw') throw new Error('Start failed after callback');
      return false;
    }), false);
    assert.equal(speech.pending, true);
    assert.equal(speech.playing, false);
    assert.equal(speech.played, false);
    assert.equal(speech.quietUntil, 0);
    assert.equal(tick(speech, .2), true);
  }
});

check('callbacks from failed attempts cannot end a later successful attempt', () => {
  const speech = new OpeningSpeech();
  speech.reset(true);
  let rejectedEnded, acceptedEnded;
  tick(speech, 0, (_buffer, ended) => { rejectedEnded = ended; return false; });
  assert.equal(tick(speech, .2, (_buffer, ended) => { acceptedEnded = ended; return true; }), true);
  const before = snapshot(speech);
  rejectedEnded();
  assert.deepEqual(snapshot(speech), before);
  tick(speech, 5);
  acceptedEnded();
  assert.equal(speech.playing, false);
  assert.equal(speech.quietUntil, 5.35);
});

check('mute, pause, help, docking and end cancellation discard pending or playing audio', () => {
  for (const reason of ['mute', 'pause', 'help', 'docking', 'loss', 'victory']) {
    for (const started of [false, true]) {
      const speech = new OpeningSpeech();
      speech.reset(true);
      let ended;
      if (started) tick(speech, 0, (_buffer, callback) => { ended = callback; return true; });
      const generation = speech.generation;
      assert.equal(tick(speech, .1, undefined, {allowed: false}), false, reason);
      assert(speech.generation > generation);
      assert.equal(speech.pending, false);
      assert.equal(speech.playing, false);
      assert.equal(speech.busy(.1), false);
      assert.equal(speech.played, started);
      ended?.();
      assert.equal(speech.quietUntil, 0);
      assert.equal(tick(speech, .2), false, `${reason} cannot resume the opening`);
    }
  }
});

check('explicit cancel clears pending, actual playing and quiet-tail holds', () => {
  for (const stage of ['pending', 'playing', 'quiet']) {
    const speech = new OpeningSpeech();
    speech.reset(true);
    if (stage !== 'pending') tick(speech, 0, (_buffer, ended) => { if (stage === 'quiet') ended(); return true; });
    assert.equal(speech.busy(0), true);
    const generation = speech.generation;
    speech.cancel();
    assert(speech.generation > generation);
    assert.equal(speech.busy(0), false);
    assert.equal(speech.pending, false);
    assert.equal(speech.playing, false);
    assert.equal(speech.quietUntil, 0);
    assert.equal(tick(speech, .1), false);
  }
});

check('every reset starts a fresh voyage without inherited failure or tail timing', () => {
  const speech = new OpeningSpeech();
  for (let voyage = 0; voyage < 5; voyage++) {
    const generation = speech.generation;
    speech.reset(true);
    assert(speech.generation > generation);
    assert.equal(speech.pending, true);
    assert.equal(speech.played, false);
    assert.equal(speech.playing, false);
    assert.equal(speech.quietUntil, 0);
    assert.equal(speech.expiresAt, 8);
    assert.equal(tick(speech, 0, (_buffer, ended) => { ended(); return true; }), true);
    assert.equal(tick(speech, .1), false);
  }
  speech.reset(true, 80);
  tick(speech, 80, () => false);
  speech.reset(true);
  assert.equal(tick(speech, 0), true, 'old retry deadline cannot block a new run');
});

check('old-voyage callback cannot change a new pending, playing or completed run', () => {
  for (const stage of ['pending', 'playing', 'quiet', 'disabled']) {
    const speech = new OpeningSpeech();
    speech.reset(true);
    let staleEnded;
    tick(speech, 0, (_buffer, ended) => { staleEnded = ended; return true; });
    tick(speech, 6);
    speech.reset(stage !== 'disabled', 0);
    if (stage === 'playing' || stage === 'quiet') tick(speech, 0, (_buffer, ended) => {
      if (stage === 'quiet') ended();
      return true;
    });
    const before = snapshot(speech);
    staleEnded();
    assert.deepEqual(snapshot(speech), before, stage);
  }
});

check('reentrant reset or cancel during play cannot commit a stale start', () => {
  for (const change of ['reset', 'cancel']) {
    const speech = new OpeningSpeech();
    speech.reset(true);
    let staleEnded;
    assert.equal(tick(speech, 0, (_buffer, ended) => {
      staleEnded = ended;
      if (change === 'reset') speech.reset(true, 2);
      else speech.cancel();
      return true;
    }), false);
    const before = snapshot(speech);
    staleEnded();
    assert.deepEqual(snapshot(speech), before);
    assert.equal(speech.played, false);
    assert.equal(speech.playing, false);
    assert.equal(speech.pending, change === 'reset');
    if (change === 'reset') assert.equal(tick(speech, 2), true);
  }
});

check('reentrant tick cannot make a second start while the first is unsettled', () => {
  const speech = new OpeningSpeech();
  speech.reset(true);
  let nestedCalls = 0;
  assert.equal(tick(speech, 0, () => {
    assert.equal(tick(speech, 1, () => { nestedCalls++; return true; }), false);
    return true;
  }), true);
  assert.equal(nestedCalls, 0);
  assert.equal(speech.played, true);
  assert.equal(speech.playing, true);
});

console.log(`PASS: ${checks} opening-speech lifecycle checks.`);
