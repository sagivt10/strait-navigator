import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  DEFAULT_CAPTAIN_NAME,
  CAPTAIN_NAME_MAX_LENGTH,
  CAPTAIN_NAME_STORAGE_KEY,
  sanitizeCaptainName,
  loadCaptainName,
  saveCaptainName,
} from './dist/captain-name.js';

let checks = 0;
function test(label, run) {
  run();
  checks++;
  console.log(`PASS: ${label}`);
}

test('default and explicit nickname length contract', () => {
  assert.equal(DEFAULT_CAPTAIN_NAME, 'Captain Tremendous');
  assert.equal(CAPTAIN_NAME_MAX_LENGTH, 24);
  assert.equal(CAPTAIN_NAME_STORAGE_KEY, 'strait-captain-name-v1');
});

test('blank, punctuation-only and invalid values fall back without coercion', () => {
  const throwingObject = { toString() { throw new Error('Do not coerce'); } };
  for (const value of [undefined, null, false, 42, [], {}, throwingObject, '', ' \t\n ', '<>&"', '---_!?', '\u0301\u0308']) {
    assert.equal(sanitizeCaptainName(value), DEFAULT_CAPTAIN_NAME);
  }
});

test('whitespace becomes a single readable space', () => {
  assert.equal(sanitizeCaptainName('  Captain\t\n Big\u00a0\u2003Win  '), 'Captain Big Win');
});

test('normal Unicode names and nickname punctuation survive', () => {
  for (const name of ['קפטן מנצח', '勝利の船長', 'العظيم', 'François', 'शानदार', "Captain O'Win", 'Captain O’Win', 'Big-Win_2.0!?']) {
    assert.equal(sanitizeCaptainName(name), name);
  }
  assert.equal(sanitizeCaptainName('Cafe\u0301'), 'Café');
  assert.equal(sanitizeCaptainName('Ｃａｐｔａｉｎ １２'), 'Captain 12');
  assert.equal(sanitizeCaptainName('A\u200b\u0301'), 'Á');
  assert.equal(sanitizeCaptainName(' \u0301Captain'), 'Captain');
});

test('controls, bidi overrides and invisible formatting cannot disguise a name', () => {
  assert.equal(sanitizeCaptainName('A\u0000\u0007\u007f\u0085B'), 'AB');
  assert.equal(sanitizeCaptainName('Cap\u202eta\u202cin\u2066 Win\u2069'), 'Captain Win');
  assert.equal(sanitizeCaptainName('Cap\u200b\u200c\u200d\u034f\ufe0ftain'), 'Captain');
  assert.equal(sanitizeCaptainName('\u202e\u2066\u200b'), DEFAULT_CAPTAIN_NAME);
  assert.equal(sanitizeCaptainName('A\ud800B\udc00C'), 'ABC');
});

test('HTML payload syntax is removed rather than made executable', () => {
  for (const payload of ['<img src=x onerror="alert(1)">', '<script>alert(1)</script>', '&lt;svg/onload=alert(1)&gt;', '\"/><svg onload=alert(1)>']) {
    const name = sanitizeCaptainName(payload);
    assert(!/[<>&"=/()]/u.test(name), name);
    assert(Array.from(name).length <= CAPTAIN_NAME_MAX_LENGTH);
    assert.equal(sanitizeCaptainName(name), name);
  }
});

test('limit counts Unicode code points, never half of a surrogate pair', () => {
  const astralLetter = '\u{10400}';
  assert.equal(sanitizeCaptainName('A'.repeat(24)), 'A'.repeat(24));
  assert.equal(sanitizeCaptainName('A'.repeat(25)), 'A'.repeat(24));
  assert.equal(sanitizeCaptainName(astralLetter.repeat(25)), astralLetter.repeat(24));
  assert.equal(Array.from(sanitizeCaptainName(`A${astralLetter.repeat(24)}`)).length, 24);
  assert.equal(sanitizeCaptainName('x'.repeat(23) + ' y'), 'x'.repeat(23));
  assert.equal(sanitizeCaptainName('ﬃ'.repeat(9)), 'ffi'.repeat(8));
});

test('sanitization is stable and bounded on mixed Unicode input', () => {
  const pieces = [' Captain ', '\u{10400}', '猫', 'é', '\u0301', '\u202e', '<script>', '\ud800', '\n', '_', '!', 'ﬃ'];
  for (let i = 0; i < 200; i++) {
    const input = Array.from({ length: i % 40 }, (_, j) => pieces[(i * 7 + j * 11) % pieces.length]).join('');
    const result = sanitizeCaptainName(input);
    assert(Array.from(result).length <= CAPTAIN_NAME_MAX_LENGTH);
    assert.equal(result.trim(), result);
    assert.equal(sanitizeCaptainName(result), result);
    assert(!/[\p{C}\p{Default_Ignorable_Code_Point}<>"&]/u.test(result));
  }
});

test('storage writes only one sanitized nickname and reads the same key', () => {
  const values = new Map();
  const calls = [];
  const storage = {
    getItem(key) { calls.push(['get', key]); return values.get(key) ?? null; },
    setItem(key, value) { calls.push(['set', key, value]); values.set(key, value); },
  };
  assert.equal(loadCaptainName(storage), DEFAULT_CAPTAIN_NAME);
  assert.equal(saveCaptainName('  Big\tWinner  ', storage), 'Big Winner');
  assert.equal(loadCaptainName(storage), 'Big Winner');
  assert.equal(values.size, 1);
  assert.deepEqual(calls, [
    ['get', CAPTAIN_NAME_STORAGE_KEY],
    ['set', CAPTAIN_NAME_STORAGE_KEY, 'Big Winner'],
    ['get', CAPTAIN_NAME_STORAGE_KEY],
  ]);
});

test('stored values are sanitized every load, including corrupt non-strings', () => {
  for (const stored of [null, undefined, 7, [], {}, '\u202e']) {
    assert.equal(loadCaptainName({ getItem: () => stored }), DEFAULT_CAPTAIN_NAME);
  }
  assert.equal(loadCaptainName({ getItem: () => '  Cap\u202etain <Win>  ' }), 'Captain Win');
});

test('missing or malformed storage never prevents loading or saving a name', () => {
  for (const storage of [null, false, 1, {}, { getItem: 4, setItem: 4 }]) {
    assert.equal(loadCaptainName(storage), DEFAULT_CAPTAIN_NAME);
    assert.equal(saveCaptainName('Captain Free', storage), 'Captain Free');
  }
});

test('storage failures and throwing method getters are harmless', () => {
  const error = new Error('Unavailable or quota exceeded');
  for (const storage of [
    { getItem() { throw error; }, setItem() { throw error; } },
    { get getItem() { throw error; }, get setItem() { throw error; } },
  ]) {
    assert.equal(loadCaptainName(storage), DEFAULT_CAPTAIN_NAME);
    assert.equal(saveCaptainName('Captain Free', storage), 'Captain Free');
  }
});

test('default storage works without a browser or with a denied localStorage getter', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  try {
    delete globalThis.localStorage;
    assert.equal(loadCaptainName(), DEFAULT_CAPTAIN_NAME);
    assert.equal(saveCaptainName('Captain Free'), 'Captain Free');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() { throw new Error('Browser storage access denied'); },
    });
    assert.equal(loadCaptainName(), DEFAULT_CAPTAIN_NAME);
    assert.equal(saveCaptainName('Captain Free'), 'Captain Free');
    const values = new Map();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) },
    });
    assert.equal(saveCaptainName(' Saved Captain '), 'Saved Captain');
    assert.equal(loadCaptainName(), 'Saved Captain');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

const source = await fs.readFile(new URL('./dist/captain-name.js', import.meta.url), 'utf8');
test('nickname utility has no networking or score persistence', () => {
  assert(!/fetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|sessionStorage/.test(source));
  assert.equal((source.match(/setItem\(/g) ?? []).length, 1);
  assert(source.includes('setItem(CAPTAIN_NAME_STORAGE_KEY, name)'));
});

console.log(`PASS: ${checks} nickname checks; local-only storage is optional and names are bounded and safe.`);
