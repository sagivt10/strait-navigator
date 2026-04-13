import { useState } from 'react';
import { formatTime } from '../game/engine';

export function DeathOverlay({ attempts, deathCause, onRestart, onLevelSelect }) {
  const isDrone = deathCause === 'drone';

  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-50"
      style={{
        background: 'rgba(13, 33, 55, 0.85)',
        animation: 'death-overlay-fade-in 400ms ease-out forwards',
      }}
    >
      <div className="text-center">
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: isDrone ? 36 : 48,
            color: isDrone ? '#ff5500' : '#ff0000',
            marginBottom: 4,
            textShadow: `0 0 20px ${isDrone ? 'rgba(255,85,0,0.5)' : 'rgba(255,0,0,0.5)'}`,
          }}
        >
          {isDrone ? 'DRONE STRIKE' : 'MINE STRUCK'}
        </div>
        {isDrone && (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              color: 'var(--color-ui-text)',
              marginBottom: 8,
              opacity: 0.8,
              maxWidth: 260,
              margin: '0 auto 8px',
              letterSpacing: 1,
            }}
          >
            DIRECT HIT
          </div>
        )}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 16,
            color: 'var(--color-ui-text)',
            marginBottom: 24,
            opacity: 0.7,
          }}
        >
          Attempt #{attempts}
        </div>
        <div className="flex items-center gap-3 justify-center">
          <button
            onClick={onRestart}
            className="cursor-pointer"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 16,
              padding: '12px 32px',
              background: 'var(--color-ui-accent)',
              color: 'var(--color-ui-bg)',
              border: 'none',
              borderRadius: 4,
              fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            RETRY [R]
          </button>
          <button
            onClick={onLevelSelect}
            className="cursor-pointer"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              padding: '12px 20px',
              background: 'transparent',
              color: 'var(--color-ui-text)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 4,
              opacity: 0.7,
            }}
          >
            MISSIONS
          </button>
        </div>
      </div>
    </div>
  );
}

export function WinOverlay({
  levelName,
  elapsedMs,
  score,
  timePenalty,
  deathPenalty,
  interceptBonuses,
  attempts,
  deaths,
  isNewBest,
  globalRank,
  onRestart,
  onNextLevel,
  onLeaderboard,
  hasNextLevel,
}) {
  const [copied, setCopied] = useState(false);

  const timeStr = formatTime(elapsedMs);
  const shareText = `I scored ${score.toLocaleString()} on ${levelName} (${timeStr}, ${deaths} deaths) \u{1F6A2}\u{1F4A5} Can you beat it? straitnavigator.com`;

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

  const isSmall = typeof window !== 'undefined' && window.innerWidth < 430;
  const s = (size) => isSmall ? Math.round(size * 0.8) : size;

  return (
    <div
      className="fixed inset-0 z-50"
      style={{
        background: 'rgba(13, 33, 55, 0.85)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflowY: 'auto',
        maxHeight: '100dvh',
        padding: 16,
      }}
    >
      <div className="text-center" style={{ width: '100%', maxWidth: 360 }}>
        <div style={{ fontSize: s(32), marginBottom: 2 }}>&#9875;</div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: s(36),
            color: '#00cc88',
            marginBottom: 4,
            textShadow: '0 0 20px rgba(0,204,136,0.4)',
          }}
        >
          PORT REACHED
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: s(18),
            color: 'var(--color-ui-accent)',
            marginBottom: isSmall ? 6 : 10,
          }}
        >
          {levelName}
        </div>
        {/* Score breakdown */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: s(13),
            color: 'var(--color-ui-text)',
            marginBottom: 6,
            lineHeight: 1.7,
            opacity: 0.7,
          }}
        >
          <div>Base: <span style={{ color: 'var(--color-ui-text)' }}>10,000</span></div>
          <div>Time penalty: <span style={{ color: '#ff6b35' }}>-{timePenalty.toLocaleString()}</span></div>
          {deaths > 0 && (
            <div>Deaths: <span style={{ color: '#ff0000' }}>{deaths} &times; -500 = -{deathPenalty.toLocaleString()}</span></div>
          )}
          {interceptBonuses > 0 && (
            <div>Intercept: <span style={{ color: '#00cc88' }}>+{interceptBonuses.toLocaleString()}</span></div>
          )}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: s(32),
            color: 'var(--color-ui-accent)',
            marginBottom: 2,
            fontWeight: 700,
          }}
        >
          ${score.toLocaleString()}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: s(11),
            color: 'var(--color-ui-text)',
            opacity: 0.4,
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 4,
          }}
        >
          FINAL SCORE
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: s(14),
            color: 'var(--color-ui-text)',
            marginBottom: 2,
            opacity: 0.6,
          }}
        >
          {timeStr} &middot; {deaths === 0 ? 'No deaths' : `${deaths} death${deaths > 1 ? 's' : ''}`}
        </div>

        {/* Global rank */}
        {globalRank && (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: s(14),
              color: globalRank <= 3 ? 'var(--color-ui-accent)' : '#00cc88',
              marginBottom: 3,
            }}
          >
            Global rank: #{globalRank}
          </div>
        )}

        {isNewBest && (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: s(13),
              color: 'var(--color-ui-accent)',
              marginBottom: 3,
            }}
          >
            NEW BEST SCORE!
          </div>
        )}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: s(14),
            color: 'var(--color-ui-text)',
            opacity: 0.5,
            marginBottom: isSmall ? 8 : 12,
          }}
        >
          {attempts > 1 ? `Completed in ${attempts} attempts` : 'First try!'}
        </div>

        {/* Share button */}
        <button
          onClick={handleShare}
          className="cursor-pointer mb-2 block mx-auto"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: s(13),
            padding: isSmall ? '6px 16px' : '8px 20px',
            background: copied ? 'rgba(0,204,136,0.2)' : 'rgba(240,165,0,0.15)',
            color: copied ? '#00cc88' : 'var(--color-ui-accent)',
            border: `1px solid ${copied ? 'rgba(0,204,136,0.4)' : 'rgba(240,165,0,0.3)'}`,
            borderRadius: 4,
            transition: 'all 0.2s',
          }}
        >
          {copied ? 'COPIED!' : 'SHARE RESULT'}
        </button>

        {/* Action buttons */}
        <div className="flex items-center gap-2 justify-center flex-wrap mt-2">
          {hasNextLevel && (
            <button
              onClick={onNextLevel}
              className="cursor-pointer"
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: s(15),
                padding: isSmall ? '8px 22px' : '10px 28px',
                background: 'var(--color-ui-accent)',
                color: 'var(--color-ui-bg)',
                border: 'none',
                borderRadius: 4,
                fontWeight: 700,
                letterSpacing: 1,
              }}
            >
              NEXT LEVEL &#10132;
            </button>
          )}
          <button
            onClick={onLeaderboard}
            className="cursor-pointer"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: s(13),
              padding: isSmall ? '8px 12px' : '10px 16px',
              background: 'rgba(240,165,0,0.1)',
              color: 'var(--color-ui-accent)',
              border: '1px solid rgba(240,165,0,0.25)',
              borderRadius: 4,
            }}
          >
            LEADERBOARD
          </button>
          <button
            onClick={onRestart}
            className="cursor-pointer"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: s(13),
              padding: isSmall ? '8px 12px' : '10px 16px',
              background: 'transparent',
              color: 'var(--color-ui-text)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 4,
              opacity: 0.7,
            }}
          >
            REPLAY [R]
          </button>
        </div>
      </div>
    </div>
  );
}
