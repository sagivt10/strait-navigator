export default function PortIcon({ size = 28 }) {
  return (
    <div
      className="absolute"
      style={{
        animation: 'pulse 2s ease-in-out infinite',
        zIndex: 3,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 28 28">
        <circle cx="14" cy="14" r="13" fill="none" stroke="#00cc88" strokeWidth="1.5" opacity="0.6" />
        <circle cx="14" cy="8" r="2.5" fill="none" stroke="#00cc88" strokeWidth="1.5" />
        <line x1="14" y1="10.5" x2="14" y2="22" stroke="#00cc88" strokeWidth="1.5" />
        <line x1="9" y1="17" x2="14" y2="22" stroke="#00cc88" strokeWidth="1.5" />
        <line x1="19" y1="17" x2="14" y2="22" stroke="#00cc88" strokeWidth="1.5" />
        <line x1="10" y1="14" x2="18" y2="14" stroke="#00cc88" strokeWidth="1.5" />
      </svg>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}
