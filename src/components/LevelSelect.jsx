import { allLevelsMeta, getLevelById } from '../levels/index';
import { isLevelUnlocked, getBestTime } from '../game/storage';
import { formatTime } from '../game/engine';

export default function LevelSelect({ onSelectLevel, onBack, onLeaderboard, onDaily }) {
  return (
    <div
      className="flex flex-col h-full"
      style={{ background: 'var(--color-ui-bg)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 shrink-0"
        style={{
          borderBottom: '1px solid rgba(240, 165, 0, 0.3)',
        }}
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
          SELECT MISSION
        </h2>
        <button
          onClick={onLeaderboard}
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
          RANKS
        </button>
      </div>

      {/* Level grid */}
      <div className="flex-1 overflow-auto p-4">
        {/* Daily Challenge banner */}
        <div className="max-w-2xl mx-auto mb-3">
          <button
            onClick={onDaily}
            className="cursor-pointer w-full text-left"
            style={{
              padding: '14px 16px',
              background: 'rgba(0, 204, 136, 0.08)',
              border: '1px solid rgba(0, 204, 136, 0.3)',
              borderRadius: 6,
              transition: 'background 0.2s',
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 12,
                  color: '#00cc88', background: 'rgba(0,204,136,0.15)',
                  padding: '2px 6px', borderRadius: 3,
                }}>
                  {'\u{1F5D3}\uFE0F'}
                </span>
                <span style={{
                  fontFamily: 'var(--font-display)', fontSize: 17,
                  color: '#00cc88',
                }}>
                  Daily Challenge
                </span>
              </div>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 12,
                color: '#00cc88', opacity: 0.7,
              }}>
                New map every day
              </span>
            </div>
            <div style={{
              fontFamily: 'var(--font-sans)', fontSize: 12,
              color: 'var(--color-ui-text)', opacity: 0.5, marginTop: 4,
            }}>
              Same mines for everyone worldwide. One score per day.
            </div>
          </button>
        </div>

        <div
          className="grid gap-3 max-w-2xl mx-auto"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
        >
          {allLevelsMeta.map((meta) => {
            const unlocked = isLevelUnlocked(meta.id);
            const hasData = getLevelById(meta.id) !== null;
            const bestTime = getBestTime(meta.id);
            const completed = bestTime !== null;
            const playable = unlocked && hasData;

            return (
              <button
                key={meta.id}
                onClick={() => playable && onSelectLevel(meta.id)}
                disabled={!playable}
                className="text-left cursor-pointer"
                style={{
                  padding: '14px 16px',
                  background: completed
                    ? 'rgba(0, 204, 136, 0.08)'
                    : playable
                    ? 'rgba(240, 165, 0, 0.06)'
                    : 'rgba(255,255,255,0.02)',
                  border: completed
                    ? '1px solid rgba(0, 204, 136, 0.3)'
                    : playable
                    ? '1px solid rgba(240, 165, 0, 0.2)'
                    : '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 6,
                  opacity: playable ? 1 : 0.4,
                  cursor: playable ? 'pointer' : 'not-allowed',
                  transition: 'border-color 0.2s, background 0.2s',
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        color: completed ? '#00cc88' : 'var(--color-ui-accent)',
                        background: completed
                          ? 'rgba(0,204,136,0.15)'
                          : 'rgba(240,165,0,0.15)',
                        padding: '2px 6px',
                        borderRadius: 3,
                      }}
                    >
                      {completed ? '&#10003;' : `#${meta.id}`}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 17,
                        color: 'var(--color-ui-text)',
                      }}
                    >
                      {meta.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {!unlocked && (
                      <span style={{ fontSize: 14, opacity: 0.5 }}>&#128274;</span>
                    )}
                    {unlocked && !hasData && (
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          color: 'var(--color-ui-text)',
                          opacity: 0.4,
                        }}
                      >
                        SOON
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: 12,
                      color: 'var(--color-ui-text)',
                      opacity: 0.5,
                    }}
                  >
                    {meta.originFlag} {meta.subtitle} {meta.destFlag}
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Difficulty stars */}
                    <span style={{ fontSize: 10, opacity: 0.4, letterSpacing: 1 }}>
                      {'★'.repeat(meta.difficulty)}{'☆'.repeat(Math.max(0, 6 - meta.difficulty))}
                    </span>
                  </div>
                </div>

                {/* Best time */}
                {completed && (
                  <div
                    className="mt-1"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 13,
                      color: '#00cc88',
                    }}
                  >
                    Best: {formatTime(bestTime)}
                  </div>
                )}

                {/* Mine count + grid size */}
                <div
                  className="flex items-center gap-3 mt-1"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--color-ui-text)',
                    opacity: 0.3,
                  }}
                >
                  <span>{meta.cols}x{meta.rows} grid</span>
                  <span>{meta.mineCount} mines</span>
                  <span>{meta.distance} nm</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
