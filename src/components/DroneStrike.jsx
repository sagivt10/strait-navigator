import { useState, useEffect } from 'react';
import Explosion from './Explosion';

export default function DroneStrike({ dronePos, shipPos, tileSize }) {
  const [phase, setPhase] = useState('missile'); // 'missile' | 'explode'

  const fromX = dronePos.col * tileSize + tileSize / 2;
  const fromY = dronePos.row * tileSize + tileSize / 2;
  const toX = shipPos.col * tileSize + tileSize / 2;
  const toY = shipPos.row * tileSize + tileSize / 2;

  useEffect(() => {
    const t = setTimeout(() => setPhase('explode'), 200);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {/* Missile streak from drone to ship */}
      {phase === 'missile' && (
        <svg
          className="pointer-events-none absolute"
          style={{ left: 0, top: 0, width: '100%', height: '100%', zIndex: 25, overflow: 'visible' }}
        >
          <line
            x1={fromX} y1={fromY} x2={toX} y2={toY}
            stroke="#ff6600"
            strokeWidth="2.5"
            strokeDasharray="8 4"
            style={{ animation: 'drone-missile 200ms ease-in forwards' }}
          />
          {/* Missile trail glow */}
          <line
            x1={fromX} y1={fromY} x2={toX} y2={toY}
            stroke="#ffaa00"
            strokeWidth="1"
            opacity="0.6"
            style={{ animation: 'drone-missile 200ms ease-in forwards' }}
          />
          {/* Missile head */}
          <circle cx={toX} cy={toY} r="4"
            fill="#ffcc00"
            style={{ animation: 'drone-missile-head 200ms ease-in forwards' }}
          />
        </svg>
      )}

      {/* Orange-tinted explosion at ship position */}
      {phase === 'explode' && (
        <Explosion col={shipPos.col} row={shipPos.row} tileSize={tileSize} variant="drone" />
      )}

      <style>{`
        @keyframes drone-missile {
          0% { stroke-dashoffset: 100; opacity: 0; }
          30% { opacity: 1; }
          100% { stroke-dashoffset: 0; opacity: 1; }
        }
        @keyframes drone-missile-head {
          0% { opacity: 0; r: 2; }
          60% { opacity: 1; r: 5; }
          100% { opacity: 1; r: 3; }
        }
      `}</style>
    </>
  );
}
