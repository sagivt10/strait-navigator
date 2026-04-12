export default function Explosion({ col, row, tileSize }) {
  const cx = col * tileSize + tileSize / 2;
  const cy = row * tileSize + tileSize / 2;

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: cx - 30,
        top: cy - 30,
        width: 60,
        height: 60,
        zIndex: 20,
      }}
    >
      {/* Frame 1: flash */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: 'radial-gradient(circle, #ffff00 0%, #ff6b35 40%, #ff0000 70%, transparent 100%)',
          animation: 'explode 0.6s ease-out forwards',
        }}
      />
      {/* Frame 2: smoke ring */}
      <div
        style={{
          position: 'absolute',
          inset: -10,
          borderRadius: '50%',
          background: 'radial-gradient(circle, transparent 30%, rgba(100,100,100,0.4) 60%, transparent 100%)',
          animation: 'explode 0.8s ease-out 0.2s forwards',
          opacity: 0,
        }}
      />
      {/* Ship debris — small white fragments */}
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <div
          key={deg}
          style={{
            position: 'absolute',
            left: 28,
            top: 28,
            width: 4,
            height: 4,
            backgroundColor: 'white',
            borderRadius: '1px',
            animation: `explode 0.5s ease-out forwards`,
            transform: `rotate(${deg}deg) translateY(-15px)`,
          }}
        />
      ))}
    </div>
  );
}
