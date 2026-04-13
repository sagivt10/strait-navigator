// Core game engine logic

/**
 * Simple seeded PRNG (mulberry32). Given a 32-bit seed, produces
 * deterministic pseudo-random numbers in [0, 1).
 */
function seededRng(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Compute score: higher is better.
 * score = max(0, 10000 - (elapsedMs / 100) - (deaths * 500))
 */
export function computeScore(elapsedMs, deaths) {
  return Math.max(0, Math.round(10000 - (elapsedMs / 100) - (deaths * 500)));
}

/**
 * Compute the set of water tiles that fall within each drone's kill zone.
 * Kill radius is 1 for levels 1-5, 2 for levels 6-10.
 * Optional droneList overrides level.drones (for intercept system).
 */
export function computeDroneKillZones(level, droneList) {
  const drones = droneList || level.drones;
  const { landTiles, cols, rows, id } = level;
  if (!drones || drones.length === 0) return new Set();

  const radius = id <= 5 ? 1 : 2;
  const killZones = new Set();

  for (const drone of drones) {
    for (let dc = -radius; dc <= radius; dc++) {
      for (let dr = -radius; dr <= radius; dr++) {
        if (Math.abs(dc) + Math.abs(dr) > radius) continue;
        if (dc === 0 && dr === 0) continue;
        const c = drone.col + dc;
        const r = drone.row + dr;
        if (c < 0 || c >= cols || r < 0 || r >= rows) continue;
        const key = `${c},${r}`;
        if (!landTiles.has(key)) {
          killZones.add(key);
        }
      }
    }
  }

  return killZones;
}

/**
 * BFS from startPos to endPos through water tiles that are not mines, land,
 * or drone kill zones. Returns true if a valid path exists.
 */
function hasValidPath(cols, rows, landTiles, mines, startPos, endPos, blocked = new Set()) {
  const startKey = `${startPos.col},${startPos.row}`;
  const endKey = `${endPos.col},${endPos.row}`;
  const visited = new Set([startKey]);
  const queue = [startKey];
  const deltas = [[0, -1], [0, 1], [-1, 0], [1, 0]];

  while (queue.length > 0) {
    const key = queue.shift();
    if (key === endKey) return true;

    const [c, r] = key.split(',').map(Number);
    for (const [dc, dr] of deltas) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const nk = `${nc},${nr}`;
      if (visited.has(nk) || landTiles.has(nk) || mines.has(nk) || blocked.has(nk)) continue;
      visited.add(nk);
      queue.push(nk);
    }
  }
  return false;
}

/**
 * Place mines deterministically using the level ID as the seed.
 * Avoids land tiles, start/end positions, and a 3-tile safe zone
 * (Manhattan distance) around the start. After placement, runs BFS
 * to verify a path from start to end exists. If not, retries with
 * a different seed offset until a solvable layout is found.
 */
export function placeMines(level, droneKillZones = new Set()) {
  const { id, cols, rows, mineCount, startPos, endPos, landTiles } = level;

  const isInSafeZone = (col, row) => {
    const dist = Math.abs(col - startPos.col) + Math.abs(row - startPos.row);
    return dist <= 3;
  };
  const isEndTile = (col, row) => col === endPos.col && row === endPos.row;
  const isLand = (col, row) => landTiles.has(`${col},${row}`);

  // Define the chokepoint zone: middle 60% of rows (where straits are narrowest)
  const chokeStart = Math.floor(rows * 0.2);
  const chokeEnd = Math.floor(rows * 0.8);
  // Extra mines to place in the chokepoint zone (30% of total)
  const chokeMines = Math.floor(mineCount * 0.3);
  const baseMines = mineCount - chokeMines;

  for (let seedOffset = 0; seedOffset < 1000; seedOffset++) {
    const mines = new Set();
    const rng = seededRng(id * 31337 + seedOffset);

    // Phase 1: place base mines across the full map
    let attempts = 0;
    while (mines.size < baseMines && attempts < 10000) {
      const col = Math.floor(rng() * cols);
      const row = Math.floor(rng() * rows);
      const key = `${col},${row}`;

      if (
        !mines.has(key) &&
        !isInSafeZone(col, row) &&
        !isEndTile(col, row) &&
        !isLand(col, row) &&
        !droneKillZones.has(key)
      ) {
        mines.add(key);
      }
      attempts++;
    }

    // Phase 2: densify chokepoint zone with extra mines in middle rows
    attempts = 0;
    while (mines.size < mineCount && attempts < 10000) {
      const col = Math.floor(rng() * cols);
      const row = chokeStart + Math.floor(rng() * (chokeEnd - chokeStart));
      const key = `${col},${row}`;

      if (
        !mines.has(key) &&
        !isInSafeZone(col, row) &&
        !isEndTile(col, row) &&
        !isLand(col, row) &&
        !droneKillZones.has(key)
      ) {
        mines.add(key);
      }
      attempts++;
    }

    if (hasValidPath(cols, rows, landTiles, mines, startPos, endPos, droneKillZones)) {
      return mines;
    }
  }

  // Fallback: return empty mines (should never happen)
  return new Set();
}

/**
 * Calculate sonar reading: count mines within 2-tile Manhattan distance.
 */
export function getSonarReading(col, row, mines) {
  let count = 0;
  for (const key of mines) {
    const [mc, mr] = key.split(',').map(Number);
    const dist = Math.abs(mc - col) + Math.abs(mr - row);
    if (dist <= 2 && dist > 0) {
      count++;
    }
  }
  return count;
}

/**
 * Get sonar color class based on mine count.
 */
export function getSonarColor(count) {
  if (count === 0) return '#00cc88'; // safe green
  if (count <= 2) return '#f0a500'; // yellow/gold
  if (count <= 4) return '#ff6b35'; // orange
  return '#ff0000'; // red
}

/**
 * Check if a move is valid (within bounds and not on land).
 */
export function isValidMove(col, row, level) {
  const { cols, rows, landTiles } = level;
  if (col < 0 || col >= cols || row < 0 || row >= rows) return false;
  if (landTiles.has(`${col},${row}`)) return false;
  return true;
}

/**
 * Direction vectors for movement (no diagonals).
 */
export const DIRECTIONS = {
  up: { col: 0, row: -1, angle: 0 },
  down: { col: 0, row: 1, angle: 180 },
  left: { col: -1, row: 0, angle: 270 },
  right: { col: 1, row: 0, angle: 90 },
};

/**
 * Map keyboard keys to directions.
 */
export function keyToDirection(key) {
  switch (key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      return 'up';
    case 'ArrowDown':
    case 's':
    case 'S':
      return 'down';
    case 'ArrowLeft':
    case 'a':
    case 'A':
      return 'left';
    case 'ArrowRight':
    case 'd':
    case 'D':
      return 'right';
    default:
      return null;
  }
}

/**
 * Format milliseconds as MM:SS.m
 */
export function formatTime(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const tenths = Math.floor((ms % 1000) / 100);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${tenths}`;
}
