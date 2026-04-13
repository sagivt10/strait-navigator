export default function WakeTrail({ trail, tileSize }) {
  if (!trail || trail.length === 0) return null;

  return (
    <>
      {trail.map((pos, i) => {
        const cx = pos.col * tileSize + tileSize / 2;
        const cy = pos.row * tileSize + tileSize / 2;
        const dotSize = Math.max(3, Math.round(tileSize * 0.12)) * (3 - i) / 3;

        return (
          <div
            key={pos.key}
            className="pointer-events-none absolute"
            style={{
              left: cx - dotSize / 2,
              top: cy - dotSize / 2,
              width: dotSize,
              height: dotSize,
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.6)',
              animation: 'wake-fade 400ms ease-out forwards',
              zIndex: 4,
            }}
          />
        );
      })}

      <style>{`
        @keyframes wake-fade {
          0% { opacity: 0.6; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.3); }
        }
      `}</style>
    </>
  );
}
