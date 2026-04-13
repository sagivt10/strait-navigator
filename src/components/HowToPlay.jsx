export default function HowToPlay({ onDismiss }) {
  // Build 5x5 grid showing Manhattan distance <= 2 from center (2,2)
  const gridSize = 5;
  const center = 2;
  const inRange = (r, c) => Math.abs(r - center) + Math.abs(c - center) <= 2 && !(r === center && c === center);

  const colorLegend = [
    { color: '#1a6b5a', label: 'No mines in range' },
    { color: '#f0a500', label: '1 mine in range' },
    { color: '#ff9800', label: '2 mines in range' },
    { color: '#f44336', label: '3+ mines in range' },
  ];

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[100]"
      style={{ background: 'rgba(13, 33, 55, 0.92)' }}
    >
      <div
        className="text-center px-6 py-8 rounded-lg max-w-sm w-full mx-4"
        style={{
          background: 'rgba(26, 74, 107, 0.5)',
          border: '1px solid rgba(240, 165, 0, 0.3)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            color: 'var(--color-ui-accent)',
            marginBottom: 20,
          }}
        >
          HOW TO PLAY
        </div>

        <div className="flex flex-col gap-4 text-left mb-6">
          {/* Ship */}
          <div className="flex items-center gap-3">
            <svg width="32" height="32" viewBox="0 0 30 30" className="shrink-0">
              <path d="M15 3 L20 10 L20 24 L18 27 L12 27 L10 24 L10 10 Z" fill="white" stroke="#1a4a6b" strokeWidth="1.5" />
            </svg>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--color-ui-text)' }}>
              This is your tanker. Move with <b style={{ color: 'var(--color-ui-accent)' }}>WASD</b> or <b style={{ color: 'var(--color-ui-accent)' }}>arrow keys</b>.
            </span>
          </div>

          {/* Port */}
          <div className="flex items-center gap-3">
            <svg width="32" height="32" viewBox="0 0 28 28" className="shrink-0">
              <circle cx="14" cy="14" r="13" fill="none" stroke="#00cc88" strokeWidth="1.5" opacity="0.6" />
              <circle cx="14" cy="8" r="2.5" fill="none" stroke="#00cc88" strokeWidth="1.5" />
              <line x1="14" y1="10.5" x2="14" y2="22" stroke="#00cc88" strokeWidth="1.5" />
              <line x1="9" y1="17" x2="14" y2="22" stroke="#00cc88" strokeWidth="1.5" />
              <line x1="19" y1="17" x2="14" y2="22" stroke="#00cc88" strokeWidth="1.5" />
            </svg>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--color-ui-text)' }}>
              Reach the <b style={{ color: '#00cc88' }}>anchor</b> to complete the level.
            </span>
          </div>

          {/* Mine */}
          <div className="flex items-center gap-3">
            <svg width="32" height="32" viewBox="0 0 24 24" className="shrink-0">
              <circle cx="12" cy="12" r="8" fill="#ff0000" stroke="#cc0000" strokeWidth="1.5" />
              <line x1="12" y1="2" x2="12" y2="6" stroke="#cc0000" strokeWidth="2" />
              <line x1="12" y1="18" x2="12" y2="22" stroke="#cc0000" strokeWidth="2" />
              <line x1="2" y1="12" x2="6" y2="12" stroke="#cc0000" strokeWidth="2" />
              <line x1="18" y1="12" x2="22" y2="12" stroke="#cc0000" strokeWidth="2" />
            </svg>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--color-ui-text)' }}>
              Hidden <b style={{ color: '#ff0000' }}>mines</b> = instant death. Use sonar to avoid them.
            </span>
          </div>

          {/* Sonar range diagram */}
          <div style={{ marginTop: 4 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ui-accent)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
              Sonar Range
            </div>
            <div className="flex justify-center mb-2">
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridSize}, 28px)`, gap: 2 }}>
                {Array.from({ length: gridSize * gridSize }, (_, i) => {
                  const r = Math.floor(i / gridSize);
                  const c = i % gridSize;
                  const isCenter = r === center && c === center;
                  const isInRange = inRange(r, c);
                  return (
                    <div
                      key={i}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 3,
                        background: isCenter ? 'rgba(255,255,255,0.9)' : isInRange ? 'rgba(0, 204, 136, 0.35)' : 'rgba(13, 33, 55, 0.6)',
                        border: isCenter ? '2px solid white' : isInRange ? '1px solid rgba(0, 204, 136, 0.5)' : '1px solid rgba(26, 74, 107, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {isCenter && (
                        <svg width="16" height="16" viewBox="0 0 30 30">
                          <path d="M15 3 L20 10 L20 24 L18 27 L12 27 L10 24 L10 10 Z" fill="#0d2137" stroke="#1a4a6b" strokeWidth="1.5" />
                        </svg>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-ui-text)', opacity: 0.7, textAlign: 'center', marginBottom: 8 }}>
              Sonar detects mines within 2 tiles of your ship
            </div>
          </div>

          {/* Color legend */}
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--color-ui-accent)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
              Tile Colors
            </div>
            <div className="flex flex-col gap-2">
              {colorLegend.map(({ color, label }) => (
                <div key={color} className="flex items-center gap-3">
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 3,
                      background: color,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-ui-text)' }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={onDismiss}
          className="cursor-pointer"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 16,
            padding: '12px 40px',
            background: 'var(--color-ui-accent)',
            color: 'var(--color-ui-bg)',
            border: 'none',
            borderRadius: 4,
            fontWeight: 700,
            letterSpacing: 1,
          }}
        >
          GOT IT
        </button>
      </div>
    </div>
  );
}
