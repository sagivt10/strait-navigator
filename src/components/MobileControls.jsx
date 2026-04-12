export default function MobileControls({ onMove, onRestart }) {
  const btnStyle = {
    width: 48,
    height: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(240, 165, 0, 0.15)',
    border: '1px solid rgba(240, 165, 0, 0.3)',
    borderRadius: 6,
    color: 'var(--color-ui-accent)',
    fontSize: 20,
    cursor: 'pointer',
    userSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
  };

  return (
    <div
      className="flex items-center justify-between px-4 py-2 shrink-0"
      style={{
        background: 'rgba(13, 33, 55, 0.95)',
        borderTop: '1px solid rgba(240, 165, 0, 0.3)',
      }}
    >
      {/* D-pad */}
      <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(3, 48px)', gridTemplateRows: 'repeat(3, 48px)' }}>
        <div />
        <button style={btnStyle} onClick={() => onMove('up')}>&#9650;</button>
        <div />
        <button style={btnStyle} onClick={() => onMove('left')}>&#9664;</button>
        <div />
        <button style={btnStyle} onClick={() => onMove('right')}>&#9654;</button>
        <div />
        <button style={btnStyle} onClick={() => onMove('down')}>&#9660;</button>
        <div />
      </div>

      {/* Restart button */}
      <button
        onClick={onRestart}
        style={{
          ...btnStyle,
          width: 'auto',
          padding: '8px 16px',
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          gap: 6,
        }}
      >
        &#8634; RESTART
      </button>
    </div>
  );
}
