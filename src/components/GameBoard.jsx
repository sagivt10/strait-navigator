import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { getSonarReading } from '../game/engine';
import Ship from './Ship';
import SonarPing from './SonarPing';
import Explosion from './Explosion';
import PortIcon from './PortIcon';
import WakeTrail from './WakeTrail';
import DroneIntercept from './DroneIntercept';
import DroneStrike from './DroneStrike';
import DroneIcon from './DroneIcon';
import Confetti from './Confetti';
import FloatingScore from './FloatingScore';

// Heat-map colors by mine proximity
function sonarTileColor(count) {
  if (count === 0) return '#1a6b5a';
  if (count === 1) return '#8bc34a';
  if (count === 2) return '#ff9800';
  return '#f44336'; // 3+
}

export default function GameBoard({
  level,
  shipPos,
  shipAngle,
  mines,
  activeDrones,
  visitedTiles,
  sonarPing,
  revealedMines,
  gameState,
  deathCause,
  killerDronePos,
  GAME_STATE,
  move,
  wakeTrail,
  lastInterceptEvent,
  scoreEvents,
}) {
  const { cols, rows, landTiles, shallowTiles, endPos } = level;
  const containerRef = useRef(null);
  const [tileSize, setTileSize] = useState(40);

  const computeTileSize = useCallback(() => {
    const availW = window.innerWidth - 16;
    const availH = window.innerHeight - 60 - 130 - 16;
    const maxByWidth = Math.floor(availW / cols);
    const maxByHeight = Math.floor(availH / rows);
    const size = Math.max(16, Math.min(maxByWidth, maxByHeight, 48));
    setTileSize(size);
  }, [cols, rows]);

  useEffect(() => {
    computeTileSize();
    window.addEventListener('resize', computeTileSize);
    return () => window.removeEventListener('resize', computeTileSize);
  }, [computeTileSize]);

  const gridWidth = cols * tileSize;
  const gridHeight = rows * tileSize;

  // Pre-compute sonar readings for all visited tiles
  const tileReadings = useMemo(() => {
    const readings = {};
    for (const key of visitedTiles) {
      const [c, r] = key.split(',').map(Number);
      readings[key] = getSonarReading(c, r, mines);
    }
    return readings;
  }, [visitedTiles, mines]);

  const dronePositions = useMemo(() => {
    const droneList = activeDrones || [];
    return new Set(droneList.map((d) => `${d.col},${d.row}`));
  }, [activeDrones]);

  const mineIconSize = Math.max(14, Math.round(24 * (tileSize / 40)));
  const portIconSize = Math.max(16, Math.round(28 * (tileSize / 40)));
  const droneIconSize = Math.max(12, Math.round(18 * (tileSize / 40)));
  const shipKey = `${shipPos.col},${shipPos.row}`;

  // Render grid tiles
  const tiles = useMemo(() => {
    const result = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const key = `${col},${row}`;
        const isLand = landTiles.has(key);
        const isShallow = shallowTiles.has(key);
        const isVisited = visitedTiles.has(key);
        const isEnd = col === endPos.col && row === endPos.row;
        const reading = tileReadings[key];
        const isShipTile = key === shipKey;

        let bg;
        if (isLand) {
          bg = 'var(--color-land)';
        } else if (isVisited && reading !== undefined) {
          bg = sonarTileColor(reading);
        } else if (isShallow) {
          bg = 'var(--color-ocean-shallow)';
        } else {
          bg = 'var(--color-ocean-deep)';
        }

        result.push(
          <div
            key={key}
            className={isShipTile && isVisited && !isLand ? 'ship-tile-pulse' : ''}
            style={{
              position: 'absolute',
              left: col * tileSize,
              top: row * tileSize,
              width: tileSize,
              height: tileSize,
              backgroundColor: bg,
              borderRight: '1px solid rgba(255,255,255,0.05)',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.3s ease',
            }}
          >
            {/* Revealed mine (only mines the player has hit) */}
            {revealedMines.has(key) && (
              <svg width={mineIconSize} height={mineIconSize} viewBox="0 0 24 24" style={{ position: 'absolute' }}>
                <circle cx="12" cy="12" r="8" fill="#ff0000" stroke="#cc0000" strokeWidth="1.5" />
                <line x1="12" y1="2" x2="12" y2="6" stroke="#cc0000" strokeWidth="2" />
                <line x1="12" y1="18" x2="12" y2="22" stroke="#cc0000" strokeWidth="2" />
                <line x1="2" y1="12" x2="6" y2="12" stroke="#cc0000" strokeWidth="2" />
                <line x1="18" y1="12" x2="22" y2="12" stroke="#cc0000" strokeWidth="2" />
                <line x1="5" y1="5" x2="8" y2="8" stroke="#cc0000" strokeWidth="1.5" />
                <line x1="16" y1="16" x2="19" y2="19" stroke="#cc0000" strokeWidth="1.5" />
                <line x1="5" y1="19" x2="8" y2="16" stroke="#cc0000" strokeWidth="1.5" />
                <line x1="16" y1="8" x2="19" y2="5" stroke="#cc0000" strokeWidth="1.5" />
              </svg>
            )}

            {/* Drone icon on land tile */}
            {dronePositions.has(key) && (
              <DroneIcon size={droneIconSize} />
            )}

            {/* Port/destination icon */}
            {isEnd && <PortIcon size={portIconSize} />}
          </div>
        );
      }
    }
    return result;
  }, [cols, rows, landTiles, shallowTiles, visitedTiles, mines, endPos, tileReadings, revealedMines, tileSize, mineIconSize, portIconSize, droneIconSize, shipKey, dronePositions]);

  return (
    <div
      ref={containerRef}
      className="relative mx-auto select-none"
      style={{ width: gridWidth, height: gridHeight }}
    >
      {tiles}

      {/* Wake trail behind ship */}
      <WakeTrail trail={wakeTrail} tileSize={tileSize} />

      {sonarPing && (
        <SonarPing
          key={sonarPing.key}
          col={sonarPing.col}
          row={sonarPing.row}
          tileSize={tileSize}
        />
      )}

      {gameState !== GAME_STATE.DYING && gameState !== GAME_STATE.DEAD && (
        <Ship
          col={shipPos.col}
          row={shipPos.row}
          angle={shipAngle}
          tileSize={tileSize}
          originFlag={level.originFlag}
        />
      )}

      {/* Explosion animations play during DYING phase */}
      {gameState === GAME_STATE.DYING && deathCause === 'mine' && (
        <Explosion
          col={shipPos.col}
          row={shipPos.row}
          tileSize={tileSize}
          variant="mine"
        />
      )}

      {gameState === GAME_STATE.DYING && deathCause === 'drone' && killerDronePos && (
        <DroneStrike
          dronePos={killerDronePos}
          shipPos={shipPos}
          tileSize={tileSize}
        />
      )}

      {gameState === GAME_STATE.DYING && deathCause === 'drone' && !killerDronePos && (
        <Explosion
          col={shipPos.col}
          row={shipPos.row}
          tileSize={tileSize}
          variant="drone"
        />
      )}

      {/* Drone intercept missile + explosion */}
      {lastInterceptEvent && (
        <DroneIntercept
          key={lastInterceptEvent.key}
          from={lastInterceptEvent.from}
          to={lastInterceptEvent.to}
          tileSize={tileSize}
        />
      )}

      {/* Floating score animations */}
      {scoreEvents && scoreEvents.length > 0 && (
        <FloatingScore events={scoreEvents} tileSize={tileSize} />
      )}

      {/* Win confetti */}
      {gameState === GAME_STATE.WON && (
        <Confetti width={gridWidth} height={gridHeight} />
      )}
    </div>
  );
}
