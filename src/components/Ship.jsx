export default function Ship({ col, row, angle, tileSize }) {
  const svgSize = Math.max(16, Math.round(tileSize * 0.75));

  return (
    <div
      className="ship-move pointer-events-none absolute"
      style={{
        left: col * tileSize,
        top: row * tileSize,
        width: tileSize,
        height: tileSize,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
      }}
    >
      <svg
        width={svgSize}
        height={svgSize}
        viewBox="0 0 30 30"
        style={{
          transform: `rotate(${angle}deg)`,
          transition: 'transform 150ms ease',
          filter: 'drop-shadow(1px 2px 2px rgba(0,0,0,0.4))',
        }}
      >
        <path
          d="M15 3 L20 10 L20 24 L18 27 L12 27 L10 24 L10 10 Z"
          fill="white"
          stroke="#1a4a6b"
          strokeWidth="1.5"
        />
        <rect x="12" y="8" width="6" height="4" rx="1" fill="#e8f4f8" stroke="#1a4a6b" strokeWidth="0.5" />
        <line x1="13" y1="15" x2="17" y2="15" stroke="#1a4a6b" strokeWidth="0.5" />
        <line x1="13" y1="18" x2="17" y2="18" stroke="#1a4a6b" strokeWidth="0.5" />
        <line x1="13" y1="21" x2="17" y2="21" stroke="#1a4a6b" strokeWidth="0.5" />
      </svg>
    </div>
  );
}
