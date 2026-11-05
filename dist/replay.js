import {createRun, stepRun, fireIntercept} from './logic.js?v=20';
import {scoreRun} from './scoring.js?v=20';

// Network protocol version pins the approved v20 physics AND scoring rules.
// Never round dt/controls: analog steering and frame-time changes affect physics.
export const REPLAY_VERSION = 'v20-replay-1';
export const MAX_REPLAY_EVENTS = 100000;
export const MAX_RUN_SECONDS = 600;
export const MAX_REPLAY_BYTES = 4 * 1024 * 1024 - 4096;
export class ReplayError extends Error {
  constructor(message) { super(message); this.name = 'ReplayError'; this.code = 'INVALID_REPLAY'; }
}
const finite = n => typeof n === 'number' && Number.isFinite(n);
export function replayRun(seed, replay) {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new ReplayError('Invalid challenge seed.');
  if (!replay || replay.version !== REPLAY_VERSION || !Array.isArray(replay.events) ||
      !replay.events.length || replay.events.length > MAX_REPLAY_EVENTS) throw new ReplayError('Unsupported or oversized replay.');
  const run = createRun({supportSeed: seed});
  for (const event of replay.events) {
    if (!['playing', 'docking'].includes(run.state)) throw new ReplayError('Events follow a finished voyage.');
    if (!Array.isArray(event)) throw new ReplayError('Invalid replay event.');
    if (event.length === 1 && event[0] === 'i') {
      if (!fireIntercept(run)) throw new ReplayError('Impossible interception.');
    } else {
      if (event.length !== 3 || !event.every(finite) || event[0] < 0 || event[0] > .05 ||
          Math.abs(event[1]) > 1 || Math.abs(event[2]) > 1) throw new ReplayError('Invalid frame controls.');
      stepRun(run, {throttle: event[1], steer: event[2]}, event[0]);
      if (run.time > MAX_RUN_SECONDS) throw new ReplayError('Voyage exceeds the ranked replay limit.');
    }
  }
  if (!['won', 'lost'].includes(run.state)) throw new ReplayError('Voyage has not ended.');
  return {run, result: scoreRun(run)};
}

export class ReplayRecorder {
  constructor() { this.events = []; this.seconds = 0; this.bytes = 128; this.error = null; }
  append(event) {
    if (this.error) return;
    if (this.events.length >= MAX_REPLAY_EVENTS) { this.error = 'This voyage exceeded the replay size limit.'; this.events = []; return; }
    this.bytes += JSON.stringify(event).length + 1;
    if(this.bytes > MAX_REPLAY_BYTES){this.error = 'This voyage exceeded the ranked upload size limit.';this.events = [];return;}
    this.events.push(event);
  }
  frame(input, dt) {
    if(this.error)return;
    // Matches stepRun's existing clamp exactly, including a zero-time refresh.
    dt = Number.isFinite(dt) ? Math.min(.05, Math.max(0, dt)) : 0;
    this.seconds += dt;
    if (this.seconds > MAX_RUN_SECONDS) { this.error = 'This voyage exceeded the 10-minute ranked limit.'; this.events = []; return; }
    this.append([dt, input.throttle, input.steer]);
  }
  intercept() { this.append(['i']); }
  snapshot() { return this.error ? null : {version: REPLAY_VERSION, events: this.events.map(event => [...event])}; }
}
