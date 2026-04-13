import { useState, useEffect } from 'react';
import { getLeaderboard } from '../game/supabase';
import { allLevelsMeta } from '../levels/index';
import { formatTime } from '../game/engine';

export default function Leaderboard({ initialLevelId, onBack }) {
  const [selectedLevel, setSelectedLevel] = useState(initialLevelId || 1);
  const [scores, setScores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    getLeaderboard(selectedLevel).then((data) => {
      if (!cancelled) {
        setScores(data);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [selectedLevel]);

  const levelMeta = allLevelsMeta.find((m) => m.id === selectedLevel);

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--color-ui-bg)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid rgba(240, 165, 0, 0.3)' }}
      >
        <button
          onClick={onBack}
          className="cursor-pointer"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            padding: '6px 16px',
            background: 'rgba(240, 165, 0, 0.15)',
            color: 'var(--color-ui-accent)',
            border: '1px solid rgba(240, 165, 0, 0.3)',
            borderRadius: 4,
          }}
        >
          &#8592; BACK
        </button>
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 24,
            color: 'var(--color-ui-accent)',
            margin: 0,
            letterSpacing: 1,
          }}
        >
          LEADERBOARD
        </h2>
        <div style={{ width: 80 }} />
      </div>

      {/* Level filter */}
      <div
        className="flex gap-2 px-4 py-3 overflow-x-auto shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
      >
        {allLevelsMeta.slice(0, 5).map((meta) => (
          <button
            key={meta.id}
            onClick={() => setSelectedLevel(meta.id)}
            className="cursor-pointer shrink-0"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              padding: '6px 12px',
              background:
                meta.id === selectedLevel
                  ? 'rgba(240, 165, 0, 0.2)'
                  : 'rgba(255,255,255,0.04)',
              color:
                meta.id === selectedLevel
                  ? 'var(--color-ui-accent)'
                  : 'var(--color-ui-text)',
              border:
                meta.id === selectedLevel
                  ? '1px solid rgba(240, 165, 0, 0.4)'
                  : '1px solid rgba(255,255,255,0.08)',
              borderRadius: 4,
              whiteSpace: 'nowrap',
            }}
          >
            #{meta.id} {meta.name}
          </button>
        ))}
      </div>

      {/* Level info */}
      {levelMeta && (
        <div
          className="px-4 py-2 text-center shrink-0"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            color: 'var(--color-ui-accent)',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
          }}
        >
          {levelMeta.originFlag} {levelMeta.name} {levelMeta.destFlag}
        </div>
      )}

      {/* Scores table */}
      <div className="flex-1 overflow-auto px-4 py-3">
        {loading ? (
          <div
            className="text-center py-12"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              color: 'var(--color-ui-text)',
              opacity: 0.5,
            }}
          >
            Loading...
          </div>
        ) : scores.length === 0 ? (
          <div
            className="text-center py-12"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              color: 'var(--color-ui-text)',
              opacity: 0.4,
            }}
          >
            No scores yet. Be the first!
          </div>
        ) : (
          <table
            className="w-full max-w-lg mx-auto"
            style={{ borderCollapse: 'collapse' }}
          >
            <thead>
              <tr
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--color-ui-text)',
                  opacity: 0.4,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                <th className="text-left py-2 px-2">#</th>
                <th className="text-left py-2 px-2">Captain</th>
                <th className="text-right py-2 px-2">Score</th>
                <th className="text-right py-2 px-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((score, i) => (
                <tr
                  key={score.id}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 14,
                    color: 'var(--color-ui-text)',
                    borderTop: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  <td
                    className="py-2 px-2"
                    style={{
                      color:
                        i === 0
                          ? 'var(--color-ui-accent)'
                          : i <= 2
                          ? '#00cc88'
                          : 'inherit',
                      fontWeight: i === 0 ? 700 : 400,
                    }}
                  >
                    {i + 1}
                  </td>
                  <td className="py-2 px-2">{score.player_name}</td>
                  <td
                    className="py-2 px-2 text-right"
                    style={{
                      color:
                        i === 0
                          ? 'var(--color-ui-accent)'
                          : 'var(--color-ui-text)',
                      fontWeight: i === 0 ? 700 : 400,
                    }}
                  >
                    {(score.score ?? 0).toLocaleString()}
                  </td>
                  <td
                    className="py-2 px-2 text-right"
                    style={{ opacity: 0.5, fontSize: 12 }}
                  >
                    {formatTime(score.time_ms)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
