const src=require('../src-loader.js')();
const grab=(re)=>src.match(re)[0];
const code=grab(/const normTurn = [\s\S]*?\n        \};\n/)+grab(/const nextTurnStep = [\s\S]*?\n        \};\n/)+grab(/const REEL = [^\n]*\n/)+grab(/const reelTarget = [^\n]*\n/)+grab(/const reelGeometry = [\s\S]*?\n        \};\n/)+'return {nextTurnStep,normTurn,REEL,reelTarget,reelGeometry};';
const f=new Function(code)(); let fails=0, runs=0;
// 1) очередь: каждый игрок отвечает ровно один раз, исключения работают, всегда ровно N нажатий «Далее» до «Вопрос пройден»
for(let n=1;n<=10;n++) for(let rep=0;rep<300;rep++){
  const players=Array.from({length:n},(_,i)=>({id:'p'+i,name:'P'+i,gender:i%2?'girl':'guy'}));
  let entry={cur:players[Math.floor(Math.random()*n)].id,answered:[]}; const order=[entry.cur]; let presses=0, ended=false; runs++;
  for(let guard=0;guard<30;guard++){
    const st=f.nextTurnStep(entry,players); presses++;
    if(!st){ ended=true; break; }
    if(st.type==='done'){ entry=st.entry; continue; }
    if(st.type==='auto'){ entry=st.entry; order.push(entry.cur); continue; }
    if(st.candidates.some(c=>st.answered.includes(c.id))) {fails++; break;}
    const w=st.candidates[Math.floor(Math.random()*st.candidates.length)].id; entry={cur:w,answered:st.answered}; order.push(w);
  }
  if(!(ended && new Set(order).size===n && order.length===n && presses===n+1 && !entry.cur && entry.answered.length===n)) fails++;
}
{ const a=runs-fails, b=runs; console.log((a===b?'PASS ':'FAIL ')+`turn queue (1..10 players): ${a}/${b} passed`); }
// 2) совместимость со старым форматом сохранений
const P=[{id:'p1'},{id:'p2'}];
console.log('legacy string ->', JSON.stringify(f.normTurn('p1')), '| legacy array ->', JSON.stringify(f.normTurn([{id:'p1'},{id:'p2'}])), '| empty ->', f.normTurn(null));
// 3) рулетка: под меткой всегда победитель, для 2..10 игроков и разных ширин
let g=0,gt=0;
for(let k=2;k<=10;k++) for(let wi=0;wi<k;wi++) for(const w of [240,300,360,420]) for(let r=0;r<40;r++){
  const t=f.reelTarget(k,wi), jit=(Math.random()-0.5)*f.REEL.CARD*0.5, geo=f.reelGeometry(w,t,jit), stride=f.REEL.CARD+f.REEL.GAP;
  const idx=Math.floor((w/2-geo.final)/stride), within=(w/2-geo.final)-idx*stride, count=t+8;
  const startCenter=Math.floor((w/2-geo.start)/stride), endRight=Math.ceil((w-geo.final)/stride);
  gt++; if(idx===t && t%k===wi && within<f.REEL.CARD && startCenter-2>=0 && endRight<count) g++;
}
{ const a=g, b=gt; console.log((a===b?'PASS ':'FAIL ')+`reel landing (2..10 players): ${a}/${b} passed`); }
