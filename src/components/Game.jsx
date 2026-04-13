import { useState, useEffect, useRef } from 'react';
import { useGame } from '../game/useGame';
import { recordCompletion } from '../game/storage';
import { getNickname, setNickname, submitScore, getRank } from '../game/supabase';
import { startOceanAmbient, stopOceanAmbient, playSonarPing, playExplosion, playVictory, isMuted, toggleMute } from '../game/audio';
import GameBoard from './GameBoard';
import HUD from './HUD';
import MobileControls from './MobileControls';
import NicknamePrompt from './NicknamePrompt';
import HowToPlay from './HowToPlay';
import { DeathOverlay, WinOverlay } from './GameOverlay';

const HOW_TO_PLAY_KEY = 'strait-navigator-howtoplay-seen';

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
    revealedMines,
    isFirstMove,
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
  const [muted, setMutedState] = useState(() => isMuted());

  // Audio: start ocean ambient on mount, stop on unmount
  useEffect(() => {
    startOceanAmbient();
    return () => stopOceanAmbient();
  }, []);

  // Audio: sonar ping on each move
  const prevSonarPingRef = useRef(null);
  useEffect(() => {
    if (sonarPing && sonarPing.key !== prevSonarPingRef.current) {
      prevSonarPingRef.current = sonarPing.key;
      playSonarPing();
    }
  }, [sonarPing]);

  // Audio: explosion on death, victory horn on win
  useEffect(() => {
    if (gameState === GAME_STATE.DEAD) playExplosion();
    if (gameState === GAME_STATE.WON) playVictory();
  }, [gameState, GAME_STATE.DEAD, GAME_STATE.WON]);

  const handleToggleMute = () => {
    const nowMuted = toggleMute();
    setMutedState(nowMuted);
  };

  // How-to-play modal: show before Level 1 (once ever), or when ? button is clicked
  const [showHowToPlay, setShowHowToPlay] = useState(() => {
    if (level.id !== 1) return false;
    return !localStorage.getItem(HOW_TO_PLAY_KEY);
  });

  // Sonar tooltip: show on first move of Level 1, once ever
  const SONAR_TIP_KEY = 'strait-navigator-sonar-tip-seen';
  const [showSonarTooltip, setShowSonarTooltip] = useState(false);
  const sonarTipShownRef = useRef(false);

  useEffect(() => {
    if (
      !isFirstMove &&
      level.id === 1 &&
      !sonarTipShownRef.current &&
      !localStorage.getItem(SONAR_TIP_KEY)
    ) {
      sonarTipShownRef.current = true;
      setShowSonarTooltip(true);
      localStorage.setItem(SONAR_TIP_KEY, '1');
      const timer = setTimeout(() => setShowSonarTooltip(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [isFirstMove, level.id]);

  const dismissHowToPlay = () => {
    localStorage.setItem(HOW_TO_PLAY_KEY, '1');
    setShowHowToPlay(false);
  };

  const openHowToPlay = () => {
    setShowHowToPlay(true);
  };

  // Record completion and submit score exactly once when won
  useEffect(() => {
    if (gameState === GAME_STATE.WON && !recordedRef.current) {
      recordedRef.current = true;
      const newBest = recordCompletion(level.id, elapsedMs);
      setIsNewBest(newBest);

      const nickname = getNickname();
      if (nickname) {
        submitScore(level.id, elapsedMs, nickname).then(() => {
          setScoreSubmitted(true);
        });
        getRank(level.id, elapsedMs).then((rank) => {
          setGlobalRank(rank);
        });
      } else {
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
        muted={muted}
        onToggleMute={handleToggleMute}
        onHelp={openHowToPlay}
        showSonarTooltip={showSonarTooltip}
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
            revealedMines={revealedMines}
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

      {showHowToPlay && <HowToPlay onDismiss={dismissHowToPlay} />}

      {showNicknamePrompt && (
        <NicknamePrompt
          onSubmit={handleNicknameSubmit}
          onCancel={handleNicknameCancel}
        />
      )}
    </div>
  );
}
