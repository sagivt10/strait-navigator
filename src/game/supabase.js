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
 * Submit a score. Returns the inserted row or null on error.
 */
export async function submitScore(levelId, timeMs, playerName) {
  const { data, error } = await supabase
    .from('scores')
    .insert({
      player_name: playerName,
      level_id: levelId,
      time_ms: timeMs,
    })
    .select()
    .single();

  if (error) {
    console.error('[Leaderboard] Submit error:', error.message);
    return null;
  }
  return data;
}

/**
 * Fetch top 10 scores for a given level.
 */
export async function getLeaderboard(levelId) {
  const { data, error } = await supabase
    .from('scores')
    .select('id, player_name, level_id, time_ms, created_at')
    .eq('level_id', levelId)
    .order('time_ms', { ascending: true })
    .limit(10);

  if (error) {
    console.error('[Leaderboard] Fetch error:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Get the rank of a specific time on a level (1-indexed).
 */
export async function getRank(levelId, timeMs) {
  const { count, error } = await supabase
    .from('scores')
    .select('id', { count: 'exact', head: true })
    .eq('level_id', levelId)
    .lt('time_ms', timeMs);

  if (error) {
    console.error('[Leaderboard] Rank error:', error.message);
    return null;
  }
  return (count ?? 0) + 1;
}
