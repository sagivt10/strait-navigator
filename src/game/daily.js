import level1 from '../levels/level1';

/**
 * Get today's date string in UTC: 'YYYY-MM-DD'
 */
export function getDailyDateString() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

/**
 * Format a date string as a human-readable date: 'April 13'
 */
export function formatDailyDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
}

/**
 * Hash a date string to a deterministic seed number.
 */
function hashDateToSeed(dateStr) {
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = ((hash << 5) - hash + dateStr.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Get daily mine count: 12-20 based on day of week.
 * Mon=12, Tue=13, Wed=14, Thu=15, Fri=16, Sat=18, Sun=20
 */
function getDailyMineCount(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const day = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun, 6=Sat
  const counts = [20, 12, 13, 14, 15, 16, 18]; // Sun, Mon, Tue, Wed, Thu, Fri, Sat
  return counts[day];
}

/**
 * Build the daily challenge level object.
 * Uses Level 1 geography with a daily-varied seed and mine count.
 */
export function getDailyLevel(dateStr) {
  const date = dateStr || getDailyDateString();
  const seed = hashDateToSeed(date);
  const mineCount = getDailyMineCount(date);

  return {
    ...level1,
    id: seed,  // Use the hash as the level ID for seeded mine placement
    name: 'Daily Challenge',
    subtitle: formatDailyDate(date),
    originFlag: '🗓️',
    destFlag: '🇴🇲',
    mineCount,
    isDaily: true,
    dailyDate: date,
  };
}

// --- localStorage tracking for one-submission-per-day ---

const DAILY_SUBMITTED_KEY = 'strait-navigator-daily-submitted';

export function hasDailySubmitted(dateStr) {
  const date = dateStr || getDailyDateString();
  return localStorage.getItem(DAILY_SUBMITTED_KEY) === date;
}

export function markDailySubmitted(dateStr) {
  const date = dateStr || getDailyDateString();
  localStorage.setItem(DAILY_SUBMITTED_KEY, date);
}

/**
 * Build the sonar emoji grid from visited tile readings.
 * Maps sonar count -> emoji: 0=🟩, 1=🟧, 2+=🟥
 */
export function buildRouteEmojiGrid(visitedTiles, mines) {
  const emojis = [];
  for (const key of visitedTiles) {
    const [c, r] = key.split(',').map(Number);
    let count = 0;
    for (const mk of mines) {
      const [mc, mr] = mk.split(',').map(Number);
      const dist = Math.abs(mc - c) + Math.abs(mr - r);
      if (dist <= 2 && dist > 0) count++;
    }
    if (count === 0) emojis.push('🟩');
    else if (count <= 1) emojis.push('🟧');
    else emojis.push('🟥');
  }
  return emojis.join('');
}
