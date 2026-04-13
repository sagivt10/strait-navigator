import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  placeMines,
  getSonarReading,
  isValidMove,
  DIRECTIONS,
  keyToDirection,
  computeDroneKillZones,
} from './engine';

const GAME_STATE = {
  READY: 'ready',
  PLAYING: 'playing',
  DYING: 'dying',  // explosion playing, controls locked, no overlay yet
  DEAD: 'dead',    // overlay visible, restart allowed
  WON: 'won',
};

export function useGame(level) {
  // Full kill zones for mine placement (never changes — ensures solvability)
  const [mines] = useState(() => placeMines(level, computeDroneKillZones(level)));

  // Active drones (can be destroyed via intercept)
  const [activeDrones, setActiveDrones] = useState(() => [...(level.drones || [])]);
  const [interceptsLeft, setInterceptsLeft] = useState(1);
  const [interceptMessage, setInterceptMessage] = useState(null);
  const [lastInterceptEvent, setLastInterceptEvent] = useState(null);
  const [wakeTrail, setWakeTrail] = useState([]);
  const [scoreEvents, setScoreEvents] = useState([]);
  const [interceptBonuses, setInterceptBonuses] = useState(0);

  // Active kill zones — recomputed when drones are destroyed
  const droneKillZones = useMemo(
    () => computeDroneKillZones(level, activeDrones),
    [level, activeDrones]
  );

  const [shipPos, setShipPos] = useState(level.startPos);
  const [shipAngle, setShipAngle] = useState(0);
  const [visitedTiles, setVisitedTiles] = useState(() => new Set([`${level.startPos.col},${level.startPos.row}`]));
  const [gameState, setGameState] = useState(GAME_STATE.READY);
  const [deathCause, setDeathCause] = useState(null); // 'mine' | 'drone'
  const [killerDronePos, setKillerDronePos] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [attempts, setAttempts] = useState(1);
  const [sonarPing, setSonarPing] = useState(null);
  const [revealedMines, setRevealedMines] = useState(new Set()); // accumulates across retries
  const [isFirstMove, setIsFirstMove] = useState(true);

  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const isMovingRef = useRef(false);
  const gameStateRef = useRef(gameState);
  const interceptMsgTimerRef = useRef(null);
  const finalTimeRef = useRef(null); // captures total time at win for score computation
  const accumulatedTimeRef = useRef(0); // play time from previous attempts (persists across retries)

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 100);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Restart the level — mines stay the same, revealed mines accumulate
  // Score state persists: accumulatedTime, deaths (via attempts), interceptBonuses
  const restart = useCallback(() => {
    stopTimer();
    setShipPos(level.startPos);
    setShipAngle(0);
    setVisitedTiles(new Set([`${level.startPos.col},${level.startPos.row}`]));
    setGameState(GAME_STATE.READY);
    setDeathCause(null);
    setKillerDronePos(null);
    setElapsedMs(0);
    setSonarPing(null);
    setIsFirstMove(true);
    setAttempts((a) => a + 1);
    setActiveDrones([...(level.drones || [])]);
    setInterceptsLeft(1);
    setInterceptMessage(null);
    setLastInterceptEvent(null);
    setWakeTrail([]);
    setScoreEvents([]);
    // NOTE: interceptBonuses and accumulatedTimeRef persist across retries
    if (interceptMsgTimerRef.current) clearTimeout(interceptMsgTimerRef.current);
    isMovingRef.current = false;
    finalTimeRef.current = null;
  }, [level, stopTimer]);

  // Instant intercept: find closest drone within 3 tiles, destroy it
  const intercept = useCallback(() => {
    if (interceptsLeft <= 0) return;
    if (gameStateRef.current === GAME_STATE.DEAD || gameStateRef.current === GAME_STATE.DYING || gameStateRef.current === GAME_STATE.WON) return;

    // Find closest drone within Manhattan distance 3
    let bestDrone = null;
    let bestDist = Infinity;
    for (const drone of activeDrones) {
      const dist = Math.abs(shipPos.col - drone.col) + Math.abs(shipPos.row - drone.row);
      if (dist <= 3 && dist < bestDist) {
        bestDist = dist;
        bestDrone = drone;
      }
    }

    if (bestDrone) {
      setInterceptsLeft(0);
      setLastInterceptEvent({
        from: { col: shipPos.col, row: shipPos.row },
        to: { col: bestDrone.col, row: bestDrone.row },
        key: Date.now(),
      });
      setActiveDrones((prev) => prev.filter((d) => d !== bestDrone));
      setInterceptBonuses((prev) => prev + 200);
      setScoreEvents((prev) => [...prev, {
        key: Date.now(),
        type: 'intercept',
        amount: 200,
        col: shipPos.col,
        row: shipPos.row,
      }]);
    } else {
      // No drone in range — show message for 1.5s
      setInterceptMessage('NO DRONE IN RANGE');
      if (interceptMsgTimerRef.current) clearTimeout(interceptMsgTimerRef.current);
      interceptMsgTimerRef.current = setTimeout(() => {
        setInterceptMessage(null);
      }, 1500);
    }
  }, [interceptsLeft, activeDrones, shipPos]);

  // Move the ship — win/death detected here with local newCol/newRow
  const move = useCallback(
    (direction) => {
      if (gameStateRef.current === GAME_STATE.DEAD || gameStateRef.current === GAME_STATE.DYING || gameStateRef.current === GAME_STATE.WON) return;
      if (isMovingRef.current) return;

      const dir = DIRECTIONS[direction];
      if (!dir) return;

      const newCol = shipPos.col + dir.col;
      const newRow = shipPos.row + dir.row;

      if (!isValidMove(newCol, newRow, level)) return;

      // Start timer on first move
      if (gameStateRef.current === GAME_STATE.READY) {
        setGameState(GAME_STATE.PLAYING);
        gameStateRef.current = GAME_STATE.PLAYING;
        setIsFirstMove(false);
        startTimer();
      }

      isMovingRef.current = true;
      setShipAngle(dir.angle);

      // Track wake trail (last 3 positions)
      setWakeTrail((prev) => {
        const next = [{ col: shipPos.col, row: shipPos.row, key: Date.now() }, ...prev];
        return next.slice(0, 3);
      });

      setShipPos({ col: newCol, row: newRow });
      setSonarPing({ col: newCol, row: newRow, key: Date.now() });

      setVisitedTiles((prev) => {
        const next = new Set(prev);
        next.add(`${newCol},${newRow}`);
        return next;
      });

      const tileKey = `${newCol},${newRow}`;

      // Check for mine hit — reveal only the mine that was hit
      if (mines.has(tileKey)) {
        // Floating score event at ship position
        setScoreEvents((prev) => [...prev, {
          key: Date.now(),
          type: 'mine',
          amount: -500,
          col: newCol,
          row: newRow,
        }]);
        // Immediately start explosion (after movement animation completes)
        setTimeout(() => {
          // Accumulate this attempt's play time (death screen time is NOT counted)
          if (startTimeRef.current) {
            accumulatedTimeRef.current += Date.now() - startTimeRef.current;
          }
          stopTimer();
          setDeathCause('mine');
          setRevealedMines((prev) => {
            const next = new Set(prev);
            next.add(tileKey);
            return next;
          });
          setGameState(GAME_STATE.DYING);
          gameStateRef.current = GAME_STATE.DYING;
          isMovingRef.current = false;
        }, 160);
        // Show death overlay after explosion plays
        setTimeout(() => {
          setGameState(GAME_STATE.DEAD);
          gameStateRef.current = GAME_STATE.DEAD;
        }, 1660); // 160ms move + 1500ms explosion
        return;
      }

      // Check for drone kill zone — find which drone killed the player
      if (droneKillZones.has(tileKey)) {
        // Floating score event at ship position
        setScoreEvents((prev) => [...prev, {
          key: Date.now() + 1,
          type: 'drone',
          amount: -500,
          col: newCol,
          row: newRow,
        }]);
        // Find the closest active drone to the death tile
        let closestDrone = null;
        let closestDist = Infinity;
        const radius = level.id <= 5 ? 1 : 2;
        for (const drone of activeDrones) {
          const dist = Math.abs(newCol - drone.col) + Math.abs(newRow - drone.row);
          if (dist <= radius && dist < closestDist) {
            closestDist = dist;
            closestDrone = drone;
          }
        }
        // Immediately start drone strike animation
        setTimeout(() => {
          // Accumulate this attempt's play time (death screen time is NOT counted)
          if (startTimeRef.current) {
            accumulatedTimeRef.current += Date.now() - startTimeRef.current;
          }
          stopTimer();
          setDeathCause('drone');
          if (closestDrone) setKillerDronePos({ col: closestDrone.col, row: closestDrone.row });
          setGameState(GAME_STATE.DYING);
          gameStateRef.current = GAME_STATE.DYING;
          isMovingRef.current = false;
        }, 160);
        // Show death overlay after explosion plays
        setTimeout(() => {
          setGameState(GAME_STATE.DEAD);
          gameStateRef.current = GAME_STATE.DEAD;
        }, 1660); // 160ms move + 1500ms explosion
        return;
      }

      // Check for win
      if (newCol === level.endPos.col && newRow === level.endPos.row) {
        console.log('[useGame] Win detected at', { newCol, newRow });
        setScoreEvents((prev) => [...prev, {
          key: Date.now() + 2,
          type: 'port',
          amount: 1000,
          col: newCol,
          row: newRow,
        }]);
        setTimeout(() => {
          const currentAttemptTime = Date.now() - startTimeRef.current;
          // Total play time = all previous attempts + this winning attempt
          finalTimeRef.current = accumulatedTimeRef.current + currentAttemptTime;
          console.log('[useGame] Setting WON state, totalTime:', finalTimeRef.current, 'currentAttempt:', currentAttemptTime);
          stopTimer();
          setElapsedMs(currentAttemptTime);
          setGameState(GAME_STATE.WON);
          gameStateRef.current = GAME_STATE.WON;
          isMovingRef.current = false;
        }, 160);
        return;
      }

      // Normal move — unlock input after animation
      setTimeout(() => {
        isMovingRef.current = false;
      }, 160);
    },
    [shipPos, level, mines, droneKillZones, activeDrones, startTimer, stopTimer]
  );

  // Keyboard handler
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT') return;

      // SPACE → instant intercept
      if (e.key === ' ') {
        e.preventDefault();
        intercept();
        return;
      }

      const direction = keyToDirection(e.key);
      if (direction) {
        e.preventDefault();
        move(direction);
      }
      if (e.key === 'r' || e.key === 'R') {
        if (gameStateRef.current === GAME_STATE.DEAD || gameStateRef.current === GAME_STATE.WON) {
          restart();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [move, restart, intercept]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      if (interceptMsgTimerRef.current) clearTimeout(interceptMsgTimerRef.current);
    };
  }, [stopTimer]);

  const sonarReading = getSonarReading(shipPos.col, shipPos.row, mines);
  const deaths = attempts - 1;
  const finalElapsedMs = finalTimeRef.current; // total accumulated time at win
  // Total play time so far: previous attempts + current attempt (for live score)
  const totalElapsedMs = accumulatedTimeRef.current + elapsedMs;

  return {
    shipPos,
    shipAngle,
    mines,
    activeDrones,
    droneKillZones,
    visitedTiles,
    gameState,
    deathCause,
    killerDronePos,
    elapsedMs,
    finalElapsedMs,
    totalElapsedMs,
    attempts,
    deaths,
    sonarPing,
    sonarReading,
    revealedMines,
    isFirstMove,
    interceptsLeft,
    interceptMessage,
    lastInterceptEvent,
    wakeTrail,
    scoreEvents,
    interceptBonuses,
    move,
    restart,
    intercept,
    GAME_STATE,
  };
}
