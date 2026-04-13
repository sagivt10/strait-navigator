// Level 7: Strait of Gibraltar — 12x20, 40 mines
// Wide strait with rocky outcrops creating dangerous bottlenecks

const level7 = {
  id: 7,
  name: 'Strait of Gibraltar',
  subtitle: 'Atlantic Gateway',
  originFlag: '🇪🇸',
  destFlag: '🇲🇦',
  distance: 36,
  difficulty: 3,
  cols: 12,
  rows: 20,
  mineCount: 40,
  startPos: { col: 6, row: 18 },
  endPos: { col: 5, row: 1 },
  // Layout (12x20):
  //     0 1 2 3 4 5 6 7 8 9 A B
  //  0  # # # # # # # # # # # #
  //  1  # # . . . E . . . . # #   <- Spain coast top
  //  2  # . . . . . . . . . . #
  //  3  . . . . . . . . . . . .
  //  4  . . . # # . . # # . . .   <- rocky outcrops
  //  5  . . . # # . . # # . . .
  //  6  . . . . . . . . . . . .
  //  7  . . # . . . . . . # . .   <- narrowing rocks
  //  8  . . # # . . . . # # . .
  //  9  . . . . . . . . . . . .
  // 10  . . . . . # . . . . . .   <- central reef
  // 11  . . . . . # # . . . . .
  // 12  . . . . . . . . . . . .
  // 13  . # # . . . . . . # # .   <- more outcrops
  // 14  . # # . . . . . . # # .
  // 15  . . . . . . . . . . . .
  // 16  # . . . # . . # . . . #   <- final bottleneck
  // 17  # . . . . . . . . . . #
  // 18  # # . . . . S . . . # #   <- Morocco coast
  // 19  # # # # # # # # # # # #
  landTiles: new Set([
    // Top edge
    '0,0','1,0','2,0','3,0','4,0','5,0','6,0','7,0','8,0','9,0','10,0','11,0',
    // Spain coast
    '0,1','1,1', '10,1','11,1',
    '0,2', '11,2',
    // Rocky outcrops (rows 4-5)
    '3,4','4,4', '7,4','8,4',
    '3,5','4,5', '7,5','8,5',
    // Narrowing rocks (rows 7-8)
    '2,7', '9,7',
    '2,8','3,8', '8,8','9,8',
    // Central reef (rows 10-11)
    '5,10', '5,11','6,11',
    // More outcrops (rows 13-14)
    '1,13','2,13', '9,13','10,13',
    '1,14','2,14', '9,14','10,14',
    // Final bottleneck + Morocco coast
    '0,16', '4,16', '7,16', '11,16',
    '0,17', '11,17',
    '0,18','1,18', '10,18','11,18',
    // Bottom edge
    '0,19','1,19','2,19','3,19','4,19','5,19','6,19','7,19','8,19','9,19','10,19','11,19',
  ]),
  shallowTiles: new Set([
    '2,1','3,1','9,1',
    '1,2','10,2',
    '2,4','5,4','6,4','9,4',
    '2,5','5,5','6,5','9,5',
    '1,7','3,7','8,7','10,7',
    '1,8','4,8','7,8','10,8',
    '4,10','6,10',
    '4,11','7,11',
    '0,13','3,13','8,13','11,13',
    '0,14','3,14','8,14','11,14',
    '1,16','3,16','5,16','6,16','8,16','10,16',
    '1,17','10,17',
    '2,18','9,18',
  ]),
  // Drones on coastline land tiles — kill zone radius 2 (levels 6-10)
  drones: [
    { col: 3, row: 4 },  // rocky outcrop — blocks upper left
    { col: 9, row: 7 },  // right narrowing rocks
    { col: 5, row: 10 }, // central reef — threatens mid-strait
    { col: 1, row: 13 }, // side outcrop — guards lower left
  ],
};

export default level7;
