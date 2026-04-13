import { useState, useEffect, useRef } from 'react';
import { formatTime, getSonarColor } from '../game/engine';

export default function HUD({ levelName, elapsedMs, sonarReading, gameState, GAME_STATE, onLevelSelect, showSonarTooltip, muted, onToggleMute, onHelp, interceptsLeft, interceptMessage, liveScore, scoreEvents }) {
  const [flashColor, setFlashColor] = useState(null);
  const flashTimerRef = useRef(null);
  const prevEventsLenRef = useRef(0);

  useEffect(() => {
    if (!scoreEvents || scoreEvents.length === 0 || scoreEvents.length === prevEventsLenRef.current) return;
    prevEventsLenRef.current = scoreEvents.length;
    const latest = scoreEvents[scoreEvents.length - 1];
    const colors = {
      mine: '#ff0000',
      drone: '#ff8800',
      intercept: '#00cc88',
      port: '#ffd700',
    };
    setFlashColor(colors[latest.type] || null);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashColor(null), 300);
  }, [scoreEvents]);

  const formattedScore = `$${(liveScore ?? 10000).toLocaleString()}`;

  const sonarColor = getSonarColor(sonarReading);
  const sonarLabel =
    sonarReading === 0
      ? 'CLEAR'
      : `${sonarReading} MINE${sonarReading > 1 ? 'S' : ''}`;

  return (
    <div
      className="flex items-center justify-between px-3 py-2 shrink-0 gap-2"
      style={{
        background: 'rgba(13, 33, 55, 0.95)',
        borderBottom: '1px solid rgba(240, 165, 0, 0.3)',
        fontFamily: 'var(--font-mono)',
        fontSize: 14,
      }}
    >
      {/* Back + Mute + Timer */}
      <div className="flex items-center gap-2">
        <button
          onClick={onLevelSelect}
          className="cursor-pointer"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            padding: '4px 8px',
            background: 'rgba(240, 165, 0, 0.1)',
            color: 'var(--color-ui-accent)',
            border: '1px solid rgba(240, 165, 0, 0.2)',
            borderRadius: 3,
          }}
          title="Back to missions"
        >
          &#9776;
        </button>
        <button
          onClick={onToggleMute}
          className="cursor-pointer"
          style={{
            fontSize: 14,
            padding: '4px 6px',
            background: 'rgba(240, 165, 0, 0.1)',
            color: muted ? 'rgba(232,244,248,0.3)' : 'var(--color-ui-accent)',
            border: '1px solid rgba(240, 165, 0, 0.2)',
            borderRadius: 3,
            lineHeight: 1,
          }}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? '\u{1F507}' : '\u{1F50A}'}
        </button>
        <button
          onClick={onHelp}
          className="cursor-pointer"
          style={{
            fontSize: 13,
            padding: '4px 7px',
            background: 'rgba(240, 165, 0, 0.1)',
            color: 'var(--color-ui-accent)',
            border: '1px solid rgba(240, 165, 0, 0.2)',
            borderRadius: 3,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            lineHeight: 1,
          }}
          title="How to play"
        >
          ?
        </button>
        <div className="flex items-center gap-1">
          <span style={{ color: 'var(--color-ui-accent)', fontSize: 14 }}>&#9201;</span>
          <span
            style={{
              color:
                gameState === GAME_STATE.WON
                  ? '#00cc88'
                  : (gameState === GAME_STATE.DEAD || gameState === GAME_STATE.DYING)
                  ? '#ff0000'
                  : 'var(--color-ui-text)',
              minWidth: 70,
              fontSize: 13,
            }}
          >
            {formatTime(elapsedMs)}
          </span>
        </div>
      </div>

      {/* Score + Level name */}
      <div className="flex flex-col items-center" style={{ minWidth: 100 }}>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 22,
            fontWeight: 900,
            color: flashColor || 'var(--color-ui-text)',
            textShadow: flashColor
              ? `0 0 12px ${flashColor}, 0 0 4px ${flashColor}`
              : '0 0 6px rgba(232,244,248,0.2)',
            letterSpacing: 1,
            lineHeight: 1,
            transition: 'color 0.1s ease',
          }}
        >
          {formattedScore}
        </div>
        <div
          className="truncate"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 11,
            color: 'var(--color-ui-accent)',
            letterSpacing: 0.5,
            opacity: 0.7,
            lineHeight: 1.3,
          }}
        >
          {levelName}
        </div>
      </div>

      {/* Intercept + Sonar reading */}
      <div className="flex items-center gap-2 relative">
        <span
          style={{
            fontSize: 13,
            color: interceptsLeft > 0 ? 'var(--color-ui-accent)' : 'var(--color-ui-text)',
            opacity: interceptsLeft > 0 ? 1 : 0.3,
            transition: 'all 0.2s',
          }}
          title={interceptsLeft > 0 ? 'Press SPACE to intercept a drone' : 'Intercept used'}
        >
          🎯 {interceptsLeft}
        </span>
        {interceptMessage && (
          <span
            style={{
              fontSize: 11,
              color: '#ff5500',
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            {interceptMessage}
          </span>
        )}
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>|</span>
        <span style={{ fontSize: 13, color: 'var(--color-ui-text)', opacity: 0.6 }}>SONAR:</span>
        <span
          style={{
            color: sonarColor,
            fontWeight: 700,
            textShadow: `0 0 8px ${sonarColor}`,
            fontSize: 13,
          }}
        >
          {sonarReading === 0 && gameState === GAME_STATE.READY ? '\u2014' : sonarLabel}
        </span>

        {/* Sonar tooltip — shows on first move, fades out */}
        {showSonarTooltip && (
          <div
            className="absolute right-0 top-full mt-2 whitespace-nowrap z-50"
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 12,
              color: 'var(--color-ui-text)',
              background: 'rgba(240, 165, 0, 0.15)',
              border: '1px solid rgba(240, 165, 0, 0.35)',
              borderRadius: 4,
              padding: '6px 10px',
              animation: 'sonar-tooltip-fade 4s ease-in-out forwards',
            }}
          >
            This number = mines within 2 tiles of you
            <div
              style={{
                position: 'absolute',
                top: -5,
                right: 16,
                width: 8,
                height: 8,
                background: 'rgba(240, 165, 0, 0.15)',
                border: '1px solid rgba(240, 165, 0, 0.35)',
                borderRight: 'none',
                borderBottom: 'none',
                transform: 'rotate(45deg)',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
