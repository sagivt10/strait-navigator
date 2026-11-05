import {SAMPLE_RUNS,SCORING_RULES} from './scoring.js?v=20';
import {renderScoreReport} from './score-view.js?v=20';
import {loadCaptainName,saveCaptainName} from './captain-name.js';
import {animateLeaderboardEntry} from './score-entry.js';
let selected='won',entry=null;
document.getElementById('preview-name-field').value=loadCaptainName();
function show(kind){
 selected=kind;entry?.cancel();
 const run={...SAMPLE_RUNS[kind],playerName:saveCaptainName(document.getElementById('preview-name-field').value)};
 document.getElementById('preview-name-field').value=run.playerName;
 renderScoreReport(document.getElementById('score-report'),run,{sample:true});
 entry=animateLeaderboardEntry(document.getElementById('score-report'));
 document.getElementById('sample-win').setAttribute('aria-pressed',String(kind==='won'));
 document.getElementById('sample-loss').setAttribute('aria-pressed',String(kind==='lost'));
 document.getElementById('mock-outcome').textContent=kind==='won'?'PASSAGE COMPLETE':'VOYAGE LOST · TRY AGAIN';
 const minutes=Math.floor(run.time/60),seconds=String(Math.floor(run.time%60)).padStart(2,'0');
 document.getElementById('mock-metrics').textContent=`${minutes}:${seconds} voyage · ${run.health}/${SCORING_RULES.maxHealth} hull`;
}
document.getElementById('sample-win').onclick=()=>show('won');
document.getElementById('sample-loss').onclick=()=>show('lost');
show('won');

document.getElementById('preview-name-go').onclick=()=>show(selected);
document.getElementById('preview-name-field').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();show(selected);}});
