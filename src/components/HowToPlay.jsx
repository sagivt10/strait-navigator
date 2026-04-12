export default function HowToPlay({ onDismiss }) {
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

          {/* Sonar */}
          <div className="flex items-center gap-3">
            <div
              className="shrink-0 flex items-center justify-center"
              style={{
                width: 32,
                height: 32,
                fontFamily: 'var(--font-mono)',
                fontSize: 20,
                fontWeight: 700,
                color: '#f0a500',
                textShadow: '0 0 6px rgba(240,165,0,0.5)',
              }}
            >
              3
            </div>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--color-ui-text)' }}>
              Sonar shows <b style={{ color: '#f0a500' }}>mines within 2 tiles</b> of you.
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
