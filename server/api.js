import { randomBytes, randomUUID, createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { replayRun, REPLAY_VERSION, MAX_REPLAY_EVENTS } from '../dist/replay.js';
import { sanitizeCaptainName } from '../dist/captain-name.js';
import { createSupabaseStore } from './store.js';
export const BOARD_VERSION = 'v20-1';
export const MAX_BODY_BYTES = 4 * 1024 * 1024;
const TTL_MS = 30 * 60 * 1000;
const hash = value => createHash('sha256').update(value).digest('hex');
const fail = (status, code, message) => ({ status, body: { error: { code, message } } });
const errors = { missing: [404, 'Run not found.'], token: [403, 'Invalid run token.'], expired: [410, 'This run has expired. Start a new voyage.'], conflict: [409, 'This run was already submitted with different content.'], version: [409, 'Rules changed. Start a new voyage.'], too_fast: [422, 'The replay is longer than the time since this run started.'], rate: [429, 'Too many requests. Please try again later.'] };
function safeEqual(a, b) { return typeof a === 'string' && /^[a-f0-9]{64}$/.test(a) && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex')); }
async function bodyJSON(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw Object.assign(new Error(), { http: 415 });
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) throw Object.assign(new Error(), { http: 413 });
  const reader = request.body?.getReader();
  if (!reader) throw Object.assign(new Error(), { http: 400 });
  const chunks = []; let length = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > MAX_BODY_BYTES) { await reader.cancel(); throw Object.assign(new Error(), { http: 413 }); }
    chunks.push(Buffer.from(value));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Object.assign(new Error(), { http: 400 }); }
}
/** Fetch-standard handler. ip MUST come from the hosting provider, never client headers. */
export function createApi({ store, env = process.env, now = () => Date.now(), replay = replayRun } = {}) {
  return async function handle(request, { ip = 'unknown' } = {}) {
    let outcome;
    try {
      if (!env.LEADERBOARD_RATE_SALT || env.LEADERBOARD_RATE_SALT.length < 32) throw new Error('configuration');
      const db = store || createSupabaseStore(env);
      const path = new URL(request.url).pathname.replace(/\/$/, '');
      const submitMatch = /^\/api\/runs\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/submit$/i.exec(path);
      const scope = path === '/api/leaderboard' && request.method === 'GET' ? 'board' : path === '/api/runs' && request.method === 'POST' ? 'create' : submitMatch && request.method === 'POST' ? 'submit' : null;
      if (!scope) outcome = fail(404, 'not_found', 'Endpoint not found.');
      else {
        // Prevent cross-origin browser writes; no CORS headers are intentionally emitted.
        const origin = request.headers.get('origin');
        if (request.method === 'POST' && origin && origin !== new URL(request.url).origin) return respond(fail(403, 'origin', 'Cross-origin request rejected.'));
        const key = createHmac('sha256', env.LEADERBOARD_RATE_SALT).update(ip).digest('hex');
        const limit = { board: 600, create: 120, submit: 240 }[scope];
        if (!(await db.rate(key, scope, limit, scope === 'board' ? 60 : 3600))) outcome = fail(429, 'rate', errors.rate[1]);
        else if (scope === 'board') outcome = { status: 200, body: await db.board(BOARD_VERSION) };
        else if (scope === 'create') {
          const id = randomUUID(), token = randomBytes(32).toString('base64url');
          const challenge = { id, token_hash: hash(token), seed: randomBytes(4).readUInt32LE(), version: REPLAY_VERSION, board_version: BOARD_VERSION, created_at: new Date(now()).toISOString(), expires_at: new Date(now() + TTL_MS).toISOString() };
          const stored = await db.create(challenge);
          outcome = { status: 201, body: { id, token, seed: challenge.seed, version: REPLAY_VERSION, boardVersion: BOARD_VERSION, expiresAt: stored.expires_at } };
        } else {
          const data = await bodyJSON(request);
          if (!data || typeof data !== 'object' || typeof data.token !== 'string' || data.token.length > 100 || typeof data.name !== 'string' || data.name.length > 256 || !data.replay || !Array.isArray(data.replay.events) || data.replay.events.length > MAX_REPLAY_EVENTS) outcome = fail(400, 'invalid', 'Malformed submission.');
          else {
            const challenge = await db.get(submitMatch[1]);
            if (!challenge) outcome = fail(404, 'missing', errors.missing[1]);
            else if (!safeEqual(challenge.token_hash, hash(data.token))) outcome = fail(403, 'token', errors.token[1]);
            else if (challenge.version !== REPLAY_VERSION || challenge.board_version !== BOARD_VERSION || data.replay.version !== REPLAY_VERSION) outcome = fail(409, 'version', errors.version[1]);
            else {
              const name = sanitizeCaptainName(data.name);
              const digest = hash(JSON.stringify({ name, replay: { version: data.replay.version, events: data.replay.events } }));
              // Existing submissions remain retryable even after challenge expiry.
              if (!challenge.submitted && Date.parse(challenge.expires_at) < now()) outcome = fail(410, 'expired', errors.expired[1]);
              else {
                let result, run;
                if (!challenge.submitted) {
                  try { ({ result, run } = replay(challenge.seed, data.replay)); } catch { outcome = fail(422, 'replay', 'Replay is invalid or the voyage has not ended.'); }
                  if (result && result.time * 1000 > now() - Date.parse(challenge.created_at) + 5000) outcome = fail(422, 'too_fast', errors.too_fast[1]);
                }
                if (!outcome) outcome = { status: 200, body: await db.submit({ id: challenge.id, token_hash: hash(data.token), digest, name, version: REPLAY_VERSION, board_version: BOARD_VERSION, result: result || null, verified_run: run ? {state: run.state,time: run.time,health: run.health,hits: run.hits,distance: run.distance,supportCollected: run.supportCollected} : null }) };
              }
            }
          }
        }
      }
    } catch (error) {
      if (error.http) outcome = fail(error.http, 'body', error.http === 413 ? 'Replay payload is too large.' : 'A valid JSON request body is required.');
      else if (errors[error.code]) outcome = fail(errors[error.code][0], error.code, errors[error.code][1]);
      else outcome = fail(503, 'unavailable', 'Leaderboard temporarily unavailable. Keep this page open and retry.');
    }
    return respond(outcome);
  };
}
function respond({ status, body }) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(status === 429 ? { 'Retry-After': '60' } : {}) } });
}
