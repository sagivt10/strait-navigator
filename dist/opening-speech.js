const LOAD_WINDOW = 8;
const RETRY_DELAY = .2;
const QUIET_TAIL = .35;

/** One opening clip per voyage. The caller owns loading and stopping audio. */
export class OpeningSpeech {
  constructor() {
    this.generation = 0;
    this.pending = false;
    this.playing = false;
    this.played = false;
    this.expiresAt = 0;
    this.retryAt = 0;
    this.quietUntil = 0;
    this.now = 0;
    this._attempt = null;
  }

  reset(enabled, now = 0) {
    this.cancel();
    this.pending = Boolean(enabled);
    this.played = false;
    this.now = now;
    this.expiresAt = now + LOAD_WINDOW;
    this.retryAt = now;
  }

  cancel() {
    this.generation++;
    this.pending = false;
    this.playing = false;
    this.quietUntil = 0;
    this._attempt = null;
  }

  tick(now, {allowed, buffer, play} = {}) {
    // Keep the completion callback on the caller's clock, without browser timers.
    this.now = now;
    if (!allowed) {
      this.cancel();
      return false;
    }
    if (!this.pending || this.playing || this._attempt) return false;
    if (now >= this.expiresAt) {
      this.cancel();
      return false;
    }
    if (!buffer || typeof play !== 'function' || now < this.retryAt) return false;

    const attempt = {generation: this.generation, settled: false, accepted: false, ended: false};
    this._attempt = attempt;
    this.retryAt = now + RETRY_DELAY;
    const onEnded = () => {
      if (attempt.generation !== this.generation || this._attempt !== attempt || attempt.ended) return;
      attempt.ended = true;
      // A test double or audio implementation can finish inside play(). Commit
      // that completion only after play explicitly confirms successful start.
      if (!attempt.settled || !attempt.accepted) return;
      this.playing = false;
      this.quietUntil = this.now + QUIET_TAIL;
      this._attempt = null;
    };

    let accepted = false;
    try {
      accepted = play(buffer, onEnded) === true;
    } catch {
      // A blocked/failed start leaves the opening eligible for a bounded retry.
    }
    // Playback can invoke caller code synchronously, including reset/cancel.
    if (attempt.generation !== this.generation || this._attempt !== attempt) return false;
    attempt.settled = true;
    attempt.accepted = accepted;
    if (!accepted) {
      this._attempt = null;
      return false;
    }

    this.pending = false;
    this.played = true;
    this.playing = !attempt.ended;
    this.quietUntil = attempt.ended ? this.now + QUIET_TAIL : 0;
    if (attempt.ended) this._attempt = null;
    return true;
  }

  busy(now = this.now) {
    return (this.pending && now < this.expiresAt) || this.playing || now < this.quietUntil;
  }
}
