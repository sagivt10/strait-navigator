import {scoreMarkup} from './score-view.js?v=20';
import {sanitizeCaptainName} from './captain-name.js';
const number = new Intl.NumberFormat('en-US');
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const time = n => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
const medals = ['', 'gold', 'silver', 'bronze'];
const icons = ['', '🏆', '🥈', '🥉'];
export function leaderboardMarkup({entries = [], total = 0, current = null, limit = 7} = {}) {
  const rows = entries.slice(0, limit);
  const rowMarkup = (entry, contiguous) => {
    const rank = Number(entry.rank);
    const mine = current?.id === entry.id;
    const medal = medals[rank] || '';
    return `<div class="leader-row ${mine ? 'you' : ''} ${medal ? `medal-${medal}` : ''}" ${contiguous ? `data-final-position="${rank}"` : ''} role="row"><span class="board-position" role="cell">${number.format(rank)}</span><div role="cell"><strong><span class="medal-icon" aria-hidden="true"${medal ? '' : ' hidden'}>${icons[rank] || ''}</span>${esc(sanitizeCaptainName(entry.name))}${mine ? '<em>YOU</em>' : ''}<span class="medal-marker" aria-hidden="true">${medal.toUpperCase()}</span></strong><small>${entry.status === 'won' ? 'Docked' : 'Voyage lost'} · ${time(Number(entry.time) || 0)} · ${Number(entry.health) || 0}/2 hull</small></div><span class="board-score" role="cell">${number.format(Number(entry.score ?? entry.total) || 0)}</span></div>`;
  };
  const contiguous = rows.every((row, index) => row.rank === index + 1);
  const outside = current && !rows.some(row => row.id === current.id);
  return `<div class="leaderboard" role="table" aria-label="Real voyage leaderboard"><div class="leader-row leaderboard-head" role="row"><span role="columnheader">#</span><span role="columnheader">Captain / voyage</span><span role="columnheader">Points</span></div><div class="leaderboard-body" role="rowgroup">${rows.map(row => rowMarkup(row, contiguous)).join('')}</div></div>${rows.length ? '' : '<p class="board-disclaimer">No ranked voyages yet. Be the first captain on the board.</p>'}${outside ? `<p class="board-disclaimer">Your voyage</p><div class="leaderboard" role="table" aria-label="Your voyage rank">${rowMarkup(current, false)}</div>` : ''}<p class="rank-announcement" aria-live="polite">${current ? `Your voyage ranks ${number.format(current.rank)} of ${number.format(total)}.` : `${number.format(total)} ranked voyages.`}</p>`;
}
export function liveScoreMarkup(run, {state = 'practice', board, entry, message, verifiedRun} = {}) {
  const status = {
    practice:'Practice voyage. This result has not been submitted.',
    saving:'Checking your replay and saving this voyage…',
    saved:'Replay verified. This voyage is saved on the real leaderboard.',
    pending:'Connection interrupted. This voyage is waiting to be saved.',
    rejected:'This voyage could not be ranked.',
  }[state] || 'Leaderboard unavailable.';
  let base = scoreMarkup(verifiedRun?{...verifiedRun,playerName:run.playerName}:run);
  base = base.slice(0, base.indexOf('<section class="demo-board"'))
    .replace(' · PROVISIONAL SCORE', ' · VOYAGE SCORE')
    .replace('<div class="score-total">', `<p class="voyage-captain">${esc(sanitizeCaptainName(run.playerName))}</p><div class="score-total">`)
    .replace('Every point accounted for. Nothing submitted.', esc(message || status))
    .replace('Draft rules', 'v20 rules')
    .replace('How this mock score works', 'How the score works')
    .replace('These are proposed rules, not a final competitive system.', 'Ranked voyages use these v20 rules. Each completed ranked voyage is a separate entry.')
    .replace('award no direct points in this mock', 'award no direct points');
  return `${base}<section class="demo-board live-board" aria-labelledby="leaderboard-title"><div class="section-heading"><h3 id="leaderboard-title">The captain’s club</h3><span class="demo-badge">${state === 'saved' ? 'LIVE' : esc(state.toUpperCase())}</span></div><p class="board-disclaimer">${esc(message || status)}</p>${board ? leaderboardMarkup({...board, current:entry}) : '<p class="board-disclaimer">The real table appears when the ranking service responds. No sample rivals are shown.</p>'}${state === 'pending' ? '<button class="rank-retry" type="button">Retry saving voyage</button>' : ''}<div class="board-footnote">No account required. Nicknames are not verified identities. <a href="leaderboard.html">Full leaderboard</a> · <a href="privacy.html">Ranking privacy</a></div></section></div>`;
}
export function renderLiveScoreReport(container, run, options) { container.innerHTML = liveScoreMarkup(run, options); }
