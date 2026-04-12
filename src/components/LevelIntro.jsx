import { useState, useEffect } from 'react';

export default function LevelIntro({ levelMeta, onComplete }) {
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (countdown <= 0) {
      onComplete();
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, onComplete]);

  return (
    <div
      className="flex flex-col items-center justify-center h-full relative"
      style={{ background: 'var(--color-ui-bg)' }}
    >
      {/* Subtle radial glow */}
      <div
        className="absolute"
        style={{
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(240,165,0,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div className="relative z-10 text-center px-4">
        {/* Level number */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            color: 'var(--color-ui-accent)',
            opacity: 0.7,
            marginBottom: 8,
            letterSpacing: 3,
          }}
        >
          LEVEL {levelMeta.id}
        </div>

        {/* Level name */}
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(32px, 7vw, 52px)',
            color: 'var(--color-ui-accent)',
            margin: '0 0 12px',
            letterSpacing: 1,
            textShadow: '0 0 20px rgba(240,165,0,0.3)',
          }}
        >
          {levelMeta.name}
        </h1>

        {/* Flags: origin → destination */}
        <div
          className="flex items-center justify-center gap-4 mb-6"
          style={{ fontSize: 36 }}
        >
          <span>{levelMeta.originFlag}</span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 16,
              color: 'var(--color-ui-text)',
              opacity: 0.5,
            }}
          >
            &#10132;
          </span>
          <span>{levelMeta.destFlag}</span>
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 16,
            color: 'var(--color-ui-text)',
            opacity: 0.6,
            marginBottom: 24,
          }}
        >
          {levelMeta.subtitle}
        </div>

        {/* Distance */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 15,
            color: 'var(--color-ui-text)',
            opacity: 0.5,
            marginBottom: 40,
          }}
        >
          Distance: {levelMeta.distance} nautical miles
        </div>

        {/* Countdown */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 48,
            color: 'var(--color-ui-accent)',
            textShadow: '0 0 20px rgba(240,165,0,0.4)',
            transition: 'transform 0.3s',
            transform: `scale(${1 + (countdown % 1 === 0 ? 0 : 0)})`,
          }}
        >
          {countdown > 0 ? countdown : 'GO'}
        </div>

        {/* Info bar */}
        <div
          className="flex items-center justify-center gap-6 mt-8"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--color-ui-text)',
            opacity: 0.3,
          }}
        >
          <span>{levelMeta.cols}x{levelMeta.rows} grid</span>
          <span>|</span>
          <span>{levelMeta.mineCount} mines</span>
          <span>|</span>
          <span>{'★'.repeat(levelMeta.difficulty)}</span>
        </div>
      </div>
    </div>
  );
}
