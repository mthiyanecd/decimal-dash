// Regression test for H-04 mock-score run-scoping.
const mockTotal=10;
function oldScore(log){ return Math.min(mockTotal, log.filter(a=>a.mode==='mock'&&a.correct).reduce((t,a)=>t+a.maxMarks,0)); }
function newScore(log, start){ return Math.min(mockTotal, log.filter(a=>a.mode==='mock'&&a.correct&&(a.ts||0)>=start).reduce((t,a)=>t+a.maxMarks,0)); }

// Scenario A: an old completed mock (5 correct at ts 1001-1005) then a NEW run (2 correct at ts 2001-2002, 1 wrong)
const log=[];
for(let t=1001;t<=1005;t++) log.push({mode:'mock',correct:true,maxMarks:1,ts:t});   // old run
log.push({mode:'mock',correct:true,maxMarks:1,ts:2001},{mode:'mock',correct:true,maxMarks:1,ts:2002},{mode:'mock',correct:false,maxMarks:1,ts:2003}); // new run
console.log('A: old code shows', oldScore(log), '(should be 2, inflated by history)');
console.log('A: new code shows', newScore(log,2000), '(current run only)');

// Scenario B: the fake-perfect masking. Old run had a perfect 10; new run scored 0.
const log2=[]; for(let t=1;t<=10;t++) log2.push({mode:'mock',correct:true,maxMarks:1,ts:t});
for(let t=5001;t<=5004;t++) log2.push({mode:'mock',correct:false,maxMarks:1,ts:t});
console.log('B: old code shows', oldScore(log2), '/10 (fake perfect, masks a 0)');
console.log('B: new code shows', newScore(log2,5000), '/10 (true current run)');

const ok = newScore(log,2000)===2 && newScore(log2,5000)===0 && oldScore(log2)===10;
process.exit(ok?0:1);
