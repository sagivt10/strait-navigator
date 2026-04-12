// Level 5: Strait of Tiran (Red Sea entry) — 10x18, 22 mines
// Very narrow with Tiran and Sanafir islands creating 3 parallel channels

const level5 = {
  id: 5,
  name: 'Strait of Tiran',
  subtitle: 'Red Sea Entry',
  originFlag: '🇪🇬',
  destFlag: '🇸🇦',
  distance: 13,
  difficulty: 2,
  cols: 10,
  rows: 18,
  mineCount: 22,
  startPos: { col: 5, row: 16 },
  endPos: { col: 5, row: 1 },
  // Layout (10x18):
  //    0 1 2 3 4 5 6 7 8 9
  //  0 # # # # # # # # # #
  //  1 # . . . . E . . # #  <- Saudi coast right
  //  2 # . . . . . . . . #
  //  3 . . . . . . . . . #
  //  4 . . . . . . . . . .
  //  5 . . . # # . . . . .  <- Sanafir Island
  //  6 . . . # # . . . . .
  //  7 . . . . . . . . . .
  //  8 . . . . . . # # . .  <- Tiran Island
  //  9 . . . . . . # # . .
  // 10 . . . . . . . . . .
  // 11 # . . . . . . . . .
  // 12 # . . . # . . . . .  <- small reef
  // 13 # # . . . . . . . #
  // 14 # # . . . . . . # #  <- Sinai narrows
  // 15 # # . . . . . . # #
  // 16 # # # . . S . # # #
  // 17 # # # # # # # # # #
  landTiles: new Set([
    // Top edge
    '0,0','1,0','2,0','3,0','4,0','5,0','6,0','7,0','8,0','9,0',
    // Saudi coast (top-right)
    '0,1', '8,1','9,1',
    '0,2', '9,2',
    '9,3',
    // Sanafir Island (rows 5-6)
    '3,5','4,5', '3,6','4,6',
    // Tiran Island (rows 8-9)
    '6,8','7,8', '6,9','7,9',
    // Sinai coast (left)
    '0,11',
    '0,12',
    '0,13','1,13',
    '0,14','1,14',
    '0,15','1,15',
    '0,16','1,16','2,16',
    // Small reef
    '4,12',
    // Right coast lower
    '9,13',
    '8,14','9,14',
    '8,15','9,15',
    '7,16','8,16','9,16',
    // Bottom edge
    '0,17','1,17','2,17','3,17','4,17','5,17','6,17','7,17','8,17','9,17',
  ]),
  shallowTiles: new Set([
    '1,1','2,1','7,1',
    '1,2','8,2',
    '0,3','8,3',
    '2,5','5,5','2,6','5,6',
    '5,8','8,8','5,9','8,9',
    '1,11','3,12','5,12',
    '1,12',
    '2,13','8,13',
    '2,14','7,14',
    '2,15','7,15',
    '3,16','6,16',
  ]),
};

export default level5;
