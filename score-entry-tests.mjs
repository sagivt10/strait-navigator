import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { animateLeaderboardEntry, getRankClimbPositions } from './dist/score-entry.js';

let checks = 0;
function test(name, callback) {
  callback();
  checks++;
  console.log(`PASS: ${name}`);
}

class Events {
  listeners = new Map();
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }
  removeEventListener(type, handler) { this.listeners.get(type)?.delete(handler); }
  dispatch(type) {
    const event = { prevented: false, preventDefault() { this.prevented = true; } };
    for (const handler of [...(this.listeners.get(type) || [])]) handler(event);
    return event;
  }
  listenerCount() { return [...this.listeners.values()].reduce((count, set) => count + set.size, 0); }
}

class Classes extends Set {
  contains(value) { return this.has(value); }
  toggle(value, force) {
    const add = force ?? !this.has(value);
    if (add) this.add(value); else this.delete(value);
    return add;
  }
}

class Element extends Events {
  constructor(doc, classes = '') {
    super();
    this.ownerDocument = doc;
    this.classList = new Classes(classes.split(' ').filter(Boolean));
    this.children = [];
    this.dataset = {};
    this.attributes = new Map();
    this.style = {};
    this.hidden = false;
    this.textContent = '';
    this.parentNode = null;
  }
  get isConnected() { return Boolean(this.parentNode && (this.parentNode === this.ownerDocument || this.parentNode.isConnected)); }
  appendChild(node) {
    node.parentNode?.removeChild(node);
    this.children.push(node);
    node.parentNode = this;
    return node;
  }
  removeChild(node) {
    this.children = this.children.filter(child => child !== node);
    node.parentNode = null;
    return node;
  }
  setAttribute(key, value) { this.attributes.set(key, String(value)); }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  matches(selector) {
    if (selector === '.leader-row[data-final-position]') return this.classList.has('leader-row') && this.dataset.finalPosition !== undefined;
    return selector.startsWith('.') && this.classList.has(selector.slice(1));
  }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  getBoundingClientRect() { return { top: this.parentNode.children.indexOf(this) * 54, height: 54 }; }
  animate(keyframes, options) {
    const animation = { row: this, keyframes, options, cancelled: false, cancel() { this.cancelled = true; } };
    this.ownerDocument.animations.push(animation);
    return animation;
  }
  // Any accidental focus or scroll mutation should fail every test.
  focus() { throw new Error('The animation must not move focus.'); }
  scrollIntoView() { throw new Error('The animation must not scroll.'); }
  scrollTo() { throw new Error('The animation must not scroll.'); }
}

function fixture(position = 1, { count = 7, intersection = false, mutation = true, reduced = false } = {}) {
  let time = 0;
  let id = 0;
  const pending = new Map();
  const historical = [];
  const intersections = [];
  const mutations = [];
  const media = new Events();
  media.matches = reduced;
  const doc = new Events();
  doc.hidden = false;
  doc.animations = [];
  doc.defaultView = {
    performance: { now: () => time },
    setTimeout(callback, delay) {
      const timer = { id: ++id, callback, at: time + delay };
      pending.set(timer.id, timer);
      historical.push(timer);
      return timer.id;
    },
    clearTimeout(timer) { pending.delete(timer); },
    matchMedia: () => media,
  };
  if (intersection) doc.defaultView.IntersectionObserver = class {
    constructor(callback, config) { this.callback = callback; this.config = config; this.connected = true; intersections.push(this); }
    observe(target) { this.target = target; }
    disconnect() { this.connected = false; }
    emit(ratio = 1) { this.callback([{ target: this.target, isIntersecting: ratio > 0, intersectionRatio: ratio }]); }
  };
  if (mutation) doc.defaultView.MutationObserver = class {
    constructor(callback) { this.callback = callback; this.connected = true; mutations.push(this); }
    observe() {}
    disconnect() { this.connected = false; }
  };
  const root = new Element(doc);
  root.parentNode = doc;
  doc.documentElement = root;
  const container = root.appendChild(new Element(doc));
  const board = container.appendChild(new Element(doc, 'demo-board'));
  const body = board.appendChild(new Element(doc, 'leaderboard-body'));
  const skip = board.appendChild(new Element(doc, 'rank-skip hidden'));
  const replay = board.appendChild(new Element(doc, 'rank-replay'));
  const announcement = board.appendChild(new Element(doc, 'rank-announcement'));
  announcement.textContent = position ? `Demo position ${position} of ${count}. Fictional leaderboard.` : '';
  const rows = [];
  for (let n = 1; n <= count; n++) {
    const row = body.appendChild(new Element(doc, `leader-row ${n === position ? 'you' : ''}`));
    row.dataset.finalPosition = String(n);
    row.id = `row-${n}`;
    row.appendChild(new Element(doc, 'board-position'));
    row.appendChild(new Element(doc, 'medal-marker'));
    row.appendChild(new Element(doc, 'medal-icon'));
    rows.push(row);
  }
  function advance(milliseconds) {
    const end = time + milliseconds;
    let iterations = 0;
    while (pending.size) {
      const next = [...pending.values()].sort((a, b) => a.at - b.at)[0];
      if (next.at > end) break;
      assert(++iterations < 100, 'bounded scheduling');
      time = next.at;
      pending.delete(next.id);
      next.callback();
    }
    time = end;
  }
  return { doc, root, container, board, body, skip, replay, announcement, rows, media, pending,
    historical, intersections, mutations, advance, jump(milliseconds) { time += milliseconds; } };
}

function verifyRows(f, final = true) {
  const rows = f.body.children;
  assert.equal(rows.length, f.rows.length, 'row count stays fixed');
  assert.equal(new Set(rows).size, rows.length, 'no duplicated node');
  if (final) assert.deepEqual(rows, f.rows, 'original final order restored');
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    assert.equal(row.querySelector('.board-position').textContent, String(index + 1).padStart(2, '0'));
    for (const [medal, name] of ['medal-gold', 'medal-silver', 'medal-bronze'].entries()) {
      assert.equal(row.classList.has(name), index === medal, `${name} corresponds to displayed position`);
    }
    const icon = row.querySelector('.medal-icon');
    assert.equal(icon.textContent, ['🏆', '🥈', '🥉'][index] || '');
    assert.equal(icon.hidden, index >= 3);
    const marker = row.querySelector('.medal-marker');
    assert.equal(marker.textContent, ['GOLD', 'SILVER', 'BRONZE'][index] || '');
    assert.equal(marker.hidden, index >= 3);
    assert.deepEqual(row.style, {}, 'no leaked inline animation styles');
  }
}

function verifyFinished(f, position) {
  verifyRows(f);
  assert.equal(f.board.getAttribute('data-rank-state'), 'finished');
  assert.equal(f.body.getAttribute('aria-busy'), 'false');
  assert(f.skip.hidden);
  assert(f.skip.classList.has('hidden'));
  assert.equal(f.announcement.textContent, `Demo position ${position} of ${f.rows.length}. Fictional leaderboard.`);
  assert.equal(f.pending.size, 0);
  assert(f.doc.animations.every(animation => animation.cancelled));
}

test('pure climb sequences cover every final position without fake rise', () => {
  for (let count = 1; count <= 7; count++) for (let position = 1; position <= count; position++) {
    assert.deepEqual(getRankClimbPositions(position, count), Array.from({ length: count - position + 1 }, (_, index) => count - index));
  }
  for (const args of [[0], [8], [1, 0], [1, 8], [1.5], [1, 2.5]]) assert.throws(() => getRankClimbPositions(...args), RangeError);
});

for (let position = 1; position <= 7; position++) test(`position ${position}: truthful bottom entry, adjacent climbs, deterministic medals and final state`, () => {
  const f = fixture(position);
  animateLeaderboardEntry(f.container);
  const player = f.rows[position - 1];
  if (position === 7) {
    assert.equal(f.doc.animations.length, 0);
    verifyFinished(f, position);
    return;
  }
  assert.equal(f.body.children.indexOf(player), 6);
  assert.equal(f.body.getAttribute('aria-busy'), 'true');
  assert.equal(f.announcement.textContent, '');
  verifyRows(f, false);
  f.advance(100);
  for (let current = 6; current >= position; current--) {
    assert.equal(f.body.children.indexOf(player) + 1, current);
    verifyRows(f, false);
    assert.equal(f.doc.animations.filter(animation => !animation.cancelled).length, 2);
    f.advance(220);
  }
  verifyFinished(f, position);
  assert.equal(f.doc.animations.length, 2 * (7 - position));
});

test('skip settles immediately and stale timer callbacks cannot mutate it', () => {
  const f = fixture(2);
  animateLeaderboardEntry(f.container);
  f.advance(110);
  const stale = f.historical.map(timer => timer.callback);
  assert(f.skip.dispatch('click').prevented);
  verifyFinished(f, 2);
  stale.forEach(callback => callback());
  f.advance(10000);
  verifyFinished(f, 2);
});

test('finish settles before initial paint and is safe to call repeatedly', () => {
  const f = fixture(1);
  const controller = animateLeaderboardEntry(f.container);
  controller.finish();
  controller.finish();
  f.advance(2000);
  verifyFinished(f, 1);
  assert.equal(f.doc.animations.length, 0);
});

test('replay after completion and rapid replay mid-climb never duplicate listeners or rows', () => {
  const f = fixture(3);
  const controller = animateLeaderboardEntry(f.container);
  f.advance(2000);
  verifyFinished(f, 3);
  for (let index = 0; index < 20; index++) {
    assert(f.replay.dispatch('click').prevented);
    f.advance(110);
    verifyRows(f, false);
    assert.equal(f.replay.listenerCount(), 1);
    assert.equal(f.skip.listenerCount(), 1);
    assert.equal(f.pending.size, 1);
    assert.equal(f.doc.animations.filter(animation => !animation.cancelled).length, 2);
  }
  f.advance(2000);
  verifyFinished(f, 3);
  controller.cancel();
  assert.equal(f.replay.listenerCount(), 0);
  assert.equal(f.skip.listenerCount(), 0);
});

test('cancel removes timers, listeners, observers and motion; late callbacks cannot revive it', () => {
  const f = fixture(1, { intersection: true });
  const controller = animateLeaderboardEntry(f.container);
  const intersection = f.intersections[0];
  intersection.emit();
  f.advance(120);
  const stale = f.historical.map(timer => timer.callback);
  controller.cancel();
  controller.cancel();
  controller.finish();
  intersection.emit();
  stale.forEach(callback => callback());
  f.replay.dispatch('click');
  f.advance(10000);
  verifyRows(f);
  assert.equal(f.board.getAttribute('data-rank-state'), 'cancelled');
  assert.equal(f.pending.size, 0);
  assert.equal(f.doc.listenerCount(), 0);
  assert.equal(f.media.listenerCount(), 0);
  assert.equal(f.skip.listenerCount() + f.replay.listenerCount(), 0);
  assert(f.doc.animations.every(animation => animation.cancelled));
  assert(f.intersections.every(observer => !observer.connected));
  assert(f.mutations.every(observer => !observer.connected));
});

test('new calls automatically cancel the prior controller without stale updates', () => {
  const f = fixture(4, { intersection: true });
  const previous = animateLeaderboardEntry(f.container);
  const oldObserver = f.intersections[0];
  oldObserver.emit();
  f.advance(100);
  const stale = f.historical.map(timer => timer.callback);
  const current = animateLeaderboardEntry(f.container);
  previous.finish();
  previous.cancel();
  oldObserver.emit();
  stale.forEach(callback => callback());
  assert.equal(f.board.getAttribute('data-rank-state'), 'waiting');
  verifyRows(f, false);
  assert.equal(f.body.children.at(-1), f.rows[3]);
  assert.equal(f.announcement.textContent, '');
  assert.equal(f.skip.listenerCount(), 1);
  assert.equal(f.replay.listenerCount(), 1);
  assert.equal(f.doc.listenerCount(), 1);
  assert.equal(f.media.listenerCount(), 1);
  assert.equal(f.mutations.filter(observer => observer.connected).length, 1);
  f.intersections[1].emit();
  f.advance(2000);
  verifyFinished(f, 4);
  current.cancel();
});

test('IntersectionObserver waits for the bottom player row rather than the visible board header', () => {
  const f = fixture(2, { intersection: true });
  animateLeaderboardEntry(f.container);
  assert.equal(f.board.getAttribute('data-rank-state'), 'waiting');
  assert.equal(f.body.getAttribute('aria-busy'), 'false');
  verifyRows(f, false);
  assert.equal(f.body.children.at(-1), f.rows[1]);
  assert.equal(f.announcement.textContent, '', 'do not announce the final position before the climb finishes');
  f.advance(10000);
  assert.equal(f.doc.animations.length, 0);
  const observer = f.intersections[0];
  assert.equal(observer.target, f.rows[1]);
  assert.equal(observer.config.threshold, 0.2);
  observer.callback([{ target: f.board, isIntersecting: true, intersectionRatio: 1 }]);
  assert.equal(f.pending.size, 0, 'seeing the board header must not trigger an off-screen climb');
  observer.emit(0);
  observer.emit(0.19);
  assert.equal(f.pending.size, 0);
  observer.emit(0.2);
  assert.equal(f.board.getAttribute('data-rank-state'), 'animating');
  assert(!observer.connected);
  observer.emit(1);
  assert.equal(f.pending.size, 1);
  f.advance(2000);
  verifyFinished(f, 2);
});

for (const operation of ['skip', 'finish', 'replay']) test(`${operation} works while waiting for visibility`, () => {
  const f = fixture(1, { intersection: true });
  const controller = animateLeaderboardEntry(f.container);
  if (operation === 'finish') controller.finish();
  else f[operation].dispatch('click');
  assert(!f.intersections[0].connected);
  f.intersections[0].emit();
  f.advance(2000);
  verifyFinished(f, 1);
  if (operation !== 'replay') assert.equal(f.doc.animations.length, 0);
});

for (const reduced of ['system', 'option']) test(`${reduced} reduced motion never starts or replays a climb`, () => {
  const f = fixture(1, { intersection: true, reduced: reduced === 'system' });
  animateLeaderboardEntry(f.container, reduced === 'option' ? { reducedMotion: true } : {});
  f.replay.dispatch('click');
  f.advance(2000);
  verifyFinished(f, 1);
  assert.equal(f.doc.animations.length, 0);
  assert.equal(f.intersections.length, 0);
});

test('changing system motion preference settles an in-flight climb', () => {
  const f = fixture(1);
  animateLeaderboardEntry(f.container);
  f.advance(120);
  f.media.matches = true;
  f.media.dispatch('change');
  verifyFinished(f, 1);
  f.replay.dispatch('click');
  verifyFinished(f, 1);
});

for (const initiallyHidden of [false, true]) test(`hidden document ${initiallyHidden ? 'at start' : 'during animation'} settles immediately`, () => {
  const f = fixture(1);
  f.doc.hidden = initiallyHidden;
  animateLeaderboardEntry(f.container);
  if (!initiallyHidden) f.advance(110);
  f.doc.hidden = true;
  f.doc.dispatch('visibilitychange');
  verifyFinished(f, 1);
  f.doc.hidden = false;
  f.doc.dispatch('visibilitychange');
  f.advance(3000);
  verifyFinished(f, 1);
});

test('hidden document settles while waiting for intersection', () => {
  const f = fixture(1, { intersection: true });
  animateLeaderboardEntry(f.container);
  f.doc.hidden = true;
  f.doc.dispatch('visibilitychange');
  f.intersections[0].emit();
  verifyFinished(f, 1);
});

for (const phase of ['waiting', 'animating', 'finished']) test(`DOM removal in ${phase} cleans all retained work`, () => {
  const f = fixture(1, { intersection: phase === 'waiting' });
  animateLeaderboardEntry(f.container);
  if (phase === 'animating') f.advance(110);
  if (phase === 'finished') f.advance(2000);
  f.root.removeChild(f.container);
  f.mutations[0].callback();
  assert.equal(f.board.getAttribute('data-rank-state'), 'cancelled');
  assert.equal(f.pending.size, 0);
  assert.equal(f.skip.listenerCount() + f.replay.listenerCount() + f.doc.listenerCount(), 0);
  assert(f.mutations.every(observer => !observer.connected));
  assert(f.intersections.every(observer => !observer.connected));
  assert(f.doc.animations.every(animation => animation.cancelled));
  verifyRows(f);
});

test('timer guard cancels detached markup without MutationObserver', () => {
  const f = fixture(2, { mutation: false });
  animateLeaderboardEntry(f.container);
  f.root.removeChild(f.container);
  f.advance(2000);
  assert.equal(f.board.getAttribute('data-rank-state'), 'cancelled');
  assert.equal(f.pending.size, 0);
  assert.equal(f.replay.listenerCount(), 0);
  verifyRows(f);
});

test('body replacement cancels even when the outer container stays connected', () => {
  const f = fixture(2);
  animateLeaderboardEntry(f.container);
  f.board.removeChild(f.body);
  f.mutations[0].callback();
  assert.equal(f.pending.size, 0);
  assert.equal(f.replay.listenerCount(), 0);
  assert.equal(f.board.getAttribute('data-rank-state'), 'cancelled');
});

test('duration is bounded under two seconds and delayed timer catches up directly', () => {
  const f = fixture(1);
  animateLeaderboardEntry(f.container, { duration: 999999 });
  f.advance(1801);
  verifyFinished(f, 1);
  const stalled = fixture(1);
  animateLeaderboardEntry(stalled.container);
  stalled.jump(5000);
  stalled.pending.delete(stalled.historical[0].id);
  stalled.historical[0].callback();
  verifyFinished(stalled, 1);
  assert.equal(stalled.doc.animations.length, 0);
});

test('unsupported Web Animations or animation failure shows a stable final board', () => {
  const missing = fixture(1);
  missing.rows[0].animate = undefined;
  animateLeaderboardEntry(missing.container);
  verifyFinished(missing, 1);
  const broken = fixture(1);
  broken.rows.forEach(row => { row.animate = () => { throw new Error('unsupported'); }; });
  animateLeaderboardEntry(broken.container);
  broken.advance(2000);
  verifyFinished(broken, 1);
});

test('unsupported or failing observers fall back to an ordinary bounded climb', () => {
  const f = fixture(1);
  f.doc.defaultView.IntersectionObserver = class { constructor() { throw new Error('unavailable'); } };
  animateLeaderboardEntry(f.container);
  f.advance(2000);
  verifyFinished(f, 1);
});

test('missing player, invalid ranks, extra rows or missing markup cannot produce a false climb', () => {
  const noPlayer = fixture(0);
  animateLeaderboardEntry(noPlayer.container);
  verifyRows(noPlayer);
  assert.equal(noPlayer.doc.animations.length, 0);
  assert.equal(noPlayer.announcement.textContent, '');
  const invalid = fixture(1);
  invalid.rows[6].dataset.finalPosition = '6';
  animateLeaderboardEntry(invalid.container);
  assert.equal(invalid.doc.animations.length, 0);
  assert.equal(invalid.pending.size, 0);
  const extra = fixture(1, { count: 8 });
  animateLeaderboardEntry(extra.container);
  verifyFinished(extra, 1);
  assert.equal(extra.doc.animations.length, 0);
  for (const container of [null, {}, { querySelector: () => null }]) {
    const control = animateLeaderboardEntry(container);
    control.finish();
    control.cancel();
  }
});

test('each supported table size preserves all original row identities', () => {
  for (let count = 1; count <= 7; count++) for (let position = 1; position <= count; position++) {
    const f = fixture(position, { count });
    animateLeaderboardEntry(f.container);
    f.advance(2000);
    verifyFinished(f, position);
  }
});

test('real leaderboard preserves authoritative global announcement', () => {
 const f=fixture(3);
 animateLeaderboardEntry(f.container,{announcementText:'Your voyage ranks 3 of 580.'});
 f.advance(2000);
 assert.equal(f.announcement.textContent,'Your voyage ranks 3 of 580.');
});

const source = await fs.readFile(new URL('./dist/score-entry.js', import.meta.url), 'utf8');
assert(!/localStorage|sessionStorage|fetch\s*\(|XMLHttpRequest|WebSocket|\.focus\s*\(|scrollIntoView|scrollTo\s*\(|cloneNode|innerHTML/.test(source));
console.log(`PASS: ${checks} score-entry checks; no persistence, network, cloning, focus or scroll operations.`);
