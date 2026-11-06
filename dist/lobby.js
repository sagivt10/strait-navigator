import {LeaderboardClient} from './leaderboard-client.js';
import {leaderboardMarkup} from './live-score-view.js';
import {loadCaptainName, sanitizeCaptainName} from './captain-name.js';
import {loadLastVoyage} from './voyage-history.js';

const client = new LeaderboardClient();
const panels = [...document.querySelectorAll('[data-lobby-board]')];
const nameInput = document.getElementById('captain-name-field');
let board = null, pending = null, last = loadLastVoyage();
const modes = new Map(panels.map(panel => [panel, 'all']));
const number = new Intl.NumberFormat('en-US');
const nickname = () => sanitizeCaptainName(nameInput?.value || loadCaptainName());
const visible = () => panels.some(panel => !panel.closest('.overlay')?.classList.contains('hidden'));

function render() {
  for (const panel of panels) {
    const mine = modes.get(panel) === 'name';
    const entries = (board?.entries || []).filter(e => !mine || e.name === nickname());
    panel.querySelector('[data-board-count]').textContent = board
      ? `${number.format(board.total)} completed voyages` : 'Connecting to the club';
    panel.querySelector('[data-board-scope]').textContent = mine
      ? `Showing this nickname: ${nickname()}. Nicknames can be shared by different people.`
      : 'Every completed ranked voyage counts. Your earlier scores stay on the board.';
    for (const button of panel.querySelectorAll('[data-board-mode]'))
      button.setAttribute('aria-pressed', String(button.dataset.boardMode === modes.get(panel)));
    const receipt = panel.querySelector('[data-last-voyage]');
    receipt.replaceChildren();
    if (last && (!board || !last.entry.version || last.entry.version === board.version)) {
      const current = board?.entries.find(e => e.id === last.entry.id);
      const title = document.createElement('small');
      title.textContent = 'LAST SAVED VOYAGE ON THIS BROWSER';
      const score = document.createElement('strong');
      score.textContent = `${number.format(last.entry.score)} points · ${current ? 'Rank' : 'Rank at finish'} #${number.format(current?.rank || last.entry.rank)}`;
      const detail = document.createElement('span');
      detail.textContent = `${last.entry.name} · ${last.entry.status === 'won' ? 'Docked' : 'Voyage lost'}${current ? '' : ' · Saved rank; current position may have changed.'}`;
      receipt.append(title, score, detail);
    } else {
      receipt.textContent = 'Finish a ranked voyage to see your saved score and position here.';
    }
    const host = panel.querySelector('[data-board-rows]');
    if (!board) continue;
    host.innerHTML = entries.length ? leaderboardMarkup({entries, total:board.total,
      current:entries.find(e => e.id === last?.entry.id), limit:100})
      : `<p class="lobby-empty">${mine ? 'No results for this nickname among the top 100 yet. Finish a ranked voyage, or view all voyages.' : 'The sea is yours. Finish the first ranked voyage to join the club.'}</p>`;
    panel.querySelector('[data-board-status]').textContent = `${mine ? entries.length + ' matching voyages · ' : ''}Top ${Math.min(100, board.entries.length)} of ${number.format(board.total)} shown · Updated ${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`;
  }
}

async function refresh() {
  if (pending) return pending;
  for (const panel of panels) panel.querySelector('[data-board-refresh]').disabled = true;
  pending = (async () => {
    try { board = await client.board(); render(); }
    catch {
      for (const panel of panels) panel.querySelector('[data-board-status]').textContent =
        board ? 'Could not refresh. The last loaded results are shown.' : 'Leaderboard unavailable. Retry when you are back online. You can still sail in practice mode.';
    } finally {
      for (const panel of panels) panel.querySelector('[data-board-refresh]').disabled = false;
      pending = null;
    }
  })();
  return pending;
}
for (const panel of panels) {
  panel.querySelector('[data-board-refresh]').onclick = refresh;
  for (const button of panel.querySelectorAll('[data-board-mode]')) button.onclick = () => {
    modes.set(panel, button.dataset.boardMode); render();
  };
}
nameInput?.addEventListener('input', render);
document.addEventListener('voyage-saved', event => {
  last = event.detail; render();
  if (pending) pending.then(refresh); else refresh();
});
document.addEventListener('visibilitychange', () => { if (!document.hidden && visible()) refresh(); });
const observer = new MutationObserver(() => { if (visible()) refresh(); });
for (const id of ['overlay', 'result']) observer.observe(document.getElementById(id), {attributes:true, attributeFilter:['class']});
setInterval(() => { if (!document.hidden && visible()) refresh(); }, 60000);
render(); refresh();
