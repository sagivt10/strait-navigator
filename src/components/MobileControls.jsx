import { useState, useEffect } from 'react';

export default function MobileControls({ onMove, onRestart, onIntercept, interceptsLeft }) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [hudBottom, setHudBottom] = useState(60);

  useEffect(() => {
    const update = () => {
      setIsMobile(window.innerWidth < 768);
      const hud = document.getElementById('game-hud');
      if (hud) setHudBottom(hud.getBoundingClientRect().bottom);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const btnStyle = {
    width: 48,
    height: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(240, 165, 0, 0.15)',
    border: '1px solid rgba(240, 165, 0, 0.3)',
    borderRadius: 6,
    color: 'var(--color-ui-accent)',
    fontSize: 20,
    cursor: 'pointer',
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
  };

  if (!isMobile) {
    // Desktop: original bar layout
    return (
      <div
        id="mobile-controls"
        className="mobile-controls flex items-center justify-between px-4 py-2 shrink-0"
        style={{
          background: 'rgba(13, 33, 55, 0.95)',
          borderTop: '1px solid rgba(240, 165, 0, 0.3)',
        }}
      >
        <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(3, 48px)', gridTemplateRows: 'repeat(3, 48px)' }}>
          <div />
          <button style={btnStyle} onClick={() => onMove('up')}>&#9650;</button>
          <div />
          <button style={btnStyle} onClick={() => onMove('left')}>&#9664;</button>
          <button
            style={{
              ...btnStyle,
              fontSize: 22,
              opacity: interceptsLeft > 0 ? 1 : 0.3,
            }}
            onClick={onIntercept}
            disabled={interceptsLeft <= 0}
          >
            🎯
          </button>
          <button style={btnStyle} onClick={() => onMove('right')}>&#9654;</button>
          <div />
          <button style={btnStyle} onClick={() => onMove('down')}>&#9660;</button>
          <div />
        </div>

        <button
          onClick={onRestart}
          style={{
            ...btnStyle,
            width: 'auto',
            padding: '8px 16px',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            gap: 6,
          }}
        >
          &#8634; RESTART
        </button>
      </div>
    );
  }

  // Mobile: floating overlay controls
  const floatingBtn = {
    ...btnStyle,
    background: 'rgba(13, 33, 55, 0.7)',
    border: '1px solid rgba(240, 165, 0, 0.35)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  };

  return (
    <div
      id="mobile-controls"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 20,
      }}
    >
      {/* D-pad — bottom-left */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          pointerEvents: 'auto',
        }}
      >
        <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(3, 48px)', gridTemplateRows: 'repeat(3, 48px)' }}>
          <div />
          <button style={floatingBtn} onClick={() => onMove('up')}>&#9650;</button>
          <div />
          <button style={floatingBtn} onClick={() => onMove('left')}>&#9664;</button>
          <div />
          <button style={floatingBtn} onClick={() => onMove('right')}>&#9654;</button>
          <div />
          <button style={floatingBtn} onClick={() => onMove('down')}>&#9660;</button>
          <div />
        </div>
      </div>

      {/* Intercept — bottom-right */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          pointerEvents: 'auto',
        }}
      >
        <button
          style={{
            ...floatingBtn,
            width: 56,
            height: 56,
            fontSize: 26,
            borderRadius: 28,
            opacity: interceptsLeft > 0 ? 1 : 0.3,
          }}
          onClick={onIntercept}
          disabled={interceptsLeft <= 0}
        >
          🎯
        </button>
        <div
          style={{
            textAlign: 'center',
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--color-ui-accent)',
            marginTop: 2,
            opacity: interceptsLeft > 0 ? 0.8 : 0.3,
          }}
        >
          ×{interceptsLeft}
        </div>
      </div>

      {/* Restart — top-right, below HUD */}
      <div
        style={{
          position: 'absolute',
          top: hudBottom + 8,
          right: 16,
          pointerEvents: 'auto',
        }}
      >
        <button
          onClick={onRestart}
          style={{
            ...floatingBtn,
            width: 'auto',
            padding: '8px 12px',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            gap: 4,
          }}
        >
          &#8634; RESTART
        </button>
      </div>
    </div>
  );
}
