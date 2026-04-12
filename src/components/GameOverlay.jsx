import { useState } from 'react';
import { formatTime } from '../game/engine';

export function DeathOverlay({ attempts, onRestart, onLevelSelect }) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(13, 33, 55, 0.85)' }}
    >
      <div className="text-center">
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 48,
            color: '#ff0000',
            marginBottom: 8,
            textShadow: '0 0 20px rgba(255,0,0,0.5)',
          }}
        >
          MINE STRUCK
        </div>
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
  attempts,
  isNewBest,
  globalRank,
  onRestart,
  onNextLevel,
  onLevelSelect,
  onLeaderboard,
  hasNextLevel,
}) {
  const [copied, setCopied] = useState(false);

  const timeStr = formatTime(elapsedMs);
  const shareText = `I navigated the ${levelName} in ${timeStr} without hitting a mine \u{1F6A2}\u{1F4A5} Can you beat it? straitnavigator.com`;

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
    <div
      className="absolute inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(13, 33, 55, 0.85)' }}
    >
      <div className="text-center px-4">
        <div style={{ fontSize: 40, marginBottom: 4 }}>&#9875;</div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 42,
            color: '#00cc88',
            marginBottom: 8,
            textShadow: '0 0 20px rgba(0,204,136,0.4)',
          }}
        >
          PORT REACHED
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 20,
            color: 'var(--color-ui-accent)',
            marginBottom: 16,
          }}
        >
          {levelName}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 28,
            color: 'var(--color-ui-text)',
            marginBottom: 4,
          }}
        >
          {timeStr}
        </div>

        {/* Global rank */}
        {globalRank && (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              color: globalRank <= 3 ? 'var(--color-ui-accent)' : '#00cc88',
              marginBottom: 4,
            }}
          >
            Global rank: #{globalRank}
          </div>
        )}

        {isNewBest && (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: 'var(--color-ui-accent)',
              marginBottom: 4,
            }}
          >
            NEW BEST TIME!
          </div>
        )}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            color: 'var(--color-ui-text)',
            opacity: 0.5,
            marginBottom: 20,
          }}
        >
          {attempts > 1 ? `Completed in ${attempts} attempts` : 'First try!'}
        </div>

        {/* Share button */}
        <button
          onClick={handleShare}
          className="cursor-pointer mb-3 block mx-auto"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            padding: '10px 24px',
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
        <div className="flex items-center gap-3 justify-center flex-wrap mt-3">
          {hasNextLevel && (
            <button
              onClick={onNextLevel}
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
              NEXT LEVEL &#10132;
            </button>
          )}
          <button
            onClick={onLeaderboard}
            className="cursor-pointer"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              padding: '12px 20px',
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
              fontSize: 14,
              padding: '12px 20px',
              background: 'transparent',
              color: 'var(--color-ui-text)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 4,
              opacity: 0.7,
            }}
          >
            REPLAY [R]
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
