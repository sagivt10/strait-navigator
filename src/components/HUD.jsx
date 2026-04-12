import { formatTime, getSonarColor } from '../game/engine';

export default function HUD({ levelName, elapsedMs, sonarReading, gameState, GAME_STATE, onLevelSelect }) {
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
      {/* Back + Timer */}
      <div className="flex items-center gap-3">
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
        <div className="flex items-center gap-1">
          <span style={{ color: 'var(--color-ui-accent)', fontSize: 14 }}>&#9201;</span>
          <span
            style={{
              color:
                gameState === GAME_STATE.WON
                  ? '#00cc88'
                  : gameState === GAME_STATE.DEAD
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

      {/* Level name */}
      <div
        className="truncate"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 16,
          color: 'var(--color-ui-accent)',
          letterSpacing: 1,
          textAlign: 'center',
        }}
      >
        {levelName}
      </div>

      {/* Sonar reading */}
      <div className="flex items-center gap-1">
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
      </div>
    </div>
  );
}
