import level1 from './level1';
import level2 from './level2';
import level3 from './level3';
import level4 from './level4';
import level5 from './level5';
import level6 from './level6';
import level7 from './level7';
import level8 from './level8';
import level9 from './level9';
import level10 from './level10';

// Playable levels (1-10 have full tile data)
export const playableLevels = [level1, level2, level3, level4, level5, level6, level7, level8, level9, level10];

// Metadata for all 20 levels (used in level select — levels 11-20 are locked/coming soon)
export const allLevelsMeta = [
  { id: 1, name: 'Strait of Hormuz', subtitle: 'US Navy — Persian Gulf Operations', originFlag: '🇺🇸', destFlag: '🇴🇲', distance: 90, difficulty: 1, cols: 10, rows: 16, mineCount: 12 },
  { id: 2, name: 'Strait of Hormuz — Wide Route', subtitle: 'US Navy — Persian Gulf Operations', originFlag: '🇺🇸', destFlag: '🇦🇪', distance: 120, difficulty: 1, cols: 12, rows: 16, mineCount: 16 },
  { id: 3, name: 'Gulf of Oman', subtitle: 'Open Water', originFlag: '🇴🇲', destFlag: '🇮🇷', distance: 340, difficulty: 2, cols: 14, rows: 16, mineCount: 18 },
  { id: 4, name: 'Bab el-Mandeb', subtitle: 'Yemen — Djibouti', originFlag: '🇩🇯', destFlag: '🇾🇪', distance: 20, difficulty: 2, cols: 12, rows: 18, mineCount: 20 },
  { id: 5, name: 'Strait of Tiran', subtitle: 'Red Sea Entry', originFlag: '🇪🇬', destFlag: '🇸🇦', distance: 13, difficulty: 2, cols: 10, rows: 18, mineCount: 22 },
  { id: 6, name: 'Suez Canal', subtitle: 'North Entry', originFlag: '🇪🇬', destFlag: '🇪🇬', distance: 50, difficulty: 3, cols: 10, rows: 22, mineCount: 35 },
  { id: 7, name: 'Strait of Gibraltar', subtitle: 'Atlantic Gateway', originFlag: '🇪🇸', destFlag: '🇲🇦', distance: 36, difficulty: 3, cols: 12, rows: 20, mineCount: 40 },
  { id: 8, name: 'Strait of Malacca', subtitle: 'Southeast Asia', originFlag: '🇲🇾', destFlag: '🇮🇩', distance: 550, difficulty: 4, cols: 10, rows: 24, mineCount: 45 },
  { id: 9, name: 'Taiwan Strait', subtitle: 'Narrow Passage', originFlag: '🇨🇳', destFlag: '🇹🇼', distance: 130, difficulty: 4, cols: 12, rows: 26, mineCount: 50 },
  { id: 10, name: 'South China Sea', subtitle: 'Island Clusters', originFlag: '🇻🇳', destFlag: '🇵🇭', distance: 900, difficulty: 5, cols: 20, rows: 20, mineCount: 55 },
  { id: 11, name: 'English Channel', subtitle: 'Busiest Strait', originFlag: '🇫🇷', destFlag: '🇬🇧', distance: 350, difficulty: 4, cols: 10, rows: 22, mineCount: 38 },
  { id: 12, name: 'North Sea', subtitle: 'Dense Waters', originFlag: '🇬🇧', destFlag: '🇳🇴', distance: 750, difficulty: 4, cols: 20, rows: 20, mineCount: 40 },
  { id: 13, name: 'Korean Strait', subtitle: 'Divided Routes', originFlag: '🇰🇷', destFlag: '🇯🇵', distance: 120, difficulty: 5, cols: 14, rows: 24, mineCount: 48 },
  { id: 14, name: 'Bering Strait', subtitle: 'Alaska — Russia', originFlag: '🇺🇸', destFlag: '🇷🇺', distance: 55, difficulty: 5, cols: 12, rows: 26, mineCount: 50 },
  { id: 15, name: 'Drake Passage', subtitle: 'Cape Horn', originFlag: '🇦🇷', destFlag: '🇦🇶', distance: 500, difficulty: 5, cols: 24, rows: 24, mineCount: 55 },
  { id: 16, name: 'Bay of Biscay', subtitle: 'Storm Waters', originFlag: '🇫🇷', destFlag: '🇪🇸', distance: 400, difficulty: 5, cols: 20, rows: 18, mineCount: 58 },
  { id: 17, name: 'Mediterranean Sea', subtitle: 'East to West', originFlag: '🇬🇷', destFlag: '🇪🇸', distance: 2200, difficulty: 5, cols: 18, rows: 16, mineCount: 60 },
  { id: 18, name: 'Arctic Route', subtitle: 'Northwest Passage', originFlag: '🇨🇦', destFlag: '🇬🇱', distance: 900, difficulty: 5, cols: 22, rows: 28, mineCount: 60 },
  { id: 19, name: 'Suez to Rotterdam', subtitle: 'Long Haul', originFlag: '🇪🇬', destFlag: '🇳🇱', distance: 5500, difficulty: 6, cols: 26, rows: 30, mineCount: 65 },
  { id: 20, name: 'Hormuz to Rotterdam', subtitle: 'Full Voyage', originFlag: '🇮🇷', destFlag: '🇳🇱', distance: 6500, difficulty: 6, cols: 28, rows: 32, mineCount: 70 },
];

/**
 * Get the playable level data by id. Returns null if not yet implemented.
 */
export function getLevelById(id) {
  return playableLevels.find((l) => l.id === id) || null;
}
