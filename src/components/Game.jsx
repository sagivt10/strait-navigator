import { useState, useEffect, useRef } from 'react';
import { useGame } from '../game/useGame';
// Score is now computed inline with accumulated time
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

  // Audio: explosion on dying (start of death sequence), victory horn on win
  useEffect(() => {
    if (gameState === GAME_STATE.DYING) playExplosion();
    if (gameState === GAME_STATE.WON) playVictory();
  }, [gameState, GAME_STATE.DYING, GAME_STATE.WON]);

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

  // Compute score from total accumulated time across all attempts
  const computeFinalScore = (totalTimeMs) => {
    const timePenalty = Math.round(totalTimeMs / 100);
    const deathPenalty = deaths * 500;
    return Math.max(0, 10000 - timePenalty - deathPenalty + interceptBonuses);
  };

  // Record completion and submit score exactly once when won
  useEffect(() => {
    if (gameState === GAME_STATE.WON && !recordedRef.current) {
      recordedRef.current = true;
      // finalElapsedMs now contains total accumulated play time across all attempts
      const timeForScore = finalElapsedMs ?? totalElapsedMs;
      const score = computeFinalScore(timeForScore);
      console.log('[WIN] Recording completion:', { timeForScore, deaths, score, interceptBonuses, levelId: level.id });
      const newBest = recordCompletion(level.id, timeForScore, score);
      setIsNewBest(newBest);

      const nickname = getNickname();
      console.log('[WIN] Nickname:', nickname ? nickname : '(none — showing prompt)');
      if (nickname) {
        submitScore(level.id, timeForScore, nickname, score, deaths).then((result) => {
          console.log('[WIN] Score submitted:', result);
          setScoreSubmitted(true);
        });
        getRank(level.id, score, timeForScore).then((rank) => {
          console.log('[WIN] Global rank:', rank);
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
  }, [gameState, level.id, finalElapsedMs, totalElapsedMs, deaths, interceptBonuses, GAME_STATE.WON, GAME_STATE.READY]);

  const handleNicknameSubmit = (name) => {
    setNickname(name);
    setShowNicknamePrompt(false);
    const timeForScore = finalElapsedMs ?? totalElapsedMs;
    const score = computeFinalScore(timeForScore);
    console.log('[WIN] Nickname submitted, saving score:', { name, timeForScore, score, deaths });
    submitScore(level.id, timeForScore, name, score, deaths).then((result) => {
      console.log('[WIN] Score submitted after nickname:', result);
      setScoreSubmitted(true);
    });
    getRank(level.id, score, timeForScore).then((rank) => {
      setGlobalRank(rank);
    });
  };

  const handleNicknameCancel = () => {
    setShowNicknamePrompt(false);
  };

  // Final score at win — uses total accumulated play time
  const winTimeMs = finalElapsedMs ?? totalElapsedMs;
  const finalScore = gameState === GAME_STATE.WON ? computeFinalScore(winTimeMs) : 0;
  const timePenalty = Math.round(winTimeMs / 100);
  const deathPenalty = deaths * 500;

  // Live score: uses total accumulated time (previous attempts + current) for persistent scoring
  const liveScore = gameState === GAME_STATE.READY
    ? 10000
    : Math.max(0, 10000 - Math.round(totalElapsedMs / 100) - (deaths * 500) + interceptBonuses);

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
        interceptsLeft={interceptsLeft}
        interceptMessage={interceptMessage}
        liveScore={liveScore}
        scoreEvents={scoreEvents}
      />

      {/* Game area */}
      <div
        className={`flex-1 flex items-center justify-center overflow-hidden relative ${
          gameState === GAME_STATE.DYING ? 'screen-shake' : ''
        }`}
        style={{ background: 'var(--color-ocean-deep)' }}
      >
        <div className="relative">
          <GameBoard
            level={level}
            shipPos={shipPos}
            shipAngle={shipAngle}
            mines={mines}
            activeDrones={activeDrones}
            visitedTiles={visitedTiles}
            sonarPing={sonarPing}
            revealedMines={revealedMines}
            gameState={gameState}
            deathCause={deathCause}
            killerDronePos={killerDronePos}
            GAME_STATE={GAME_STATE}
            move={move}
            wakeTrail={wakeTrail}
            lastInterceptEvent={lastInterceptEvent}
            scoreEvents={scoreEvents}
          />

          {gameState === GAME_STATE.DEAD && (
            <DeathOverlay
              attempts={attempts}
              deathCause={deathCause}
              onRestart={restart}
              onLevelSelect={onLevelSelect}
            />
          )}

          {gameState === GAME_STATE.WON && (
            <WinOverlay
              levelName={levelName}
              elapsedMs={elapsedMs}
              score={finalScore}
              timePenalty={timePenalty}
              deathPenalty={deathPenalty}
              interceptBonuses={interceptBonuses}
              attempts={attempts}
              deaths={deaths}
              isNewBest={isNewBest}
              globalRank={globalRank}
              onRestart={restart}
              onNextLevel={onNextLevel}
              onLeaderboard={onLeaderboard}
              hasNextLevel={hasNextLevel}
            />
          )}
        </div>
      </div>

      <MobileControls onMove={move} onRestart={restart} onIntercept={intercept} interceptsLeft={interceptsLeft} />

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
