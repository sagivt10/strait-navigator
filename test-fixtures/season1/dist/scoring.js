import {MAX_HEALTH, MAX_SUPPORT_EARNED} from './logic.js?v=20';

// Client-only design mock. These provisional rules are not an authoritative
// score service, and the fictional table is neither stored nor submitted.
export const SCORING_RULES = Object.freeze({
  routeLength: 1800,
  maxHealth: MAX_HEALTH,
  pointsPerMetre: 1,
  dockingBonus: 2000,
  pointsPerHull: 300,
  maxSupplies: MAX_SUPPORT_EARNED,
  pointsPerSupply: 250,
  targetSeconds: 180,
  pointsPerSecond: 10,
  pointsPerHit: 400,
});

const MAX_HITS = Math.floor(Number.MAX_SAFE_INTEGER / SCORING_RULES.pointsPerHit);
const MODEL_LABEL = 'Provisional scoring mock';
const finite = (value, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const whole = (value, max) => Math.floor(clamp(finite(value), 0, max));
const elapsed = value => clamp(finite(value, SCORING_RULES.targetSeconds), 0, Number.MAX_SAFE_INTEGER);
const statusLabels = Object.freeze({ won: 'Docked safely', lost: 'Voyage lost', playing: 'Under way', docking: 'Docking' });

/** Pure, deterministic mock scoring. The supplied live run is never changed. */
export function scoreRun(run = {}) {
  run = run && typeof run === 'object' ? run : {};
  const status = Object.hasOwn(statusLabels, run.state) ? run.state : 'playing';
  const won = status === 'won';
  const time = elapsed(run.time);
  const timeSeconds = Math.ceil(time);
  const health = whole(run.health, SCORING_RULES.maxHealth);
  const supportCollected = whole(run.supportCollected, SCORING_RULES.maxSupplies);
  const hits = whole(run.hits, MAX_HITS);
  const progress = whole(run.distance, SCORING_RULES.routeLength);
  const secondsSaved = won ? Math.max(0, SCORING_RULES.targetSeconds - timeSeconds) : 0;
  const rows = [
    {
      id: 'route', label: 'Route covered',
      detail: `${progress.toLocaleString('en-US')} / 1,800 whole metres × 1 point`,
      points: progress * SCORING_RULES.pointsPerMetre,
    },
    {
      id: 'docking', label: 'Safe docking',
      detail: won ? 'Voyage completed at the dock' : 'Awarded only after a completed docking',
      points: won ? SCORING_RULES.dockingBonus : 0,
    },
    {
      id: 'hull', label: 'Hull remaining',
      detail: `${health} / ${SCORING_RULES.maxHealth} hull points × 300 points`,
      points: health * SCORING_RULES.pointsPerHull,
    },
    {
      id: 'supplies', label: 'Supply crates collected',
      detail: `${supportCollected} ${supportCollected === 1 ? 'crate' : 'crates'} × ${SCORING_RULES.pointsPerSupply} points (up to ${SCORING_RULES.maxSupplies} physical pickups)`,
      points: supportCollected * SCORING_RULES.pointsPerSupply,
    },
    {
      id: 'time', label: 'Time bonus',
      detail: won
        ? `${secondsSaved} seconds under 3:00 × 10 points (finish rounded up)`
        : 'Awarded only after a completed voyage',
      points: secondsSaved * SCORING_RULES.pointsPerSecond,
    },
    {
      id: 'hits', label: 'Damage taken',
      detail: `${hits.toLocaleString('en-US')} ${hits === 1 ? 'hit' : 'hits'} × −400 points`,
      points: hits ? -hits * SCORING_RULES.pointsPerHit : 0,
    },
  ];
  const earned = rows.reduce((sum, row) => sum + Math.max(0, row.points), 0);
  const deducted = hits * SCORING_RULES.pointsPerHit;
  const subtotal = earned - deducted;
  const floorAdjustment = Math.max(0, -subtotal);
  if (floorAdjustment) rows.push({
    id: 'zero-floor', label: 'Minimum score adjustment',
    detail: 'Scores stop at zero; this is not an earned bonus', points: floorAdjustment,
  });
  const total = Math.max(0, subtotal);
  // Letter grades, like the weights above, are only presentation placeholders.
  const grade = total >= 5000 ? 'S' : total >= 4300 ? 'A' : total >= 3500 ? 'B' : total >= 2000 ? 'C' : 'D';
  return {
    total, subtotal, earned, deducted, floorAdjustment, grade, status,
    statusLabel: statusLabels[status], time, timeSeconds, health, hits, progress, supportCollected,
    progressPercent: Math.round(progress / SCORING_RULES.routeLength * 100),
    secondsSaved, rows, provisional: true, modelLabel: MODEL_LABEL,
    scoringNote: `Physical supply pickups award +${SCORING_RULES.pointsPerSupply} points each, up to ${SCORING_RULES.maxSupplies} crates per voyage. Dispatch, delivery, ignored crates, drones, missiles and shield interceptions award no direct points in this mock.`,
  };
}

// Fixed synthetic results make previews and tests reproducible. Not player data.
export const SAMPLE_RUNS = Object.freeze({
  won: Object.freeze({ state: 'won', time: 139.25, health: 1, hits: 1, distance: 1800 }),
  lost: Object.freeze({ state: 'lost', time: 112.8, health: 0, hits: 2, distance: 1480.6 }),
});

const sample = (id, name, run) => {
  const result = scoreRun(run);
  return Object.freeze({
    id, name, score: result.total, time: result.time, health: result.health,
    status: result.status, isSample: true, isPlayer: false, label: 'Fictional sample',
    provisional: true,
  });
};

export const DEMO_LEADERBOARD = Object.freeze([
  sample('sample-dock-sparrow', 'Captain Dock Sparrow', { state: 'won', time: 127, health: 2, hits: 0, distance: 1800 }),
  sample('sample-buoy-george', 'Buoy George', { state: 'won', time: 145, health: 2, hits: 0, distance: 1800 }),
  sample('sample-pier-pressure', 'Pier Pressure', { state: 'won', time: 132, health: 1, hits: 1, distance: 1800 }),
  sample('sample-codfather', 'The Codfather', { state: 'won', time: 164, health: 1, hits: 1, distance: 1800 }),
  sample('sample-sails-a-lot', 'Sir Sails-a-Lot', { state: 'won', time: 158, health: 1, hits: 1, distance: 1800 }),
  sample('sample-unsinkable', 'Unsinkable-ish', { state: 'lost', time: 118, health: 0, hits: 2, distance: 1560 }),
]);

/** Return six fictional rows plus this one local result. No saved run history.
 * Ties use score descending, time ascending, hull descending, then source order
 * (fixed samples precede the local row for an otherwise exact tie).
 */
export function insertDemoRun(score = {}) {
  score = score && typeof score === 'object' ? score : {};
  const local = {
    id: 'local-run', name: 'You', score: whole(score.total, Number.MAX_SAFE_INTEGER),
    time: elapsed(score.time), health: whole(score.health, SCORING_RULES.maxHealth),
    status: Object.hasOwn(statusLabels, score.status) ? score.status : 'playing',
    isSample: false, isPlayer: true, label: 'Your run · local mock', provisional: true,
  };
  return [...DEMO_LEADERBOARD, local]
    .map((row, sourceOrder) => ({ row, sourceOrder }))
    .sort((a, b) => b.row.score - a.row.score || a.row.time - b.row.time || b.row.health - a.row.health || a.sourceOrder - b.sourceOrder)
    .map(({ row }, index) => ({ ...row, demoPosition: index + 1 }));
}
