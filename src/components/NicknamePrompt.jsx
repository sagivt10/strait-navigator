import { useState } from 'react';

export default function NicknamePrompt({ onSubmit, onCancel }) {
  const [name, setName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length > 0) {
      onSubmit(trimmed.slice(0, 20));
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[100]"
      style={{ background: 'rgba(13, 33, 55, 0.92)' }}
    >
      <form
        onSubmit={handleSubmit}
        className="text-center px-6 py-8 rounded-lg max-w-sm w-full mx-4"
        style={{
          background: 'rgba(26, 74, 107, 0.5)',
          border: '1px solid rgba(240, 165, 0, 0.3)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            color: 'var(--color-ui-accent)',
            marginBottom: 8,
          }}
        >
          ENTER CALLSIGN
        </div>
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            color: 'var(--color-ui-text)',
            opacity: 0.5,
            marginBottom: 20,
          }}
        >
          Your name on the global leaderboard
        </p>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
          autoFocus
          placeholder="Captain..."
          style={{
            width: '100%',
            padding: '10px 14px',
            fontFamily: 'var(--font-mono)',
            fontSize: 16,
            background: 'rgba(13, 33, 55, 0.8)',
            color: 'var(--color-ui-text)',
            border: '1px solid rgba(240, 165, 0, 0.4)',
            borderRadius: 4,
            outline: 'none',
            marginBottom: 16,
            boxSizing: 'border-box',
          }}
        />

        <div className="flex gap-3 justify-center">
          <button
            type="submit"
            disabled={name.trim().length === 0}
            className="cursor-pointer"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              padding: '10px 28px',
              background: name.trim() ? 'var(--color-ui-accent)' : 'rgba(240,165,0,0.3)',
              color: 'var(--color-ui-bg)',
              border: 'none',
              borderRadius: 4,
              fontWeight: 700,
              letterSpacing: 1,
              cursor: name.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            SUBMIT
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="cursor-pointer"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              padding: '10px 20px',
              background: 'transparent',
              color: 'var(--color-ui-text)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 4,
              opacity: 0.7,
            }}
          >
            SKIP
          </button>
        </div>
      </form>
    </div>
  );
}
