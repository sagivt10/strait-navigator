import {LeaderboardClient} from './leaderboard-client.js';
import {leaderboardMarkup} from './live-score-view.js';
const client = new LeaderboardClient();
const $ = id => document.getElementById(id);
async function refresh() {
  $('refresh').disabled = true;
  const recover = client.retryPending().then(results => {
    const saved = results.filter(row => row.status === 'fulfilled').length;
    const failed = results.filter(row => row.status === 'rejected');
    $('recovery').textContent = [saved ? `${saved} previously unsaved voyage(s) recovered.` : '',
      ...failed.map(row => `A previous voyage was not saved: ${row.reason.message}`)].filter(Boolean).join('\n');
  });
  try {
    const board = await client.board();
    $('board').innerHTML = leaderboardMarkup({...board, limit:100});
    $('status').textContent = `${board.total} ranked voyages · Updated ${new Date().toLocaleTimeString()}`;
  } catch { $('status').textContent = 'Leaderboard unavailable. Please retry shortly. No sample scores are shown.'; }
  await recover;
  $('refresh').disabled = false;
}
$('refresh').onclick = refresh;
refresh();
