// Local receipt only: never persist a ranking token, replay, or inferred identity.
export const LAST_VOYAGE_KEY = 'strait-last-saved-voyage-v1';
function browserStorage() { try { return globalThis.localStorage; } catch { return null; } }
function receipt(value) {
  const e = value?.entry;
  if (!e || typeof e.id !== 'string' || !e.id || typeof e.name !== 'string' ||
      !Number.isInteger(e.rank) || e.rank < 1 || !Number.isFinite(e.score) ||
      !['won', 'lost'].includes(e.status)) return null;
  return {entry:{id:e.id, name:e.name, score:e.score, time:e.time, health:e.health,
    status:e.status, rank:e.rank, version:e.version, submittedAt:e.submittedAt},
    total:Number.isInteger(value.total) ? value.total : e.rank};
}
export function loadLastVoyage(storage = browserStorage()) {
  try { return receipt(JSON.parse(storage?.getItem(LAST_VOYAGE_KEY) || 'null')); } catch { return null; }
}
export function rememberVoyage(result, storage = browserStorage()) {
  const next = receipt({entry:result?.entry, total:result?.board?.total});
  if (!next) return null;
  // A delayed retry of an older voyage must not replace a newer receipt.
  const previous = loadLastVoyage(storage);
  if (previous && Date.parse(previous.entry.submittedAt) > Date.parse(next.entry.submittedAt)) return previous;
  try { storage?.setItem(LAST_VOYAGE_KEY, JSON.stringify(next)); } catch { /* Optional storage. */ }
  if (typeof globalThis.CustomEvent === 'function')
    globalThis.document?.dispatchEvent?.(new CustomEvent('voyage-saved', {detail:next}));
  return next;
}
