import { useState, useCallback, useEffect, useRef } from 'react';
import {
  placeMines,
  getSonarReading,
  isValidMove,
  DIRECTIONS,
  keyToDirection,
} from './engine';

const GAME_STATE = {
  READY: 'ready',
  PLAYING: 'playing',
  DEAD: 'dead',
  WON: 'won',
};

export function useGame(level) {
  const [shipPos, setShipPos] = useState(level.startPos);
  const [shipAngle, setShipAngle] = useState(0);
  const [mines] = useState(() => placeMines(level));
  const [visitedTiles, setVisitedTiles] = useState(() => new Set([`${level.startPos.col},${level.startPos.row}`]));
  const [gameState, setGameState] = useState(GAME_STATE.READY);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [attempts, setAttempts] = useState(1);
  const [sonarPing, setSonarPing] = useState(null);
  const [revealedMines, setRevealedMines] = useState(new Set()); // accumulates across retries
  const [isFirstMove, setIsFirstMove] = useState(true);

  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const isMovingRef = useRef(false);
  const gameStateRef = useRef(gameState);

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
  const restart = useCallback(() => {
    stopTimer();
    setShipPos(level.startPos);
    setShipAngle(0);
    setVisitedTiles(new Set([`${level.startPos.col},${level.startPos.row}`]));
    setGameState(GAME_STATE.READY);
    setElapsedMs(0);
    setSonarPing(null);
    setIsFirstMove(true);
    setAttempts((a) => a + 1);
    isMovingRef.current = false;
  }, [level, stopTimer]);

  // Move the ship — win/death detected here with local newCol/newRow
  const move = useCallback(
    (direction) => {
      if (gameStateRef.current === GAME_STATE.DEAD || gameStateRef.current === GAME_STATE.WON) return;
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
      setShipPos({ col: newCol, row: newRow });
      setSonarPing({ col: newCol, row: newRow, key: Date.now() });

      setVisitedTiles((prev) => {
        const next = new Set(prev);
        next.add(`${newCol},${newRow}`);
        return next;
      });

      const tileKey = `${newCol},${newRow}`;

      // --- DEBUG: log every move for win detection ---
      console.log('[MOVE]', { newCol, newRow, tileKey, endPos: level.endPos, matchesEnd: newCol === level.endPos.col && newRow === level.endPos.row, hasMine: mines.has(tileKey) });

      // Check for mine hit — reveal only the mine that was hit
      if (mines.has(tileKey)) {
        setTimeout(() => {
          stopTimer();
          setGameState(GAME_STATE.DEAD);
          gameStateRef.current = GAME_STATE.DEAD;
          setRevealedMines((prev) => {
            const next = new Set(prev);
            next.add(tileKey);
            return next;
          });
          isMovingRef.current = false;
        }, 160);
        return;
      }

      // Check for win
      if (newCol === level.endPos.col && newRow === level.endPos.row) {
        console.log('[WIN] Reached endPos!', { newCol, newRow, endPos: level.endPos });
        setTimeout(() => {
          // Capture final time before stopping the timer
          const finalTime = Date.now() - startTimeRef.current;
          stopTimer();
          setElapsedMs(finalTime);
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
    [shipPos, level, mines, startTimer, stopTimer]
  );

  // Keyboard handler
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT') return;
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
  }, [move, restart]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  const sonarReading = getSonarReading(shipPos.col, shipPos.row, mines);

  return {
    shipPos,
    shipAngle,
    mines,
    visitedTiles,
    gameState,
    elapsedMs,
    attempts,
    sonarPing,
    sonarReading,
    revealedMines,
    isFirstMove,
    move,
    restart,
    GAME_STATE,
  };
}
