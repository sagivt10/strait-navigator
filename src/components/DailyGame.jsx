import { useState, useEffect, useRef } from 'react';
import { useGame } from '../game/useGame';
import { formatTime, getSonarReading } from '../game/engine';
import { getDailyLevel, getDailyDateString, formatDailyDate, hasDailySubmitted, markDailySubmitted, clearDailySubmitted, buildRouteEmojiGrid } from '../game/daily';
import { getNickname, setNickname, submitDailyScore, verifyDailySubmission } from '../game/supabase';
import { startOceanAmbient, stopOceanAmbient, playSonarPing, playExplosion, playVictory, isMuted, toggleMute } from '../game/audio';
import GameBoard from './GameBoard';
import HUD from './HUD';
import MobileControls from './MobileControls';
import NicknamePrompt from './NicknamePrompt';
import HowToPlay from './HowToPlay';
import { DeathOverlay } from './GameOverlay';

const HOW_TO_PLAY_KEY = 'strait-navigator-howtoplay-seen';

export default function DailyGame({ onBack, onDailyLeaderboard }) {
  const dateStr = getDailyDateString();
  const [level] = useState(() => getDailyLevel(dateStr));

  const {
    shipPos, shipAngle, mines, activeDrones, droneKillZones,
    visitedTiles, gameState, deathCause, killerDronePos,
    elapsedMs, finalElapsedMs, totalElapsedMs, attempts, deaths,
    sonarPing, sonarReading, revealedMines, isFirstMove,
    interceptsLeft, interceptMessage, lastInterceptEvent, wakeTrail,
    scoreEvents, interceptBonuses,
    move, restart, intercept, GAME_STATE,
  } = useGame(level);

  const [showNicknamePrompt, setShowNicknamePrompt] = useState(false);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const recordedRef = useRef(false);
  const [muted, setMutedState] = useState(() => isMuted());

  // Audio
  useEffect(() => { startOceanAmbient(); return () => stopOceanAmbient(); }, []);

  // Self-heal stale localStorage flag: if localStorage says "submitted" but
  // no row actually exists in daily_scores, clear the flag so the player can retry.
  useEffect(() => {
    if (hasDailySubmitted(dateStr)) {
      const nickname = getNickname();
      if (nickname) {
        verifyDailySubmission(dateStr, nickname).then((exists) => {
          if (!exists) {
            console.warn('[DAILY] Stale localStorage flag detected — no row in daily_scores for', dateStr, nickname, '— clearing');
            clearDailySubmitted();
          } else {
            console.log('[DAILY] Verified: submission exists in daily_scores for', dateStr);
          }
        });
      }
    }
  }, [dateStr]);

  const prevSonarPingRef = useRef(null);
  useEffect(() => {
    if (sonarPing && sonarPing.key !== prevSonarPingRef.current) {
      prevSonarPingRef.current = sonarPing.key;
      playSonarPing();
    }
  }, [sonarPing]);

  useEffect(() => {
    if (gameState === GAME_STATE.DYING) playExplosion();
    if (gameState === GAME_STATE.WON) playVictory();
  }, [gameState, GAME_STATE.DYING, GAME_STATE.WON]);

  const handleToggleMute = () => { setMutedState(toggleMute()); };

  // How-to-play
  const [showHowToPlay, setShowHowToPlay] = useState(() => !localStorage.getItem(HOW_TO_PLAY_KEY));
  const dismissHowToPlay = () => { localStorage.setItem(HOW_TO_PLAY_KEY, '1'); setShowHowToPlay(false); };
  const openHowToPlay = () => setShowHowToPlay(true);

  // Compute daily score from total accumulated time across all attempts
  // Daily uses -300 per death instead of -500
  const computeFinalDailyScore = (totalTimeMs) => {
    const tp = Math.round(totalTimeMs / 100);
    const dp = deaths * 300;
    return Math.max(0, 10000 - tp - dp + interceptBonuses);
  };

  // Daily score submission — once per day
  useEffect(() => {
    if (gameState === GAME_STATE.WON && !recordedRef.current) {
      recordedRef.current = true;

      if (hasDailySubmitted(dateStr)) {
        console.log('[DAILY] Already submitted today, skipping');
        return;
      }

      const timeForScore = finalElapsedMs ?? totalElapsedMs;
      const score = computeFinalDailyScore(timeForScore);
      console.log('[DAILY] Win!', { dateStr, timeForScore, deaths, score });

      const nickname = getNickname();
      console.log('[DAILY] Nickname:', nickname || '(none — showing prompt)');
      if (nickname) {
        submitDailyScore(dateStr, timeForScore, nickname, score, deaths).then((result) => {
          if (result) {
            console.log('[DAILY] Submission succeeded, marking localStorage');
            markDailySubmitted(dateStr);
            setScoreSubmitted(true);
          } else {
            console.error('[DAILY] Submission returned null — NOT marking localStorage');
          }
        });
      } else {
        setShowNicknamePrompt(true);
      }
    }
    if (gameState === GAME_STATE.READY) {
      recordedRef.current = false;
      setScoreSubmitted(false);
    }
  }, [gameState, dateStr, finalElapsedMs, totalElapsedMs, deaths, GAME_STATE.WON, GAME_STATE.READY]);

  const handleNicknameSubmit = (name) => {
    setNickname(name);
    setShowNicknamePrompt(false);
    const timeForScore = finalElapsedMs ?? totalElapsedMs;
    const score = computeFinalDailyScore(timeForScore);
    console.log('[DAILY] Nickname submitted, submitting score:', { name, dateStr, timeForScore, score, deaths });
    submitDailyScore(dateStr, timeForScore, name, score, deaths).then((result) => {
      if (result) {
        console.log('[DAILY] Post-nickname submission succeeded, marking localStorage');
        markDailySubmitted(dateStr);
        setScoreSubmitted(true);
      } else {
        console.error('[DAILY] Post-nickname submission returned null — NOT marking localStorage');
      }
    });
  };

  const winTimeMs = finalElapsedMs ?? totalElapsedMs;
  const score = gameState === GAME_STATE.WON ? computeFinalDailyScore(winTimeMs) : 0;
  const dailyTimePenalty = Math.round(winTimeMs / 100);
  const dailyDeathPenalty = deaths * 300;
  // Live score: uses total accumulated time (previous attempts + current)
  const liveScore = gameState === GAME_STATE.READY
    ? 10000
    : Math.max(0, 10000 - Math.round(totalElapsedMs / 100) - (deaths * 300) + interceptBonuses);
  const timeStr = formatTime(finalElapsedMs ?? elapsedMs);
  const alreadySubmitted = hasDailySubmitted(dateStr);

  // Build emoji route grid for share text
  const emojiGrid = gameState === GAME_STATE.WON
    ? buildRouteEmojiGrid(visitedTiles, mines)
    : '';

  const dateLabel = formatDailyDate(dateStr);
  const shareText = gameState === GAME_STATE.WON
    ? `Strait Navigator Daily \u2014 ${dateLabel} \u{1F6A2}\nScore: ${score.toLocaleString()} | Time: ${timeStr} | Deaths: ${deaths}\n${emojiGrid}\nstraitnavigator.com`
    : '';

  const [copied, setCopied] = useState(false);
  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = shareText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <HUD
        levelName={`DAILY CHALLENGE \u{1F5D3}\uFE0F`}
        elapsedMs={elapsedMs}
        sonarReading={sonarReading}
        gameState={gameState}
        GAME_STATE={GAME_STATE}
        onLevelSelect={onBack}
        muted={muted}
        onToggleMute={handleToggleMute}
        onHelp={openHowToPlay}
        showSonarTooltip={false}
        interceptsLeft={interceptsLeft}
        interceptMessage={interceptMessage}
        liveScore={liveScore}
        scoreEvents={scoreEvents}
      />

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
              onLevelSelect={onBack}
            />
          )}

          {/* Daily Win Overlay */}
          {gameState === GAME_STATE.WON && (
            <div
              className="fixed inset-0 flex items-center justify-center z-50"
              style={{ background: 'rgba(13, 33, 55, 0.85)' }}
            >
              <div className="text-center px-3" style={{ overflowY: 'auto', maxHeight: '85vh', paddingBottom: 16 }}>
                <div style={{ fontSize: 28, marginBottom: 2 }}>{'\u{1F5D3}\uFE0F'}</div>
                <div style={{
                  fontFamily: 'var(--font-display)', fontSize: 28,
                  color: '#00cc88', marginBottom: 4,
                  textShadow: '0 0 20px rgba(0,204,136,0.4)',
                }}>
                  DAILY COMPLETE
                </div>
                <div style={{
                  fontFamily: 'var(--font-display)', fontSize: 16,
                  color: 'var(--color-ui-accent)', marginBottom: 10,
                }}>
                  {dateLabel}
                </div>

                {/* Score breakdown */}
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 13,
                  color: 'var(--color-ui-text)', marginBottom: 8,
                  lineHeight: 1.8, opacity: 0.7,
                }}>
                  <div>Base: <span style={{ color: 'var(--color-ui-text)' }}>10,000</span></div>
                  <div>Time penalty: <span style={{ color: '#ff6b35' }}>-{dailyTimePenalty.toLocaleString()}</span></div>
                  {deaths > 0 && (
                    <div>Deaths: <span style={{ color: '#ff0000' }}>{deaths} &times; -300 = -{dailyDeathPenalty.toLocaleString()}</span></div>
                  )}
                  {interceptBonuses > 0 && (
                    <div>Intercept: <span style={{ color: '#00cc88' }}>+{interceptBonuses.toLocaleString()}</span></div>
                  )}
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 32,
                  color: 'var(--color-ui-accent)', marginBottom: 2, fontWeight: 700,
                }}>
                  ${score.toLocaleString()}
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  color: 'var(--color-ui-text)', opacity: 0.4,
                  textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6,
                }}>
                  FINAL SCORE
                </div>

                {/* Time + Deaths */}
                <div style={{
                  fontFamily: 'var(--font-mono)', fontSize: 14,
                  color: 'var(--color-ui-text)', marginBottom: 6, opacity: 0.6,
                }}>
                  {timeStr} &middot; {deaths === 0 ? 'No deaths' : `${deaths} death${deaths > 1 ? 's' : ''}`}
                </div>

                {/* Emoji route grid */}
                {emojiGrid && (
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 14,
                    marginBottom: 10, letterSpacing: 1, lineHeight: 1.4,
                    maxWidth: 300, margin: '0 auto 10px', wordBreak: 'break-all',
                  }}>
                    {emojiGrid}
                  </div>
                )}

                {alreadySubmitted && (
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontSize: 12,
                    color: 'var(--color-ui-text)', opacity: 0.4, marginBottom: 8,
                  }}>
                    Score already submitted today
                  </div>
                )}

                {/* Share */}
                <button
                  onClick={handleShare}
                  className="cursor-pointer mb-2 block mx-auto"
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 13,
                    padding: '8px 20px',
                    background: copied ? 'rgba(0,204,136,0.2)' : 'rgba(240,165,0,0.15)',
                    color: copied ? '#00cc88' : 'var(--color-ui-accent)',
                    border: `1px solid ${copied ? 'rgba(0,204,136,0.4)' : 'rgba(240,165,0,0.3)'}`,
                    borderRadius: 4, transition: 'all 0.2s',
                  }}
                >
                  {copied ? 'COPIED!' : 'SHARE RESULT'}
                </button>

                {/* Action buttons */}
                <div className="flex items-center gap-2 justify-center flex-wrap mt-2">
                  <button onClick={onDailyLeaderboard} className="cursor-pointer" style={{
                    fontFamily: 'var(--font-mono)', fontSize: 13, padding: '10px 16px',
                    background: 'rgba(240,165,0,0.1)', color: 'var(--color-ui-accent)',
                    border: '1px solid rgba(240,165,0,0.25)', borderRadius: 4,
                  }}>
                    DAILY RANKS
                  </button>
                  <button onClick={restart} className="cursor-pointer" style={{
                    fontFamily: 'var(--font-mono)', fontSize: 13, padding: '10px 16px',
                    background: 'transparent', color: 'var(--color-ui-text)',
                    border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, opacity: 0.7,
                  }}>
                    REPLAY [R]
                  </button>
                  <button onClick={onBack} className="cursor-pointer" style={{
                    fontFamily: 'var(--font-mono)', fontSize: 13, padding: '10px 16px',
                    background: 'transparent', color: 'var(--color-ui-text)',
                    border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, opacity: 0.7,
                  }}>
                    MISSIONS
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <MobileControls onMove={move} onRestart={restart} onIntercept={intercept} interceptsLeft={interceptsLeft} />

      {showHowToPlay && <HowToPlay onDismiss={dismissHowToPlay} />}

      {showNicknamePrompt && (
        <NicknamePrompt
          onSubmit={handleNicknameSubmit}
          onCancel={() => setShowNicknamePrompt(false)}
        />
      )}
    </div>
  );
}
