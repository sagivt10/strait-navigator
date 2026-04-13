import { useState, useEffect } from 'react';

const COLORS = ['#f0a500', '#00cc88', '#ff6b35', '#3182ce', '#e53e3e', '#805ad5', '#d69e2e'];

function randomBetween(a, b) {
  return a + Math.random() * (b - a);
}

export default function Confetti({ width, height }) {
  const [particles] = useState(() =>
    Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: randomBetween(0, width),
      delay: randomBetween(0, 600),
      duration: randomBetween(1200, 2000),
      color: COLORS[i % COLORS.length],
      size: randomBetween(4, 8),
      drift: randomBetween(-30, 30),
      rotation: randomBetween(0, 360),
      spin: randomBetween(-180, 180),
    }))
  );

  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 2200);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <>
      <div className="pointer-events-none absolute inset-0" style={{ zIndex: 30, overflow: 'hidden' }}>
        {particles.map((p) => (
          <div
            key={p.id}
            style={{
              position: 'absolute',
              left: p.x,
              top: -10,
              width: p.size,
              height: p.size * 0.6,
              backgroundColor: p.color,
              borderRadius: 1,
              transform: `rotate(${p.rotation}deg)`,
              animation: `confetti-fall ${p.duration}ms ease-in ${p.delay}ms forwards`,
              '--drift': `${p.drift}px`,
              '--spin': `${p.spin}deg`,
              '--target-y': `${height + 20}px`,
              opacity: 0,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes confetti-fall {
          0% {
            opacity: 1;
            transform: translateY(0) translateX(0) rotate(0deg);
          }
          80% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translateY(var(--target-y)) translateX(var(--drift)) rotate(var(--spin));
          }
        }
      `}</style>
    </>
  );
}
