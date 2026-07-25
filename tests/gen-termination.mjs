// Regression test for M-01 (Decimal Dash subtraction generator freeze).
// Replicates the exact old vs new logic and proves termination + validity.
const ri=(a,b)=>a+Math.floor(Math.random()*(b-a+1));
function randV(dp,maxWhole){ const w=ri(0,maxWhole); let f; do{ f=ri(1,Math.pow(10,dp)-1);}while(f%10===0); return w*Math.pow(10,dp)+f; }

// OLD (buggy): bounded to detect the non-termination instead of hanging the test.
function oldS(forceA){ let a=forceA??randV(2,ri(10,90)); let b=randV(2,ri(1,8)); let guard=0;
  while(b>=a){ b=randV(2,ri(1,5)); if(++guard>100000) return {froze:true,a}; } return {froze:false,a,b}; }
// NEW (fixed):
function newS(forceA){ let a=Math.max(2, forceA??randV(2,ri(10,90))); let b=randV(2,ri(1,8)); if(b>=a) b=ri(1,a-1); return {a,b}; }

// 1) Prove the old code freezes when a===1 (0,01)
const bug=oldS(1);
console.log('OLD with a=1 (0,01):', bug.froze ? 'FREEZES (bug reproduced)' : 'ok');

// 2) Prove the new code always terminates and yields a valid 0<b<a, across the pathological range + random
let bad=0, minA=Infinity;
for(let i=0;i<200000;i++){ const forceA = i<50 ? i%3 : undefined; const r=newS(forceA); minA=Math.min(minA,r.a); if(!(r.b>=1 && r.b<r.a)) bad++; }
console.log('NEW over 200000 (incl a=0,1,2):', bad===0 ? 'all valid 0<b<a, always terminates' : (bad+' invalid'));
console.log('NEW min a seen:', minA, '(never below 2)');
process.exit(bad===0 && bug.froze ? 0 : 1);
