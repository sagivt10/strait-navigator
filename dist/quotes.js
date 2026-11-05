/** Selection only. All clips are authentic, separately credited archival excerpts. */
export const OPENING_QUOTE={id:'gulf',file:'trump-gulf-mexico.mp3',duration:7.027,text:'We also took the Gulf of Mexico, and now it’s the Gulf of America.'};
export const ARCHIVE_QUOTES={
  war:{id:'war',file:'trump-world-war-three-double.mp3',duration:5.46,text:'You’re gambling with World War Three.'},
  winning:{id:'winning',file:'trump-country-winning-again.mp3',duration:2.41,text:'Our country is winning again.'},
  winbig:{id:'winbig',file:'trump-win-big.mp3',duration:3.55,text:'You’re going to win big. You’re going to win bigger than ever.'},
  bomb:{id:'bomb',file:'trump-bomb-dodge.mp3',duration:2.534,text:'Bomb the shit out of them.'},
  full:{id:'full',file:'trump-winning-joke-full.mp3',duration:21.5,text:'Mr. President, we’re winning too much.'}
};
const POOLS={incomingMissile:['war'],droneEscape:['winning','winbig'],missileDodge:['winning','winbig','bomb'],setback:['war'],victory:['full']};
export class QuoteDirector{
  constructor(random=Math.random){this.random=random;this.reset();}
  reset(){this.last=null;this.nextAt=0;this.counts=Object.fromEntries(Object.keys(ARCHIVE_QUOTES).map(id=>[id,0]));this.finaleUsed=false;this.activeUntil=0;}
  choose(event,time,accept=()=>true){const finale=event==='victory',firstWarning=event==='incomingMissile'&&this.counts.war===0;if(time<this.activeUntil||(finale?this.finaleUsed:time<this.nextAt&&!firstWarning))return null;const pool=(POOLS[event]||[]).filter(id=>id!==this.last&&(finale||this.counts[id]<2));if(!pool.length)return null;const id=pool[Math.min(pool.length-1,Math.floor(this.random()*pool.length))],clip=ARCHIVE_QUOTES[id];if(!accept(clip))return null;this.last=id;this.counts[id]++;if(finale)this.finaleUsed=true;this.activeUntil=time+clip.duration+.35;this.nextAt=time+28+this.random()*16;return clip;}
}
