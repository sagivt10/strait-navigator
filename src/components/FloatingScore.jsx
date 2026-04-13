import { useState, useEffect } from 'react';

/**
 * Floating score number that pops up at a map position, drifts upward, and fades out over 800ms.
 * Renders inside the GameBoard (map coordinates, not HUD).
 */
export default function FloatingScore({ events, tileSize }) {
  const [visible, setVisible] = useState([]);

  useEffect(() => {
    if (events.length === 0) return;
    const latest = events[events.length - 1];
    // Add to visible list
    setVisible((prev) => [...prev, { ...latest, startTime: Date.now() }]);
    // Remove after 800ms
    const timer = setTimeout(() => {
      setVisible((prev) => prev.filter((e) => e.key !== latest.key));
    }, 850);
    return () => clearTimeout(timer);
  }, [events]);

  return visible.map((evt) => {
    const colors = {
      mine: '#ff0000',
      drone: '#ff8800',
      intercept: '#00cc88',
      port: '#ffd700',
    };
    const color = colors[evt.type] || '#ffffff';
    const label =
      evt.amount > 0 ? `+${evt.amount.toLocaleString()}` : evt.amount.toLocaleString();
    const suffix = evt.type === 'port' ? ' BONUS' : '';

    return (
      <div
        key={evt.key}
        style={{
          position: 'absolute',
          left: evt.col * tileSize + tileSize / 2,
          top: evt.row * tileSize,
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
          zIndex: 100,
          animation: 'floating-score 800ms ease-out forwards',
        }}
      >
        <span
          style={{
            color,
            fontFamily: 'var(--font-mono)',
            fontWeight: 900,
            fontSize: evt.type === 'port' ? 18 : 16,
            textShadow: `0 0 8px ${color}, 0 1px 3px rgba(0,0,0,0.8)`,
            whiteSpace: 'nowrap',
          }}
        >
          {label}{suffix}
        </span>
      </div>
    );
  });
}
