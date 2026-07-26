// Models the qLock one-shot submit lock + scheduleAdvance token guard (H-04).
let qLock=false, S={cur:{mode:'mock'},session:0,qi:0}, recorded=0, advanced=0, pending=null;
const qToken=()=>S.cur?(S.session+':'+S.qi+':'+S.cur.mode):null;
function scheduleAdvance(){ const tok=qToken(); pending={tok,fire:()=>{ if(!S.cur||qToken()!==tok) return false; S.qi++; advanced++; return true; }}; }
function doCheck(){ if(qLock) return; qLock=true; recorded++; scheduleAdvance(); }

doCheck(); doCheck(); doCheck();                       // rapid triple-tap / Enter spam
const rapidRecords=recorded;
console.log('records after 3 rapid submits:', rapidRecords, rapidRecords===1?'(locked ✓)':'(BUG)');

S.qi=5;                                                // another path replaced the question
const stale=pending.fire();
console.log('stale advance fired:', stale, stale?'(BUG)':'(guarded ✓)');

qLock=false; S.qi=0; doCheck(); const norm=pending.fire();
console.log('normal advance once:', norm && advanced===1 ?'(✓)':'(FAIL)');
const coreOk = rapidRecords===1 && !stale && norm && advanced===1;

// --- Extension: rapid double-submit after the FIRST WRONG practice answer ---
// The first wrong answer shows a hint and must LOCK until the answer changes,
// so a second rapid Enter/tap cannot burn the retry on the same value.
let awaitChange=null; qLock=false; let firstWrong=0, secondWrong=0, cur='7';
function practiceCheck(user){
  if(qLock) return;                      // early return while locked
  if(user==='9'){ /* would be correct */ return; }
  if(firstWrong===0){ firstWrong++; qLock=true; awaitChange=String(user); return; } // hint + lock
  secondWrong++;                         // records the wrong attempt (2nd genuine try)
}
function changeAnswer(v){ cur=v; if(awaitChange!=null && String(v)!==awaitChange){ qLock=false; awaitChange=null; } }

practiceCheck(cur); practiceCheck(cur); practiceCheck(cur); // wrong, then two rapid re-taps on SAME value
const gapClosed = firstWrong===1 && secondWrong===0;
console.log('rapid re-tap after first wrong (same value):', gapClosed?'(locked, no burned attempt ✓)':'(BUG double submit)');

changeAnswer('3'); practiceCheck(cur);                     // genuine changed retry counts once
const retryOk = secondWrong===1;
console.log('changed-answer retry records once:', retryOk?'(✓)':'(FAIL)');

// The production apps must implement this same lock (source contract).
import { readSource } from './helpers/load-sync-runtime.mjs';
const contract = ['index.html','paper2/index.html','history-p2/index.html'].every(rel=>{
  const s=readSource(rel).replace(/\s/g,'');
  return /qLock=true;awaitChange=String\(user\)/.test(s) && /functionmaybeUnlock/.test(s);
});
console.log('apps implement first-wrong lock:', contract?'(✓)':'(FAIL)');

process.exit(coreOk && gapClosed && retryOk && contract ?0:1);
