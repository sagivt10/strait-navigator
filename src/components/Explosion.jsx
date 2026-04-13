import { useState, useEffect } from 'react';

export default function Explosion({ col, row, tileSize, variant = 'mine' }) {
  const cx = col * tileSize + tileSize / 2;
  const cy = row * tileSize + tileSize / 2;
  const [phase, setPhase] = useState('flash'); // 'flash' | 'fireball' | 'smoke' | 'wreck'

  const isOrange = variant === 'drone';

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('fireball'), 50);
    const t2 = setTimeout(() => setPhase('smoke'), 350);
    const t3 = setTimeout(() => setPhase('wreck'), 850);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  // Smoke particles — random upward drift
  const smokeParticles = Array.from({ length: 5 }, (_, i) => ({
    x: (i - 2) * 8 + (Math.random() * 6 - 3),
    delay: i * 60,
    size: 6 + Math.random() * 4,
  }));

  // Debris particles
  const debris = Array.from({ length: 6 }, (_, i) => ({
    angle: i * 60 + Math.random() * 30 - 15,
    distance: 16 + Math.random() * 14,
    size: 3 + Math.random() * 3,
    delay: Math.random() * 60,
    color: isOrange
      ? ['#ff8800', '#ffaa00', '#ff5500', '#ffcc00', '#cc4400', '#ff6600'][i]
      : ['#ff6b35', '#ffcc00', '#ff0000', '#ffffff', '#ff9800', '#cc4400'][i],
  }));

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: cx - 44,
        top: cy - 44,
        width: 88,
        height: 88,
        zIndex: 20,
      }}
    >
      {/* Phase 1: White flash (50ms) */}
      {phase === 'flash' && (
        <div style={{
          position: 'absolute', inset: 14,
          borderRadius: '50%',
          background: 'radial-gradient(circle, #ffffff 0%, rgba(255,255,255,0.8) 60%, transparent 100%)',
          animation: 'mine-flash 50ms ease-out forwards',
        }} />
      )}

      {/* Phase 2: Fireball expanding (300ms) */}
      {(phase === 'fireball' || phase === 'smoke') && (
        <>
          <div style={{
            position: 'absolute', inset: 10,
            borderRadius: '50%',
            background: isOrange
              ? 'radial-gradient(circle, #ffcc00 0%, #ff8800 35%, #ff5500 65%, transparent 100%)'
              : 'radial-gradient(circle, #ffff00 0%, #ff8800 35%, #ff0000 65%, transparent 100%)',
            animation: 'mine-fireball 300ms ease-out forwards',
          }} />
          {/* Shockwave rings */}
          <div style={{
            position: 'absolute', inset: 12,
            borderRadius: '50%',
            border: `2.5px solid ${isOrange ? 'rgba(255, 136, 0, 0.8)' : 'rgba(255, 80, 0, 0.8)'}`,
            animation: 'mine-shockwave 400ms ease-out forwards',
          }} />
          <div style={{
            position: 'absolute', inset: 12,
            borderRadius: '50%',
            border: `1.5px solid ${isOrange ? 'rgba(255, 170, 0, 0.5)' : 'rgba(255, 200, 0, 0.5)'}`,
            animation: 'mine-shockwave 500ms ease-out 60ms forwards',
            opacity: 0,
          }} />
          {/* Debris */}
          {debris.map((d, i) => {
            const rad = (d.angle * Math.PI) / 180;
            const dx = Math.cos(rad) * d.distance;
            const dy = Math.sin(rad) * d.distance;
            return (
              <div key={i} style={{
                position: 'absolute', left: 44 - d.size / 2, top: 44 - d.size / 2,
                width: d.size, height: d.size, backgroundColor: d.color, borderRadius: 1,
                animation: `mine-debris 400ms ease-out ${d.delay}ms forwards`,
                '--dx': `${dx}px`, '--dy': `${dy}px`,
              }} />
            );
          })}
        </>
      )}

      {/* Phase 3: Black smoke drifting up (500ms) */}
      {(phase === 'smoke' || phase === 'wreck') && (
        <>
          {smokeParticles.map((p, i) => (
            <div key={i} style={{
              position: 'absolute',
              left: 44 + p.x - p.size / 2,
              top: 44 - p.size / 2,
              width: p.size, height: p.size,
              borderRadius: '50%',
              backgroundColor: 'rgba(40, 40, 40, 0.7)',
              animation: `mine-smoke 600ms ease-out ${p.delay}ms forwards`,
            }} />
          ))}
        </>
      )}

      {/* Phase 4: Sinking wreck */}
      {phase === 'wreck' && (
        <svg width="20" height="20" viewBox="0 0 20 20" style={{
          position: 'absolute', left: 34, top: 36,
          opacity: 0.5, animation: 'mine-sink 2s ease-in forwards',
        }}>
          <path d="M10 2 L14 6 L14 14 L12 16 L8 16 L6 14 L6 6 Z"
            fill="#5a4a3a" stroke="#3a2a1a" strokeWidth="0.8" />
          <line x1="7" y1="8" x2="13" y2="10" stroke="#3a2a1a" strokeWidth="0.6" />
          <line x1="7" y1="12" x2="11" y2="13" stroke="#3a2a1a" strokeWidth="0.6" />
        </svg>
      )}

      <style>{`
        @keyframes mine-flash {
          0% { transform: scale(0.5); opacity: 1; }
          100% { transform: scale(2.5); opacity: 0; }
        }
        @keyframes mine-fireball {
          0% { transform: scale(0.3); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.9; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes mine-shockwave {
          0% { transform: scale(0.3); opacity: 1; }
          100% { transform: scale(3.2); opacity: 0; }
        }
        @keyframes mine-debris {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          80% { opacity: 0.7; }
          100% { transform: translate(var(--dx), var(--dy)) rotate(200deg); opacity: 0; }
        }
        @keyframes mine-smoke {
          0% { transform: translateY(0) scale(1); opacity: 0.7; }
          100% { transform: translateY(-30px) scale(1.8); opacity: 0; }
        }
        @keyframes mine-sink {
          0% { opacity: 0.5; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(8px); }
        }
      `}</style>
    </div>
  );
}
