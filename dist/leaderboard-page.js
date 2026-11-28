import {LeaderboardClient} from './leaderboard-client.js?v=22';
import {leaderboardMarkup} from './live-score-view.js?v=22';
import {loadLastVoyage} from './voyage-history.js?v=22';
const client = new LeaderboardClient();
const season=new URLSearchParams(location.search).get('season');
document.getElementById('season-title').textContent=season==='v20'?'Season 1 · archive':season==='v21'?'Season 2 original pace · archive':'Season 2 faster pace · live leaderboard';
const $ = id => document.getElementById(id);
async function refresh() {
  $('refresh').disabled = true;
  const recover = client.retryPending().then(results => {
    const saved = results.filter(row => row.status === 'fulfilled').length;
    const failed = results.filter(row => row.status === 'rejected');
    $('recovery').textContent = [saved ? `${saved} previously unsaved voyage(s) recovered.` : '',
      ...failed.map(row => `A previous voyage was not saved: ${row.reason.message}`)].filter(Boolean).join('\n');
  });
  await recover;
  try {
    const board = await client.board({season});
    const last = loadLastVoyage();
    const current = board.entries.find(entry => entry.id === last?.entry.id);
    $('board').innerHTML = leaderboardMarkup({...board, current, limit:100});
    const detail=$('own-score'), ledger=$('own-score-rows');
    ledger.replaceChildren();
    detail.hidden=!last?.scoreRows?.length||last.entry.version!==board.version;
    if(!detail.hidden)for(const row of last.scoreRows){
      const li=document.createElement('li'), label=document.createElement('span'), score=document.createElement('strong');
      label.textContent=row.label;score.textContent=(row.points>0?'+':'')+row.points.toLocaleString('en-US');
      li.append(label,score);ledger.append(li);
    }

    $('status').textContent = `${board.total} ranked voyages · Updated ${new Date().toLocaleTimeString()}`;
  } catch { $('status').textContent = 'Leaderboard unavailable. Please retry shortly. No sample scores are shown.'; }
  $('refresh').disabled = false;
}
$('refresh').onclick = refresh;
refresh();
