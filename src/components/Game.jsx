import { useState, useEffect, useRef } from 'react';
import { useGame } from '../game/useGame';
import { recordCompletion } from '../game/storage';
import { getNickname, setNickname, submitScore, getRank } from '../game/supabase';
import GameBoard from './GameBoard';
import HUD from './HUD';
import MobileControls from './MobileControls';
import NicknamePrompt from './NicknamePrompt';
import { DeathOverlay, WinOverlay } from './GameOverlay';

export default function Game({ level, onLevelSelect, onNextLevel, onLeaderboard, hasNextLevel }) {
  const {
    shipPos,
    shipAngle,
    mines,
    visitedTiles,
    gameState,
    elapsedMs,
    attempts,
    sonarPing,
    sonarReading,
    revealMines,
    move,
    restart,
    GAME_STATE,
  } = useGame(level);

  const levelName = `Level ${level.id}: ${level.name}`;
  const [isNewBest, setIsNewBest] = useState(false);
  const [globalRank, setGlobalRank] = useState(null);
  const [showNicknamePrompt, setShowNicknamePrompt] = useState(false);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const recordedRef = useRef(false);

  // Record completion and submit score exactly once when won
  useEffect(() => {
    if (gameState === GAME_STATE.WON && !recordedRef.current) {
      recordedRef.current = true;
      const newBest = recordCompletion(level.id, elapsedMs);
      setIsNewBest(newBest);

      // Check if we have a nickname to submit score
      const nickname = getNickname();
      if (nickname) {
        submitScore(level.id, elapsedMs, nickname).then(() => {
          setScoreSubmitted(true);
        });
        getRank(level.id, elapsedMs).then((rank) => {
          setGlobalRank(rank);
        });
      } else {
        // Show nickname prompt
        setShowNicknamePrompt(true);
      }
    }
    if (gameState === GAME_STATE.READY) {
      recordedRef.current = false;
      setIsNewBest(false);
      setGlobalRank(null);
      setScoreSubmitted(false);
    }
  }, [gameState, level.id, elapsedMs, GAME_STATE.WON, GAME_STATE.READY]);

  const handleNicknameSubmit = (name) => {
    setNickname(name);
    setShowNicknamePrompt(false);
    submitScore(level.id, elapsedMs, name).then(() => {
      setScoreSubmitted(true);
    });
    getRank(level.id, elapsedMs).then((rank) => {
      setGlobalRank(rank);
    });
  };

  const handleNicknameCancel = () => {
    setShowNicknamePrompt(false);
  };

  return (
    <div className="flex flex-col h-full">
      <HUD
        levelName={levelName}
        elapsedMs={elapsedMs}
        sonarReading={sonarReading}
        gameState={gameState}
        GAME_STATE={GAME_STATE}
        onLevelSelect={onLevelSelect}
      />

      {/* Game area */}
      <div
        className={`flex-1 flex items-center justify-center overflow-hidden relative ${
          gameState === GAME_STATE.DEAD ? 'screen-shake' : ''
        }`}
        style={{ background: 'var(--color-ocean-deep)' }}
      >
        <div className="relative">
          <GameBoard
            level={level}
            shipPos={shipPos}
            shipAngle={shipAngle}
            mines={mines}
            visitedTiles={visitedTiles}
            sonarPing={sonarPing}
            revealMines={revealMines}
            gameState={gameState}
            GAME_STATE={GAME_STATE}
            move={move}
          />

          {gameState === GAME_STATE.DEAD && (
            <DeathOverlay
              attempts={attempts}
              onRestart={restart}
              onLevelSelect={onLevelSelect}
            />
          )}

          {gameState === GAME_STATE.WON && (
            <WinOverlay
              levelName={levelName}
              elapsedMs={elapsedMs}
              attempts={attempts}
              isNewBest={isNewBest}
              globalRank={globalRank}
              onRestart={restart}
              onNextLevel={onNextLevel}
              onLevelSelect={onLevelSelect}
              onLeaderboard={onLeaderboard}
              hasNextLevel={hasNextLevel}
            />
          )}
        </div>
      </div>

      <MobileControls onMove={move} onRestart={restart} />

      {showNicknamePrompt && (
        <NicknamePrompt
          onSubmit={handleNicknameSubmit}
          onCancel={handleNicknameCancel}
        />
      )}
    </div>
  );
}
