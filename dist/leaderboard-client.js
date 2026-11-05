import {REPLAY_VERSION} from './replay.js';
import {ReplayOutbox} from './replay-outbox.js';

export class LeaderboardClient {
  constructor({fetcher = globalThis.fetch?.bind(globalThis), outbox = new ReplayOutbox(), now = Date.now,
    wait = ms => new Promise(resolve => setTimeout(resolve, ms)), timeoutMs = 8000, submitTimeoutMs = 45000} = {}) {
    this.fetcher = fetcher; this.outbox = outbox; this.now = now; this.wait = wait;
    this.timeoutMs = timeoutMs; this.submitTimeoutMs = submitTimeoutMs;
    this.pending = new Map(); this.inflight = new Map(); this.expiredCount = 0;
  }
  async restore() {
    try {
      for (const item of await this.outbox.list()) {
        if (!item?.challenge?.id || !item?.body?.token || item.body.replay?.version !== REPLAY_VERSION) continue;
        // Retain expired submissions too: an earlier request may have committed.
        // The server can return that existing receipt even after challenge expiry.
        item.persisted = true; this.pending.set(item.challenge.id, item);
      }
    } catch { /* Storage failures must never block starting or sending a run. */ }
  }
  async request(path, options = {}) {
    if (!this.fetcher) throw new Error('Leaderboard connection is unavailable.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), path.endsWith('/submit') ? this.submitTimeoutMs : this.timeoutMs);
    try {
      const response = await this.fetcher(`/api${path}`, {cache:'no-store', credentials:'same-origin', ...options,
        headers:{'Content-Type':'application/json', ...options.headers}, signal:controller.signal});
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.error?.message || 'Leaderboard service unavailable.');
        error.status = response.status; error.code = data.error?.code; throw error;
      }
      return data;
    } finally { clearTimeout(timer); }
  }
  async begin() {
    try {
      const challenge = await this.request('/runs', {method:'POST', body:'{}'});
      if (!challenge?.id || !challenge.token || challenge.version !== REPLAY_VERSION ||
          !Number.isInteger(challenge.seed) || !Number.isFinite(Date.parse(challenge.expiresAt))) throw new Error('Unsupported ranking service.');
      return challenge;
    } catch { return null; }
  }
  async board() { return this.request('/leaderboard'); }
  queue(challenge, name, replay) {
    const item = {challenge, body:{token:challenge.token, name, replay}, persisted:false};
    this.pending.set(challenge.id, item);
    item.persistence = this.outbox.put({challenge,body:item.body}).then(()=>{item.persisted=true;},()=>{});
    return item;
  }
  submit(item) {
    const id = item.challenge.id;
    if (this.inflight.has(id)) return this.inflight.get(id);
    const work = this.submitWithRetry(item).finally(() => this.inflight.delete(id));
    this.inflight.set(id, work); return work;
  }
  async submitWithRetry(item) {
    await item.persistence;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await this.request(`/runs/${encodeURIComponent(item.challenge.id)}/submit`, {method:'POST', body:JSON.stringify(item.body)});
        if (!result?.entry?.id || !result.board?.entries) throw new Error('Incomplete ranking response.');
        this.pending.delete(item.challenge.id); await this.outbox.delete(item.challenge.id).catch(()=>{}); return result;
      } catch (error) {
        const terminal = error.status >= 400 && error.status < 500 && error.status !== 429;
        if (terminal) { this.pending.delete(item.challenge.id); await this.outbox.delete(item.challenge.id).catch(()=>{}); }
        if (terminal || attempt === 2) throw error;
        await this.wait(700 * 2 ** attempt);
      }
    }
  }
  async retryPending() {
    await this.restore();
    return Promise.allSettled([...this.pending.values()].map(item => this.submit(item)));
  }
}
