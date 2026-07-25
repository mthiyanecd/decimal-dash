// Regression test for M-02 deep hydration.
const cleanName=s=>String(s||'').trim().replace(/[\s\-−]+$/,'');
const DEFAULT={ name:'', session:0, cur:null,
  mastery:{s1:50,s2:50,s3:50,s4:50,s5:50,s6:50,s7:50,s8:50},
  done:[false,false,false,false,false,false,false,false,false],
  stretch:[false,false,false,false,false,false,false,false,false],
  overrides:{}, comments:{} };
const SCHEMA=1;
function hydrateState(saved){
  const base=JSON.parse(JSON.stringify(DEFAULT));
  if(saved&&typeof saved==='object'){
    for(const k in base){ const dv=base[k], sv=saved[k]; if(sv===undefined) continue;
      if(Array.isArray(dv)){ if(Array.isArray(sv)){ const out=dv.slice(); for(let i=0;i<sv.length;i++) out[i]=sv[i]; base[k]=out; } }
      else if(dv&&typeof dv==='object'){ base[k]=Object.assign({},dv,(sv&&typeof sv==='object')?sv:{}); }
      else base[k]=sv; }
    if(base.mastery&&DEFAULT.mastery){ for(const sk in DEFAULT.mastery){ let v=Number(base.mastery[sk]); if(!isFinite(v)) v=DEFAULT.mastery[sk]; base.mastery[sk]=Math.max(0,Math.min(100,v)); } }
  }
  base.name=cleanName(base.name); base.schemaVersion=SCHEMA; return base;
}
// An old/malformed save: only some skills, a non-numeric mastery, an out-of-range one, a short done array
const saved={ name:'Zimmy -', session:3, mastery:{s1:70,s2:'oops',s6:120}, done:[true,true] };
const h=hydrateState(saved);
const checks={
 'new skill s8 backfilled':      h.mastery.s8===50,
 'invalid mastery s2 -> default':h.mastery.s2===50,
 'out-of-range s6 clamped to 100':h.mastery.s6===100,
 'kept s1':                      h.mastery.s1===70,
 'done padded to 9':             h.done.length===9,
 'done[0]/[1] preserved':        h.done[0]===true&&h.done[1]===true,
 'done[8] default false':        h.done[8]===false,
 'session kept':                 h.session===3,
 'name cleaned':                 h.name==='Zimmy',
 'schema stamped':               h.schemaVersion===1,
};
let ok=true; for(const [k,v] of Object.entries(checks)){ console.log((v?'✓':'✗'),k); ok=ok&&v; }
process.exit(ok?0:1);
