import assert from 'node:assert/strict';
import { SCORING_RULES, scoreRun, SAMPLE_RUNS, DEMO_LEADERBOARD, insertDemoRun } from './dist/scoring.js';
import { MAX_SUPPORT_EARNED, SUPPORT_PICKUP_RADIUS, createRun, damage, stepRun } from './dist/logic.js';
import { scoreMarkup } from './dist/score-view.js';

let checks = 0;
function check(name, test) {
  test(); checks++;
  console.log(`PASS: ${name}`);
}
function reconciles(score) {
  assert.equal(score.rows.reduce((sum, row) => sum + row.points, 0), score.total);
  assert.equal(score.earned - score.deducted, score.subtotal);
  assert.equal(score.subtotal + score.floorAdjustment, score.total);
  assert(score.rows.every(row => Number.isSafeInteger(row.points)));
  assert(Number.isSafeInteger(score.total) && score.total >= 0);
  assert.equal(new Set(score.rows.map(row => row.id)).size, score.rows.length);
  assert(score.rows.every(row => row.label && row.detail));
}

check('won run has exact, independently explainable arithmetic', () => {
  const score = scoreRun(SAMPLE_RUNS.won);
  assert.equal(score.total, 4100);
  assert.equal(score.earned, 4500);
  assert.equal(score.deducted, 400);
  assert.equal(score.grade, 'B');
  assert.deepEqual(score.rows.map(row => row.points), [1800, 2000, 300, 0, 400, -400]);
  assert.equal(score.statusLabel, 'Docked safely');
  assert.equal(score.provisional, true);
  assert.match(score.modelLabel, /provisional.*mock/i);
  reconciles(score);
});

check('lost run retains route points but cannot earn completion or time points', () => {
  const score = scoreRun(SAMPLE_RUNS.lost);
  assert.equal(score.total, 680);
  assert.equal(score.progress, 1480);
  assert.equal(score.earned, 1480);
  assert.equal(score.deducted, 800);
  assert.equal(score.status, 'lost');
  assert.deepEqual(score.rows.map(row => row.points), [1480, 0, 0, 0, 0, -800]);
  reconciles(score);
  for (const state of ['playing', 'docking', 'lost', 'unknown']) {
    const unfinished = scoreRun({ ...SAMPLE_RUNS.won, state, time: 0 });
    assert.equal(unfinished.rows.find(row => row.id === 'docking').points, 0);
    assert.equal(unfinished.rows.find(row => row.id === 'time').points, 0);
  }
});

check('negative subtotal has an explicit zero-floor ledger adjustment', () => {
  const score = scoreRun({ state: 'lost', distance: 125.9, health: 0, hits: 3, time: 10 });
  assert.equal(score.total, 0);
  assert.equal(score.subtotal, -1075);
  assert.equal(score.floorAdjustment, 1075);
  assert.equal(score.earned, 125, 'zero-floor adjustment is not an earned bonus');
  assert.equal(score.rows.at(-1).id, 'zero-floor');
  assert.equal(score.rows.at(-1).points, 1075);
  reconciles(score);
});

check('route, hull and hit counts are whole, bounded values', () => {
  const high = scoreRun({ state: 'won', distance: 99999, health: 99999, hits: 1.9, time: 180 });
  assert.equal(high.progress, 1800);
  assert.equal(high.progressPercent, 100);
  assert.equal(high.health, 2);
  assert.equal(high.hits, 1);
  assert.equal(high.total, 4000);
  const partial = scoreRun({ distance: 999.99, health: 2.99, hits: 0 });
  assert.equal(partial.progress, 999);
  assert.equal(partial.health, 2);
  const negative = scoreRun({ state: 'lost', distance: -100, health: -2, hits: -3, time: -12 });
  assert.equal(negative.total, 0);
  assert.equal(negative.time, 0);
  reconciles(high); reconciles(partial); reconciles(negative);
});

check('time uses ceiling at second boundaries and never becomes a penalty', () => {
  const base = { state: 'won', distance: 1800, health: 2, hits: 0 };
  for (const [time, bonus] of [[0, 1800], [139, 410], [139.001, 400], [179, 10], [179.001, 0], [180, 0], [181, 0], [99999, 0]]) {
    const score = scoreRun({ ...base, time });
    assert.equal(score.rows.find(row => row.id === 'time').points, bonus);
    assert.equal(score.timeSeconds, Math.ceil(time));
    reconciles(score);
  }
  assert.equal(scoreRun({ ...base, time: NaN }).secondsSaved, 0, 'invalid times must not receive a fabricated speed bonus');
});

check('each additional hit reduces the same run by 400 until the floor', () => {
  let previous = Infinity;
  for (let hits = 0; hits < 20; hits++) {
    const score = scoreRun({ ...SAMPLE_RUNS.won, hits });
    assert(score.total <= previous);
    assert.equal(score.total, Math.max(0, 4500 - 400 * hits));
    previous = score.total;
    reconciles(score);
  }
});

check('repeatable gameplay counters cannot farm score beyond two physical supply pickups', () => {
  const expected = scoreRun(SAMPLE_RUNS.won);
  const counters = {
    ...SAMPLE_RUNS.won, droneDodges: 100000, dodgedDrones: [0, 0, 1, 1, 2],
    failedDrones: [], intercepted: [0, 1, 2, 3, 4, 5],
    missilesDodged: 100000, missileId: 100000, distanceTravelled: 999999,
    supportEarned: 100000, supportDispatched: 100000, supportDelivered: 100000,
    supportIgnored: 100000, missilesIntercepted: 100000,
  };
  assert.deepEqual(scoreRun(counters), expected, 'only physical collection counts');
  const farmed = scoreRun({ ...counters, supportCollected: 100000 });
  assert.equal(farmed.total, expected.total + 500);
  assert.equal(farmed.supportCollected, 2);
  assert.equal(farmed.rows.find(row => row.id === 'supplies').points, 500);
  assert.deepEqual(farmed, scoreRun({ ...SAMPLE_RUNS.won, supportCollected: 2 }));
  assert.equal(scoreRun({ ...SAMPLE_RUNS.won, distance: 999999 }).total, expected.total);
  reconciles(farmed);
});

check('collected supplies earn 250 each in current, docking, won and lost runs', () => {
  for (const state of ['playing', 'docking', 'won', 'lost']) {
    const base = { ...SAMPLE_RUNS.won, state };
    for (const supportCollected of [0, 1, 2]) {
      const score = scoreRun({ ...base, supportCollected });
      const row = score.rows.find(row => row.id === 'supplies');
      assert.equal(score.total, scoreRun(base).total + supportCollected * 250);
      assert.equal(score.supportCollected, supportCollected);
      assert.equal(row.label, 'Supply crates collected');
      assert.equal(row.points, supportCollected * 250);
      assert.match(row.detail, new RegExp(`${supportCollected} crates? × 250 points`));
      assert.match(row.detail, /up to 2 physical pickups/);
      reconciles(score);
    }
  }
});

check('supply counts are whole and clamped, with no fabricated pickup for invalid input', () => {
  for (const [value, count] of [[-3, 0], [-.5, 0], [0, 0], [.99, 0], [1, 1], [1.99, 1], [2, 2], [2.99, 2], [999999, 2], [Number.MAX_VALUE, 2]]) {
    const score = scoreRun({ ...SAMPLE_RUNS.won, supportCollected: value });
    assert.equal(score.supportCollected, count);
    assert.equal(score.total, 4100 + count * 250);
    reconciles(score);
  }
  for (const value of [undefined, null, NaN, Infinity, -Infinity, '2', {}, [], true, Symbol('invalid')]) {
    const score = scoreRun({ ...SAMPLE_RUNS.won, supportCollected: value });
    assert.equal(score.supportCollected, 0);
    assert.equal(score.total, 4100);
    reconciles(score);
  }
});

check('physical life pickup adds 250 supply points plus 300 hull points without erasing damage', () => {
  const run = createRun({ supportSeed: 2 });
  damage(run, 'missile');
  run.distance = 600;
  run.supportEarned = 1;
  run.supportDispatched = 1;
  run.supportDelivered = 1;
  run.supportDrop = { id: 1, kind: 'health', x: run.x, z: run.z, spawnedAt: run.time, expiresAt: run.time + 45, radius: SUPPORT_PICKUP_RADIUS };
  const before = scoreRun(run);
  stepRun(run, {}, 1 / 60);
  const after = scoreRun(run);
  assert.equal(run.supportCollected, 1);
  assert.equal(run.supportDrop, null);
  assert.equal(run.health, 2);
  assert.equal(run.hits, 1);
  assert.equal(after.total - before.total, 550);
  assert.equal(after.rows.find(row => row.id === 'supplies').points, 250);
  assert.equal(after.rows.find(row => row.id === 'hull').points - before.rows.find(row => row.id === 'hull').points, 300);
  assert.equal(after.rows.find(row => row.id === 'hits').points, -400);
  for (let frame = 0; frame < 120; frame++) stepRun(run, {}, 1 / 60);
  assert.equal(scoreRun(run).total, after.total, 'consumed crate cannot award a second bonus');
  reconciles(before); reconciles(after);
});

check('boost, ammunition and shield crates earn the same one-time pickup bonus', () => {
  for (const kind of ['boost', 'intercept', 'shield']) {
    const run = createRun({ supportSeed: 2 });
    run.supportEarned = 1;
    run.supportDispatched = 1;
    run.supportDelivered = 1;
    run.supportDrop = { id: 1, kind, x: run.x, z: run.z, spawnedAt: run.time, expiresAt: run.time + 45, radius: SUPPORT_PICKUP_RADIUS };
    const before = scoreRun(run);
    stepRun(run, {}, 1 / 60);
    const after = scoreRun(run);
    assert.equal(run.supportCollected, 1);
    assert.equal(run.lastSupportPickup.kind, kind);
    assert.equal(after.total - before.total, 250);
    assert.equal(after.rows.find(row => row.id === 'supplies').points, 250);
    for (let frame = 0; frame < 120; frame++) stepRun(run, {}, 1 / 60);
    assert.equal(scoreRun(run).total, after.total);
    if (kind === 'shield') {
      run.missiles = [1, 2].map(id => ({ id, start: run.time - 2.5, impactAt: run.time + .5, x: run.x, z: run.z, fromX: run.x + 70, fromZ: run.z, radius: 10, resolved: false }));
      stepRun(run, {}, 1 / 60);
      assert.equal(run.missilesIntercepted, 2);
      assert.equal(run.shieldCharges, 0);
      assert.equal(scoreRun(run).total, after.total, 'automatic shield interceptions cannot farm points');
      assert.equal(run.supportCollected, 1);
    }
    reconciles(after);
  }
});

check('supply points participate in the same transparent zero-floor ledger', () => {
  const score = scoreRun({ state: 'lost', distance: 0, health: 0, hits: 2, supportCollected: 2 });
  assert.equal(score.total, 0);
  assert.equal(score.earned, 500);
  assert.equal(score.deducted, 800);
  assert.equal(score.subtotal, -300);
  assert.equal(score.floorAdjustment, 300);
  reconciles(score);
});

check('supply pickup changes the local demo position without changing fictional scores', () => {
  const score = scoreRun({ ...SAMPLE_RUNS.won, supportCollected: 1 });
  const before = JSON.stringify(DEMO_LEADERBOARD);
  assert.equal(score.total, 4350);
  assert.equal(score.grade, 'A');
  const rows = insertDemoRun(score);
  assert.equal(rows.find(row => row.isPlayer).demoPosition, 3);
  assert.equal(rows.find(row => row.isPlayer).score, 4350);
  assert.equal(JSON.stringify(DEMO_LEADERBOARD), before);
  assert.equal(insertDemoRun(scoreRun(SAMPLE_RUNS.won)).find(row => row.isPlayer).demoPosition, 4);
});

check('scorecard discloses bounded pickup rules, retained hit costs and demo-only ranking', () => {
  const markup = scoreMarkup({ ...SAMPLE_RUNS.won, supportCollected: 1 });
  assert.match(markup, /Supply crates collected/);
  assert.match(markup, /1 crate × 250 points \(up to 2 physical pickups\)/);
  assert.match(markup, /\+250 per physically collected supply crate \(up to 2\)/);
  assert.match(markup, /Life crates can also restore a hull point, worth \+300 in the hull tally/);
  assert.match(markup, /never erase damage penalties/);
  assert.match(markup, /shield interceptions award no direct points/);
  assert.match(markup, /PROVISIONAL SCORE/);
  assert.match(markup, /fictional rivals and sample scores/);
  assert.match(markup, /No account\. No upload\. No live rankings\./);
  assert.doesNotMatch(markup, /Pickups, drone shots.*award no direct points/);
});

check('missing, non-numeric and non-finite inputs stay safe and finite', () => {
  for (const value of [undefined, null, NaN, Infinity, -Infinity, '1800', {}, [], true, Symbol('invalid')]) {
    const score = scoreRun({ state: 'won', distance: value, health: value, hits: value, time: value, supportCollected: value });
    for (const key of ['total', 'subtotal', 'earned', 'deducted', 'time', 'health', 'hits', 'progress', 'progressPercent', 'supportCollected']) assert(Number.isFinite(score[key]), key);
    reconciles(score);
  }
  for (const run of [undefined, null, 3, 'run']) reconciles(scoreRun(run));
  reconciles(scoreRun({ hits: Number.MAX_VALUE, time: Number.MAX_VALUE, distance: Number.MAX_VALUE, health: Number.MAX_VALUE, supportCollected: Number.MAX_VALUE }));
});

check('scoring is deterministic and never changes the run', () => {
  const run = Object.freeze({ ...SAMPLE_RUNS.won, supportCollected: 2.9, dodgedDrones: Object.freeze([1, 2]), intercepted: Object.freeze([0]) });
  const before = JSON.stringify(run);
  assert.deepEqual(scoreRun(run), scoreRun(run));
  assert.equal(JSON.stringify(run), before);
  assert(Object.isFrozen(SAMPLE_RUNS));
  assert(Object.isFrozen(SAMPLE_RUNS.won));
  assert(Object.isFrozen(SAMPLE_RUNS.lost));
});

check('fictional leaderboard is fixed, clearly labelled, and arithmetic-consistent', () => {
  assert.equal(DEMO_LEADERBOARD.length, 6);
  assert(Object.isFrozen(DEMO_LEADERBOARD));
  assert(DEMO_LEADERBOARD.every(row => Object.isFrozen(row) && row.isSample && !row.isPlayer && row.provisional && /fictional sample/i.test(row.label)));
  assert.deepEqual(DEMO_LEADERBOARD.map(row => row.score), [4930, 4750, 4180, 3860, 3920, 760]);
  assert.equal(new Set(DEMO_LEADERBOARD.map(row => row.id)).size, 6);
  for (const row of DEMO_LEADERBOARD) {
    const computed = scoreRun({ state: row.status, time: row.time, health: row.health, hits: 2 - row.health, distance: row.status === 'lost' ? 1560 : 1800 });
    assert.equal(computed.total, row.score);
  }
});

check('one local run is inserted without saving or mutating sample history', () => {
  const before = JSON.stringify(DEMO_LEADERBOARD);
  const score = Object.freeze(scoreRun(SAMPLE_RUNS.won));
  const rows = insertDemoRun(score);
  assert.equal(rows.length, 7);
  assert.equal(rows.filter(row => row.isPlayer).length, 1);
  const local = rows.find(row => row.isPlayer);
  assert.equal(local.demoPosition, 4);
  assert.equal(local.score, 4100);
  assert.equal(local.isSample, false);
  assert.equal(local.label, 'Your run · local mock');
  assert.equal(local.name, 'You');
  assert.equal(local.provisional, true);
  assert.deepEqual(rows.map(row => row.demoPosition), [1, 2, 3, 4, 5, 6, 7]);
  assert(rows.every(row => !Object.hasOwn(row, 'rank')));
  rows[0].name = 'A caller changed its copy';
  assert.equal(JSON.stringify(DEMO_LEADERBOARD), before);
  assert.equal(insertDemoRun(score).filter(row => row.isPlayer).length, 1);
  assert.deepEqual(insertDemoRun(score), insertDemoRun(score));
});

check('demo sorting handles score, time, hull and exact ties predictably', () => {
  const position = row => insertDemoRun(row).find(item => item.isPlayer).demoPosition;
  assert.equal(position({ total: 6000, time: 400, health: 1 }), 1);
  assert.equal(position({ total: 0, time: 1, health: 3 }), 7);
  assert.equal(position({ total: 4180, time: 131, health: 1 }), 3, 'faster breaks score ties');
  assert.equal(position({ total: 4180, time: 133, health: 3 }), 4, 'slower follows the sample');
  assert.equal(position({ total: 4180, time: 132, health: 2 }), 3, 'more hull breaks equal times');
  assert.equal(position({ total: 4180, time: 132, health: 0 }), 4, 'less hull follows');
  assert.equal(position({ total: 4180, time: 132, health: 1 }), 4, 'sample wins an exact tie by fixed source order');
  for (const invalid of [undefined, null, NaN, 'invalid', { total: Infinity, time: NaN, health: -3 }]) {
    assert(insertDemoRun(invalid).every(row => Number.isFinite(row.score) && Number.isFinite(row.time) && Number.isFinite(row.health)));
  }
});

assert.equal(SCORING_RULES.routeLength, 1800);
assert.equal(SCORING_RULES.maxHealth, 2);
assert.equal(SCORING_RULES.pointsPerSupply, 250);
assert.equal(SCORING_RULES.maxSupplies, MAX_SUPPORT_EARNED);
assert.equal(MAX_SUPPORT_EARNED, 2);
assert.match(scoreRun(SAMPLE_RUNS.won).rows.find(row => row.id === 'hull').detail, /1 \/ 2 hull/);
console.log(`PASS: ${checks} scoring and demo-leaderboard checks.`);
