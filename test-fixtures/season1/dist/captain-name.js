// A fictional nickname is the only value saved, locally in this browser.
export const DEFAULT_CAPTAIN_NAME = 'Captain Tremendous';
export const CAPTAIN_NAME_MAX_LENGTH = 24;
export const CAPTAIN_NAME_STORAGE_KEY = 'strait-captain-name-v1';

function defaultSafeLocalStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function sanitizeCaptainName(value) {
  if (typeof value !== 'string') return DEFAULT_CAPTAIN_NAME;

  // Normalize before limiting so compatibility characters cannot expand past
  // the limit. Strip invisible controls and HTML syntax, but retain letters,
  // numbers and combining marks from every language plus simple punctuation.
  const readable = value.normalize('NFKC')
    .replace(/\s+/gu, ' ')
    .replace(/[\p{C}\p{Default_Ignorable_Code_Point}]/gu, '')
    .replace(/[^\p{L}\p{M}\p{N} ._'’!?-]/gu, '')
    .replace(/ +/g, ' ')
    .trim()
    .replace(/^\p{M}+/u, '')
    .normalize('NFKC')
    .trim();
  const name = Array.from(readable).slice(0, CAPTAIN_NAME_MAX_LENGTH).join('').trim();
  return /[\p{L}\p{N}]/u.test(name) ? name : DEFAULT_CAPTAIN_NAME;
}

export function loadCaptainName(storage = defaultSafeLocalStorage()) {
  try {
    return sanitizeCaptainName(storage?.getItem(CAPTAIN_NAME_STORAGE_KEY));
  } catch {
    return DEFAULT_CAPTAIN_NAME;
  }
}

export function saveCaptainName(value, storage = defaultSafeLocalStorage()) {
  const name = sanitizeCaptainName(value);
  try {
    storage?.setItem(CAPTAIN_NAME_STORAGE_KEY, name);
  } catch {
    // Storage is optional: private mode, quota limits or browser policy must
    // never prevent someone from starting a voyage.
  }
  return name;
}
