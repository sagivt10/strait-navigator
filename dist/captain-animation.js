/**
 * Visual-only, event-driven captain gestures. No THREE dependency, game state,
 * audio, DOM, or per-frame allocations. Poses are offsets from captured rest.
 *
 * Rig contract: Y-up, forward -Z, arms down at rest; captainArms[0]/[1] are
 * left/right shoulder pivots. A future model can supply its named pivots here.
 * Root translation stays anchored during reactions; only the existing victory
 * dance translates/bounces. Call reset() when starting a fresh run.
 */
export const CAPTAIN_EVENTS = Object.freeze({
  INCOMING_MISSILE: 'incomingMissile',
  CLEAN_DODGE: 'cleanDodge',
  HIT: 'hit',
});

const NONE = 0, DODGE = 1, MISSILE = 2, HIT = 3;
const EVENT_NAMES = Object.freeze(['', 'cleanDodge', 'incomingMissile', 'hit']);
const DURATIONS = Object.freeze([0, 1.5, 2, 1]);
const ATTACKS = Object.freeze([0, .2, .24, .085]);
const RELEASES = Object.freeze([0, .4, .48, .38]);
const COOLDOWNS = Object.freeze([0, 2.3, 2.7, 1.2]);
const POSE_SIZE = 8;
// Pose slots: root yaw, root roll, root x/y, left x/z, right x/z.
const YAW = 0, ROLL = 1, X = 2, Y = 3, LX = 4, LZ = 5, RX = 6, RZ = 7;

function clamp01(value) { return Math.max(0, Math.min(1, value)); }
function smooth(value) { const t = clamp01(value); return t * t * (3 - 2 * t); }
function capture(node) {
  if (!node?.position || !node?.rotation || !node?.scale) {
    throw new TypeError('CaptainAnimator requires root and two shoulder transform nodes.');
  }
  const rest = new Float64Array([
    node.position.x, node.position.y, node.position.z,
    node.rotation.x, node.rotation.y, node.rotation.z,
    node.scale.x, node.scale.y, node.scale.z,
  ]);
  for (let i = 0; i < rest.length; i++) {
    if (!Number.isFinite(rest[i])) throw new TypeError('Captain rest transforms must be finite.');
  }
  return rest;
}
function restore(node, rest) {
  node.position.x = rest[0]; node.position.y = rest[1]; node.position.z = rest[2];
  node.rotation.x = rest[3]; node.rotation.y = rest[4]; node.rotation.z = rest[5];
  node.scale.x = rest[6]; node.scale.y = rest[7]; node.scale.z = rest[8];
}

export class CaptainAnimator {
  constructor({ root, captainArms, articulated = false }) {
    this.articulated = !!articulated;
    this.root = root;
    this.leftArm = captainArms?.[0];
    this.rightArm = captainArms?.[1];
    this._rootRest = capture(root);
    this._leftRest = capture(this.leftArm);
    this._rightRest = capture(this.rightArm);
    this._pose = new Float64Array(POSE_SIZE);
    this._from = new Float64Array(POSE_SIZE);
    this._nextAllowed = new Float64Array(4);
    this.reset();
  }

  get activeEvent() { return EVENT_NAMES[this._event] || null; }
  get eventElapsed() { return this._age; }

  /**
   * Returns whether this event was accepted. Rejected events are never queued.
   * Pass the current state when game events precede update() in the frame, so
   * the first event after pause/help resumes is checked against the new state.
   */
  trigger(event, state = this._state) {
    const id = event === 'hit' ? HIT : event === 'incomingMissile' ? MISSILE : event === 'cleanDodge' ? DODGE : NONE;
    if (!id || (state !== 'playing' && state !== 'docking')) return false;
    // Bigger id means higher priority. Repetition never restarts a pose or
    // extends its duration. Discard lower-priority events rather than replaying
    // an old celebration after a threat, hit, pause, or end of the run.
    if (id <= this._event || this._elapsed < this._nextAllowed[id]) return false;
    this._from.set(this._pose);
    this._event = id;
    this._age = 0;
    this._nextAllowed[id] = this._elapsed + COOLDOWNS[id];
    if (id === HIT) this._nextAllowed[DODGE] = Math.max(this._nextAllowed[DODGE], this._elapsed + 1.8);
    return true;
  }

  /** Restore the exact captured rig rest pose, and forget all events/cooldowns. */
  reset() {
    restore(this.root, this._rootRest);
    restore(this.leftArm, this._leftRest);
    restore(this.rightArm, this._rightRest);
    this._pose.fill(0);
    this._from.fill(0);
    this._nextAllowed.fill(0);
    this._event = NONE;
    this._age = 0;
    this._elapsed = 0;
    this._pauseOffset = 0;
    this._sampleTime = 0;
    this._releaseAge = 0;
    this._state = 'playing';
    this._activeState = 'playing';
    return this;
  }

  /**
   * dt/time are seconds; speech is the existing clamped speech reaction (0..1).
   * Reuse the context object if desired. It is only read, never retained/mutated.
   * paused/help freeze both the pose and event/cooldown clocks. won plays the
   * original dance; lost clears events and gently returns to captured rest.
   */
  update(dt, time, context) {
    const state = context?.state ?? 'playing';
    const rawDt = Number.isFinite(dt) ? Math.max(0, dt) : 0;
    const step = Math.min(rawDt, .1);
    if (state === 'paused' || state === 'help') {
      this._pauseOffset += Math.min(rawDt, 1e6);
      if (this._pauseOffset > 1e6) this._pauseOffset %= Math.PI * 10;
      this._state = state;
      return this;
    }
    this._elapsed += step;
    let phase = Number.isFinite(time) ? time - this._pauseOffset : this._sampleTime + step;
    // Keep even malformed, enormous timestamps out of sin(Infinity).
    if (Math.abs(phase) > 1e6) phase %= Math.PI * 10;
    this._sampleTime = phase;
    const previousState = this._activeState;
    this._state = this._activeState = state;

    if (state === 'won') {
      this._clearEvent();
      this._dance(phase);
    } else if (state === 'lost') {
      this._clearEvent();
      if (previousState !== 'lost') {
        this._from.set(this._pose);
        this._releaseAge = 0;
      }
      this._releaseAge = Math.min(.35, this._releaseAge + step);
      const fade = 1 - smooth(this._releaseAge / .35);
      for (let i = 0; i < POSE_SIZE; i++) this._pose[i] = this._from[i] * fade;
    } else {
      const speech = Number.isFinite(context?.speech) ? clamp01(context.speech) : 0;
      this._idle(phase, speech);
      if (state !== 'playing' && state !== 'docking') this._clearEvent();
      if (this._event) {
        this._age += step;
        if (this._age + 1e-9 >= DURATIONS[this._event]) this._clearEvent();
        else this._gesture();
      }
    }
    this._apply();
    return this;
  }

  _clearEvent() { this._event = NONE; this._age = 0; }

  _idle(time, speech) {
    this._pose[YAW] = speech * .45 + Math.sin(time * .6) * .04;
    this._pose[ROLL] = this._pose[X] = this._pose[Y] = 0;
    this._pose[LX] = -.2;
    this._pose[RX] = -.2 - speech * .3;
    this._pose[LZ] = this._pose[RZ] = 0;
  }

  _dance(time) {
    // Retain dance timing/sway; articulated arms swing in front of the torso.
    this._pose[YAW] = Math.PI + Math.sin(time * 2) * .14;
    this._pose[ROLL] = Math.sin(time * 4) * .045;
    this._pose[X] = Math.sin(time * 2) * .12;
    this._pose[Y] = Math.abs(Math.sin(time * 4)) * .12;
    this._pose[LX] = (this.articulated ? .8 : -.8) + Math.sin(time * 4) * .65;
    this._pose[RX] = (this.articulated ? .8 : -.8) + Math.sin(time * 4 + Math.PI) * .65;
    this._pose[LZ] = this._pose[RZ] = Math.sin(time * 4) * .12;
  }

  _gesture() {
    const id = this._event, age = this._age;
    const weight = 1 - smooth((age - DURATIONS[id] + RELEASES[id]) / RELEASES[id]);
    const attack = smooth(age / ATTACKS[id]);
    let yaw, lx, lz, rx, rz;
    if (id === MISSILE) {
      // Turn three-quarter toward the stern camera and hold both hands high.
      const alarm = Math.sin(age * 12) * .1;
      yaw = 2.28 + Math.sin(age * 5) * .04;
      lx = .28 + alarm; rx = .38 + alarm;
      lz = -2.12 - alarm; rz = 2.12 + alarm;
    } else if (id === DODGE) {
      // The near (left) arm stays visible from the stern camera during the turn,
      // with two deliberate celebratory pumps. The far arm would be occluded.
      const pump = .5 + Math.sin(age * Math.PI * 4 - .9) * .5;
      yaw = 1.95 + pump * .06;
      lx = .1 + pump * .55; lz = -1.9 - pump * .45;
      rx = (this.articulated ? 1 : -1) * (.25 + pump * .18); rz = .35 + pump * .12;
    } else {
      // A sharp shoulder recoil, then a guarded brace. Keep feet at deck height:
      // the root can pivot in place, but never pitches, rolls, or translates.
      const recoil = Math.exp(-age * 9) * Math.sin(age * 22);
      const brace = smooth(age / .4);
      yaw = .38 + recoil * .18;
      lx = rx = -1.25 + brace * .35;
      lz = -1.55 + brace * .3; rz = 1.55 - brace * .3;
    }
    this._pose[YAW] += (yaw - this._pose[YAW]) * weight;
    this._pose[LX] += (lx - this._pose[LX]) * weight;
    this._pose[LZ] = lz * weight;
    this._pose[RX] += (rx - this._pose[RX]) * weight;
    this._pose[RZ] = rz * weight;
    // Blend from the last displayed pose, including a preempted gesture.
    // No stateful frame-rate-dependent lerp and no snapping on preemption.
    for (let i = 0; i < POSE_SIZE; i++) this._pose[i] = this._from[i] + (this._pose[i] - this._from[i]) * attack;
  }

  _apply() {
    this.root.rotation.y = this._rootRest[4] + this._pose[YAW];
    this.root.rotation.z = this._rootRest[5] + this._pose[ROLL];
    this.root.position.x = this._rootRest[0] + this._pose[X];
    this.root.position.y = this._rootRest[1] + this._pose[Y];
    this.leftArm.rotation.x = this._leftRest[3] + this._pose[LX];
    this.leftArm.rotation.z = this._leftRest[5] + this._pose[LZ];
    this.rightArm.rotation.x = this._rightRest[3] + this._pose[RX];
    this.rightArm.rotation.z = this._rightRest[5] + this._pose[RZ];
  }
}
