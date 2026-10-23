const src=require('../src-loader.js')();
const g=(re)=>src.match(re)[0];
const f=new Function(g(/const normTurn = [\s\S]*?\n        \};\n/)+g(/const isTurnSkipped = [^\n]*\n/)+g(/const nextTurnStep = [\s\S]*?\n        \};\n/)+'return {normTurn,isTurnSkipped,nextTurnStep};')();
let bad=0,runs=0,allSkipRuns=0;
for(let n=1;n<=10;n++) for(let r=0;r<400;r++){
  const P=Array.from({length:n},(_,i)=>({id:'p'+i})); const pSkip=[0,0.3,1][r%3]; runs++;
  let e={cur:P[Math.floor(Math.random()*n)].id,answered:[],skippedBy:[],skippedAll:false}; const seen=[e.cur]; let ok=false;
  for(let k=0;k<40;k++){
    const skip=Math.random()<pSkip; const cur=skip?{...e,skippedBy:[...e.skippedBy,e.cur]}:e;
    const st=f.nextTurnStep(cur,P); if(!st){ ok=true; break; }
    if(st.type==='done'){ e=st.entry; continue; }
    if(st.type==='auto'){ e=st.entry; seen.push(e.cur); continue; }
    if(st.candidates.some(c=>st.answered.includes(c.id))){bad++;break;}
    e={cur:st.candidates[Math.floor(Math.random()*st.candidates.length)].id,answered:st.answered,skippedBy:st.skippedBy,skippedAll:false}; seen.push(e.cur);
  }
  const allSk=P.every(p=>e.skippedBy.includes(p.id)); if(allSk) allSkipRuns++;
  if(!(ok&&new Set(seen).size===n&&e.answered.length===n&&f.isTurnSkipped(e,P)===allSk)) bad++;
}
const P2=[{id:'a'},{id:'b'}];
{ const a=runs-bad, b=runs; console.log((a===b?'PASS ':'FAIL ')+`skip/answer queue (1..10 players): ${a}/${b} passed (чисто пропущенных вопросов: ${allSkipRuns})`); }
console.log('skipAll flag ->', f.isTurnSkipped({cur:null,answered:['a','b'],skippedBy:[],skippedAll:true},P2), '| partial skip ->', f.isTurnSkipped({cur:null,answered:['a','b'],skippedBy:['a'],skippedAll:false},P2), '| legacy ->', f.isTurnSkipped(f.normTurn('a'),P2));
