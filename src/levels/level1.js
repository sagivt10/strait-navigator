// Level 1: Strait of Hormuz (Iran-Oman) — 10x16, 12 mines, Tutorial
// Redesigned: wider corridors with small islands creating route choices

const level1 = {
  id: 1,
  name: 'Strait of Hormuz',
  subtitle: 'Iran — Oman',
  originFlag: '🇮🇷',
  destFlag: '🇴🇲',
  distance: 90,
  difficulty: 1,
  cols: 10,
  rows: 16,
  mineCount: 12,
  startPos: { col: 5, row: 14 },
  endPos: { col: 6, row: 1 },
  // Layout (# = land, . = water):
  //    0 1 2 3 4 5 6 7 8 9
  //  0 # # # # # # # # # #   <- Iran coast (full land)
  //  1 # # # . . . E . . .   <- narrow opening, endPos
  //  2 # # . . . . . . . .
  //  3 # . . . . # . . . .   <- small island forces route choice
  //  4 . . . . . # . . . #
  //  5 . . . . . . . . . #   <- Oman coast starts
  //  6 . . . # . . . . # #
  //  7 . . . # . . . . # #   <- mid-strait island
  //  8 . . . . . . . # # #
  //  9 . . . . . . . # # #
  // 10 . . . . . . # # # #
  // 11 # . . . . . # # # #
  // 12 # . . . . . . # # #
  // 13 # # . . . . . # # #
  // 14 # # . . . S . . # #
  // 15 # # # # # # # # # #   <- full land bottom
  landTiles: new Set([
    // Iran coast (top)
    '0,0', '1,0', '2,0', '3,0', '4,0', '5,0', '6,0', '7,0', '8,0', '9,0',
    '0,1', '1,1', '2,1',
    '0,2', '1,2',
    '0,3',
    // Small island row 3-4 (forces left or right route)
    '5,3', '5,4',
    // Oman coast upper (right side)
    '9,4', '9,5',
    // Mid-strait island (forces weaving)
    '3,6', '3,7',
    '8,6', '9,6',
    '8,7', '9,7',
    // Oman coast (right side continues)
    '7,8', '8,8', '9,8',
    '7,9', '8,9', '9,9',
    '6,10', '7,10', '8,10', '9,10',
    '6,11', '7,11', '8,11', '9,11',
    '7,12', '8,12', '9,12',
    '7,13', '8,13', '9,13',
    '8,14', '9,14',
    // Oman peninsula (left side)
    '0,11', '0,12', '0,13', '0,14',
    '1,13', '1,14',
    // Bottom edge
    '0,15', '1,15', '2,15', '3,15', '4,15', '5,15', '6,15', '7,15', '8,15', '9,15',
  ]),
  shallowTiles: new Set([
    '3,1', '4,1', '5,1',
    '2,2', '3,2',
    '1,3', '1,4',
    '4,3', '6,3', '4,4', '6,4',
    '2,6', '4,6', '7,6',
    '2,7', '4,7', '7,7',
    '6,8', '6,9',
    '5,10', '5,11',
    '1,11', '1,12',
    '6,12', '6,13',
    '2,13', '2,14', '7,14',
  ]),
  landPolygons: [],
};

export default level1;
