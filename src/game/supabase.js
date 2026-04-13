import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- Nickname (localStorage) ---

const NICKNAME_KEY = 'strait-navigator-nickname';

export function getNickname() {
  return localStorage.getItem(NICKNAME_KEY) || null;
}

export function setNickname(name) {
  localStorage.setItem(NICKNAME_KEY, name.trim().slice(0, 20));
}

// --- Leaderboard API ---

/**
 * Submit a score. Includes score and deaths alongside time_ms.
 * Returns the inserted row or null on error.
 */
export async function submitScore(levelId, timeMs, playerName, score, deaths) {
  const fullPayload = {
    player_name: playerName,
    level_id: levelId,
    time_ms: timeMs,
    score: score,
    deaths: deaths,
  };
  console.log('[Supabase] submitScore called with:', fullPayload);

  // Try with all columns first (score + deaths)
  const { data, error } = await supabase
    .from('scores')
    .insert(fullPayload)
    .select()
    .single();

  if (!error) {
    console.log('[Supabase] Submit success:', data);
    return data;
  }

  // If columns don't exist yet, fall back to base columns
  if (error.message && error.message.includes('column')) {
    console.warn('[Supabase] Falling back to base columns (score/deaths columns not in DB yet):', error.message);
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('scores')
      .insert({
        player_name: playerName,
        level_id: levelId,
        time_ms: timeMs,
      })
      .select()
      .single();

    if (fallbackError) {
      console.error('[Supabase] Fallback submit error:', fallbackError.message, fallbackError);
      return null;
    }
    console.log('[Supabase] Fallback submit success:', fallbackData);
    return fallbackData;
  }

  console.error('[Supabase] Submit error:', error.message, error);
  return null;
}

/**
 * Fetch top 10 scores for a given level.
 * Tries to sort by score desc; falls back to time_ms asc if score column doesn't exist.
 */
export async function getLeaderboard(levelId) {
  // Try with score column first
  const { data, error } = await supabase
    .from('scores')
    .select('id, player_name, level_id, time_ms, score, deaths, created_at')
    .eq('level_id', levelId)
    .order('score', { ascending: false })
    .limit(10);

  if (!error) return data || [];

  // Fall back to time-based sorting if score column doesn't exist
  console.warn('[Leaderboard] Falling back to time-based sort:', error.message);
  const { data: fallbackData, error: fallbackError } = await supabase
    .from('scores')
    .select('id, player_name, level_id, time_ms, created_at')
    .eq('level_id', levelId)
    .order('time_ms', { ascending: true })
    .limit(10);

  if (fallbackError) {
    console.error('[Leaderboard] Fetch error:', fallbackError.message);
    return [];
  }
  return fallbackData || [];
}

/**
 * Get the rank of a specific score on a level (1-indexed).
 * Tries score-based ranking; falls back to time-based if score column doesn't exist.
 */
export async function getRank(levelId, score, timeMs) {
  // Try score-based ranking first
  const { count, error } = await supabase
    .from('scores')
    .select('id', { count: 'exact', head: true })
    .eq('level_id', levelId)
    .gt('score', score);

  if (!error) return (count ?? 0) + 1;

  // Fall back to time-based ranking
  if (timeMs != null) {
    console.warn('[Leaderboard] Falling back to time-based rank:', error.message);
    const { count: timeCount, error: timeError } = await supabase
      .from('scores')
      .select('id', { count: 'exact', head: true })
      .eq('level_id', levelId)
      .lt('time_ms', timeMs);

    if (timeError) {
      console.error('[Leaderboard] Rank error:', timeError.message);
      return null;
    }
    return (timeCount ?? 0) + 1;
  }

  console.error('[Leaderboard] Rank error:', error.message);
  return null;
}

// --- Daily Challenge API ---

/**
 * Submit a daily challenge score to the daily_scores table.
 * The table requires level_id (NOT NULL), so we use 9999 as the daily sentinel.
 */
export async function submitDailyScore(challengeDate, timeMs, playerName, score, deaths) {
  const payload = {
    player_name: playerName,
    challenge_date: challengeDate,
    level_id: 9999,
    time_ms: timeMs,
    score: score,
    deaths: deaths,
  };

  console.log('[Daily] submitDailyScore called with:', payload);

  const { data, error } = await supabase
    .from('daily_scores')
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error('[Daily] Submit FAILED:', error.code, error.message, error.details);
    return null;
  }

  console.log('[Daily] Submit success:', data);
  return data;
}

/**
 * Verify a daily submission actually exists in Supabase.
 * Returns true if a row exists for this player+date, false otherwise.
 * Used to clear stale localStorage flags from past failed submissions.
 */
export async function verifyDailySubmission(challengeDate, playerName) {
  const { count, error } = await supabase
    .from('daily_scores')
    .select('id', { count: 'exact', head: true })
    .eq('challenge_date', challengeDate)
    .eq('player_name', playerName);

  if (error) {
    console.warn('[Daily] verifyDailySubmission error:', error.message);
    return false;
  }
  return (count ?? 0) > 0;
}

/**
 * Fetch today's daily leaderboard (top 10).
 */
export async function getDailyLeaderboard(challengeDate) {
  // Try daily_scores table
  const { data, error } = await supabase
    .from('daily_scores')
    .select('id, player_name, score, time_ms, deaths, created_at')
    .eq('challenge_date', challengeDate)
    .order('score', { ascending: false })
    .limit(10);

  if (!error) return data || [];

  // Fall back to regular scores with special level_id
  console.warn('[Daily] Falling back to scores table for daily leaderboard');
  const { data: fbData, error: fbError } = await supabase
    .from('scores')
    .select('id, player_name, time_ms, created_at')
    .eq('level_id', 9999)
    .order('time_ms', { ascending: true })
    .limit(10);

  if (fbError) {
    console.error('[Daily] Leaderboard fetch error:', fbError.message);
    return [];
  }
  return fbData || [];
}
