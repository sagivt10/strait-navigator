import { useState, useEffect } from 'react';

export default function DroneIntercept({ from, to, tileSize }) {
  const [phase, setPhase] = useState('missile'); // 'missile' | 'explode' | 'done'

  const fromX = from.col * tileSize + tileSize / 2;
  const fromY = from.row * tileSize + tileSize / 2;
  const toX = to.col * tileSize + tileSize / 2;
  const toY = to.row * tileSize + tileSize / 2;

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('explode'), 250);
    const t2 = setTimeout(() => setPhase('done'), 700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (phase === 'done') return null;

  return (
    <>
      {/* Missile streak line */}
      {phase === 'missile' && (
        <svg
          className="pointer-events-none absolute"
          style={{ left: 0, top: 0, width: '100%', height: '100%', zIndex: 25, overflow: 'visible' }}
        >
          <line
            x1={fromX} y1={fromY} x2={toX} y2={toY}
            stroke="#ff8800"
            strokeWidth="2"
            strokeDasharray="6 3"
            style={{ animation: 'missile-streak 250ms ease-in forwards' }}
          />
          {/* Missile head glow */}
          <circle
            cx={toX} cy={toY} r="3"
            fill="#ffcc00"
            style={{ animation: 'missile-head 250ms ease-in forwards' }}
          />
        </svg>
      )}

      {/* Explosion burst at drone location */}
      {phase === 'explode' && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: toX - 24,
            top: toY - 24,
            width: 48,
            height: 48,
            zIndex: 25,
          }}
        >
          {/* Orange flash */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: 'radial-gradient(circle, #ffcc00 0%, #ff6600 50%, transparent 100%)',
            animation: 'intercept-burst 450ms ease-out forwards',
          }} />
          {/* Debris sparks */}
          {[0, 72, 144, 216, 288].map((deg) => (
            <div key={deg} style={{
              position: 'absolute', left: 22, top: 22, width: 4, height: 4,
              backgroundColor: '#ff8800', borderRadius: 1,
              animation: `intercept-spark 400ms ease-out forwards`,
              transform: `rotate(${deg}deg) translateY(-8px)`,
            }} />
          ))}
        </div>
      )}

      <style>{`
        @keyframes missile-streak {
          0% { stroke-dashoffset: 100; opacity: 0.3; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes missile-head {
          0% { r: 1; opacity: 0; }
          50% { r: 4; opacity: 1; }
          100% { r: 2; opacity: 1; }
        }
        @keyframes intercept-burst {
          0% { transform: scale(0.2); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.9; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes intercept-spark {
          0% { transform: rotate(var(--deg, 0deg)) translateY(-4px); opacity: 1; }
          100% { transform: rotate(var(--deg, 0deg)) translateY(-20px); opacity: 0; }
        }
      `}</style>
    </>
  );
}
