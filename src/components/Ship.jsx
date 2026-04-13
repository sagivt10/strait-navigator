export default function Ship({ col, row, angle, tileSize, originFlag }) {
  const svgSize = Math.max(18, Math.round(tileSize * 0.82));
  const flagSize = Math.max(6, Math.round(tileSize * 0.22));

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
      <div
        style={{
          position: 'relative',
          width: svgSize,
          height: svgSize,
          transform: `rotate(${angle}deg)`,
          transition: 'transform 150ms ease',
          filter: 'drop-shadow(1px 2px 3px rgba(0,0,0,0.5))',
        }}
      >
        <svg
          width={svgSize}
          height={svgSize}
          viewBox="0 0 40 40"
        >
          {/* Hull — steel gray with pointed bow */}
          <path
            d="M20 2 L26 8 L27 12 L27 34 L25 37 L15 37 L13 34 L13 12 L14 8 Z"
            fill="#8a9bae"
            stroke="#4a5568"
            strokeWidth="1"
          />
          {/* Hull inner edge / gunwale */}
          <path
            d="M20 4 L24.5 9 L25.5 12 L25.5 33 L24 35.5 L16 35.5 L14.5 33 L14.5 12 L15.5 9 Z"
            fill="#9aacbe"
            stroke="none"
          />

          {/* Bow deck detail */}
          <path
            d="M20 5 L23 9 L17 9 Z"
            fill="#b0bec5"
            stroke="#4a5568"
            strokeWidth="0.4"
          />

          {/* Container rows — stacked colored rectangles */}
          {/* Row 1 (front) */}
          <rect x="15.5" y="10" width="4" height="3" rx="0.3" fill="#e53e3e" stroke="#c53030" strokeWidth="0.4" />
          <rect x="20.5" y="10" width="4" height="3" rx="0.3" fill="#3182ce" stroke="#2b6cb0" strokeWidth="0.4" />

          {/* Row 2 */}
          <rect x="15.5" y="13.5" width="4" height="3" rx="0.3" fill="#38a169" stroke="#2f855a" strokeWidth="0.4" />
          <rect x="20.5" y="13.5" width="4" height="3" rx="0.3" fill="#d69e2e" stroke="#b7791f" strokeWidth="0.4" />

          {/* Row 3 */}
          <rect x="15.5" y="17" width="4" height="3" rx="0.3" fill="#3182ce" stroke="#2b6cb0" strokeWidth="0.4" />
          <rect x="20.5" y="17" width="4" height="3" rx="0.3" fill="#e53e3e" stroke="#c53030" strokeWidth="0.4" />

          {/* Row 4 */}
          <rect x="15.5" y="20.5" width="4" height="3" rx="0.3" fill="#d69e2e" stroke="#b7791f" strokeWidth="0.4" />
          <rect x="20.5" y="20.5" width="4" height="3" rx="0.3" fill="#38a169" stroke="#2f855a" strokeWidth="0.4" />

          {/* Row 5 (rear containers) */}
          <rect x="15.5" y="24" width="4" height="3" rx="0.3" fill="#e53e3e" stroke="#c53030" strokeWidth="0.4" />
          <rect x="20.5" y="24" width="4" height="3" rx="0.3" fill="#805ad5" stroke="#6b46c1" strokeWidth="0.4" />

          {/* Bridge / wheelhouse at stern */}
          <rect x="16" y="28" width="8" height="5" rx="1" fill="#d4dae0" stroke="#4a5568" strokeWidth="0.6" />
          {/* Bridge windows */}
          <rect x="17" y="29" width="2.5" height="1.5" rx="0.3" fill="#1a365d" stroke="#2d3748" strokeWidth="0.3" />
          <rect x="20.5" y="29" width="2.5" height="1.5" rx="0.3" fill="#1a365d" stroke="#2d3748" strokeWidth="0.3" />
          {/* Bridge roof detail */}
          <rect x="18" y="31" width="4" height="1" rx="0.3" fill="#a0aec0" stroke="#4a5568" strokeWidth="0.3" />

          {/* Flagpole on bridge */}
          <line x1="20" y1="28" x2="20" y2="34.5" stroke="#4a5568" strokeWidth="0.5" />
          {/* Small flag shape */}
          <rect x="20.3" y="33" width="2.5" height="1.5" rx="0.2" fill="#e53e3e" stroke="none" opacity="0.8" />

          {/* Crane/mast at center */}
          <line x1="20" y1="8" x2="20" y2="10" stroke="#4a5568" strokeWidth="0.6" />
          <circle cx="20" cy="8" r="0.8" fill="#a0aec0" stroke="#4a5568" strokeWidth="0.3" />
        </svg>

        {/* Flag emoji overlay — positioned over the bridge flagpole area */}
        {originFlag && (
          <span
            style={{
              position: 'absolute',
              bottom: '2%',
              right: '12%',
              fontSize: flagSize,
              lineHeight: 1,
              pointerEvents: 'none',
            }}
          >
            {originFlag}
          </span>
        )}
      </div>
    </div>
  );
}
