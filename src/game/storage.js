// localStorage helpers for progress tracking

const STORAGE_KEY = 'strait-navigator-progress';

function getProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveProgress(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Get best time (ms) for a level, or null if never completed.
 */
export function getBestTime(levelId) {
  const progress = getProgress();
  return progress[`level_${levelId}`]?.bestTime ?? null;
}

/**
 * Record a level completion. Saves best score and best time.
 * Returns true if it's a new best score.
 */
export function recordCompletion(levelId, timeMs, score) {
  const progress = getProgress();
  const key = `level_${levelId}`;
  const existing = progress[key];

  const isNewBest = !existing || score > (existing.bestScore ?? 0);
  if (isNewBest) {
    progress[key] = {
      bestTime: existing ? Math.min(timeMs, existing.bestTime) : timeMs,
      bestScore: score,
      completedAt: Date.now(),
    };
    saveProgress(progress);
  } else if (timeMs < existing.bestTime) {
    // Not a new best score, but a faster time — still save the time
    progress[key] = { ...existing, bestTime: timeMs };
    saveProgress(progress);
  }
  return isNewBest;
}

/**
 * Check if a level is unlocked.
 * Level 1 is always unlocked. Others require the previous level to be completed.
 */
export function isLevelUnlocked(levelId) {
  if (levelId === 1) return true;
  return getBestTime(levelId - 1) !== null;
}

/**
 * Get all best times as a map { levelId: timeMs }.
 */
export function getAllBestTimes() {
  const progress = getProgress();
  const times = {};
  for (const [key, val] of Object.entries(progress)) {
    const id = parseInt(key.replace('level_', ''), 10);
    if (!isNaN(id) && val.bestTime) {
      times[id] = val.bestTime;
    }
  }
  return times;
}
