export default function SonarPing({ col, row, tileSize }) {
  const cx = col * tileSize + tileSize / 2;
  const cy = row * tileSize + tileSize / 2;

  return (
    <>
      {/* Ring 1 — accent yellow fading to transparent */}
      <div
        className="sonar-ping pointer-events-none absolute"
        style={{
          left: cx - 20,
          top: cy - 20,
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: '2.5px solid var(--color-ui-accent)',
          opacity: 0,
          zIndex: 5,
        }}
      />
      {/* Ring 2 — delayed, slightly different starting color */}
      <div
        className="sonar-ping-delayed pointer-events-none absolute"
        style={{
          left: cx - 20,
          top: cy - 20,
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: '2px solid var(--color-ui-accent)',
          opacity: 0,
          zIndex: 5,
        }}
      />
    </>
  );
}
