// Models the qLock one-shot submit lock + scheduleAdvance token guard (H-04).
let qLock=false, S={cur:{mode:'mock'},session:0,qi:0}, recorded=0, advanced=0, pending=null;
const qToken=()=>S.cur?(S.session+':'+S.qi+':'+S.cur.mode):null;
function scheduleAdvance(){ const tok=qToken(); pending={tok,fire:()=>{ if(!S.cur||qToken()!==tok) return false; S.qi++; advanced++; return true; }}; }
function doCheck(){ if(qLock) return; qLock=true; recorded++; scheduleAdvance(); }

doCheck(); doCheck(); doCheck();                       // rapid triple-tap / Enter spam
console.log('records after 3 rapid submits:', recorded, recorded===1?'(locked ✓)':'(BUG)');

S.qi=5;                                                // another path replaced the question
const stale=pending.fire();
console.log('stale advance fired:', stale, stale?'(BUG)':'(guarded ✓)');

qLock=false; S.qi=0; doCheck(); const norm=pending.fire();
console.log('normal advance once:', norm && advanced===1 ?'(✓)':'(FAIL)');
process.exit(recorded===1 && !stale && norm ?0:1);
