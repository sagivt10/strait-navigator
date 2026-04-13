// Level 2: Strait of Hormuz — Wide Route — 12x16, 16 mines
// Wider map with multiple islands creating 3 distinct route corridors

const level2 = {
  id: 2,
  name: 'Strait of Hormuz — Wide Route',
  subtitle: 'US Navy — Persian Gulf Operations',
  originFlag: '🇺🇸',
  destFlag: '🇦🇪',
  distance: 120,
  difficulty: 1,
  cols: 12,
  rows: 16,
  mineCount: 16,
  startPos: { col: 6, row: 14 },
  endPos: { col: 6, row: 1 },
  // Layout:
  //    0 1 2 3 4 5 6 7 8 9 A B
  //  0 # # # # # # # # # # # #
  //  1 # # . . . . E . . . . #
  //  2 # . . . . . . . . . . #
  //  3 . . . . # # . . . . . .
  //  4 . . . . # # . . . . . .
  //  5 . . . . . . . . . . . .
  //  6 . . # . . . . . # . . .
  //  7 . . # . . . . . # . . .
  //  8 . . . . . # # . . . . .
  //  9 . . . . . # # . . . . .
  // 10 . . . . . . . . . . . .
  // 11 . . . . . . . . . # . .
  // 12 # . . . . . . . . # . #
  // 13 # # . . . . . . . . # #
  // 14 # # . . . . S . . . # #
  // 15 # # # # # # # # # # # #
  landTiles: new Set([
    // Top edge
    '0,0','1,0','2,0','3,0','4,0','5,0','6,0','7,0','8,0','9,0','10,0','11,0',
    // Iran coast top-left
    '0,1','1,1', '11,1',
    '0,2', '11,2',
    // Island A (rows 3-4) — splits upper channel
    '4,3','5,3', '4,4','5,4',
    // Island B (rows 6-7) — left side
    '2,6','2,7',
    // Island C (rows 6-7) — right side
    '8,6','8,7',
    // Island D (rows 8-9) — center
    '5,8','6,8', '5,9','6,9',
    // Oman coast (right side)
    '9,11', '9,12','11,12',
    '10,13','11,13',
    '10,14','11,14',
    // UAE coast (left side)
    '0,12','0,13','0,14',
    '1,13','1,14',
    // Bottom edge
    '0,15','1,15','2,15','3,15','4,15','5,15','6,15','7,15','8,15','9,15','10,15','11,15',
  ]),
  shallowTiles: new Set([
    '2,1','3,1','10,1',
    '1,2','10,2',
    '3,3','6,3','3,4','6,4',
    '1,6','3,6','7,6','9,6',
    '1,7','3,7','7,7','9,7',
    '4,8','7,8','4,9','7,9',
    '8,11','10,11',
    '1,12','8,12','10,12',
    '2,13','9,13',
    '2,14','9,14',
  ]),
  // Drones on coastline land tiles — kill zone radius 1 (levels 1-5)
  drones: [
    { col: 4, row: 3 },  // island A — blocks upper channel
    { col: 8, row: 6 },  // island C — threatens right passage
    { col: 9, row: 11 }, // Oman coast — guards lower approach
  ],
};

export default level2;
