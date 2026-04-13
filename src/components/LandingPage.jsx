export default function LandingPage({ onStart, onDaily }) {
  return (
    <div
      className="flex flex-col items-center justify-center h-full relative overflow-hidden"
      style={{ background: 'var(--color-ui-bg)' }}
    >
      {/* Animated ocean waves background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute w-full"
          style={{
            bottom: 0,
            height: '60%',
            background: 'linear-gradient(180deg, transparent 0%, var(--color-ocean-deep) 30%, var(--color-ocean-shallow) 100%)',
          }}
        />
        {/* Wave layers */}
        {[0, 1, 2].map((i) => (
          <svg
            key={i}
            className="absolute w-full"
            style={{
              bottom: `${10 + i * 8}%`,
              opacity: 0.15 + i * 0.1,
              animation: `wave-drift ${6 + i * 2}s ease-in-out infinite alternate`,
            }}
            viewBox="0 0 1200 80"
            preserveAspectRatio="none"
          >
            <path
              d={`M0,40 C200,${20 + i * 10} 400,${60 - i * 10} 600,40 C800,${20 + i * 10} 1000,${60 - i * 10} 1200,40 L1200,80 L0,80 Z`}
              fill="var(--color-ocean-shallow)"
            />
          </svg>
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-4">
        {/* Ship icon */}
        <div className="mb-4" style={{ fontSize: 48 }}>
          <svg width="80" height="80" viewBox="0 0 80 80" className="mx-auto" style={{ filter: 'drop-shadow(0 0 20px rgba(240,165,0,0.3))' }}>
            <circle cx="40" cy="40" r="36" fill="none" stroke="var(--color-ui-accent)" strokeWidth="1.5" opacity="0.4" />
            <path d="M40 14 L52 28 L52 58 L48 66 L32 66 L28 58 L28 28 Z" fill="white" stroke="var(--color-ocean-deep)" strokeWidth="1.5" />
            <rect x="34" y="24" width="12" height="8" rx="2" fill="var(--color-ui-text)" stroke="var(--color-ocean-deep)" strokeWidth="0.5" />
            <line x1="35" y1="38" x2="45" y2="38" stroke="var(--color-ocean-deep)" strokeWidth="0.8" />
            <line x1="35" y1="44" x2="45" y2="44" stroke="var(--color-ocean-deep)" strokeWidth="0.8" />
            <line x1="35" y1="50" x2="45" y2="50" stroke="var(--color-ocean-deep)" strokeWidth="0.8" />
          </svg>
        </div>

        {/* Title */}
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(36px, 8vw, 64px)',
            color: 'var(--color-ui-accent)',
            marginBottom: 8,
            letterSpacing: 2,
            textShadow: '0 0 30px rgba(240, 165, 0, 0.3)',
            lineHeight: 1.1,
          }}
        >
          STRAIT NAVIGATOR
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'clamp(14px, 3vw, 18px)',
            color: 'var(--color-ui-text)',
            opacity: 0.7,
            marginBottom: 40,
            fontStyle: 'italic',
          }}
        >
          Navigate the world's most dangerous waters
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onStart}
            className="cursor-pointer"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 18,
              padding: '16px 48px',
              background: 'var(--color-ui-accent)',
              color: 'var(--color-ui-bg)',
              border: 'none',
              borderRadius: 4,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: 'uppercase',
              boxShadow: '0 0 30px rgba(240, 165, 0, 0.3)',
              transition: 'transform 0.2s, box-shadow 0.2s',
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.05)';
              e.target.style.boxShadow = '0 0 40px rgba(240, 165, 0, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1)';
              e.target.style.boxShadow = '0 0 30px rgba(240, 165, 0, 0.3)';
            }}
          >
            Begin Mission
          </button>

          <button
            onClick={onDaily}
            className="cursor-pointer"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 15,
              padding: '12px 36px',
              background: 'rgba(0, 204, 136, 0.12)',
              color: '#00cc88',
              border: '1px solid rgba(0, 204, 136, 0.35)',
              borderRadius: 4,
              fontWeight: 700,
              letterSpacing: 1,
              transition: 'transform 0.2s, background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.03)';
              e.target.style.background = 'rgba(0, 204, 136, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1)';
              e.target.style.background = 'rgba(0, 204, 136, 0.12)';
            }}
          >
            {'\u{1F5D3}\uFE0F'} DAILY CHALLENGE
          </button>
        </div>
      </div>

      {/* Footer branding */}
      <div
        className="absolute bottom-4 text-center"
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 12,
          color: 'var(--color-ui-text)',
          opacity: 0.35,
        }}
      >
        Built by S-Tech Solutions
      </div>

      <style>{`
        @keyframes wave-drift {
          0% { transform: translateX(-20px); }
          100% { transform: translateX(20px); }
        }
      `}</style>
    </div>
  );
}
