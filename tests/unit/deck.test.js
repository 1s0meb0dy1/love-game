const src=require('../src-loader.js')(); const g=(re)=>src.match(re)[0];
const f=new Function(g(/const DECK_ARC = [^\n]*\n/)+g(/const SHARP_CATS = [^\n]*\n/)+g(/const deckWeight = [\s\S]*?\n        \};\n/)+g(/const buildDeck = [\s\S]*?\n        \};\n/)+'return {buildDeck,deckWeight,DECK_ARC};')();
const out=[]; const t=(n,c)=>out.push((c?'PASS ':'FAIL ')+n);
const cats=['family','intimacy','future','secrets','romance','past','values','fears','money','life']; const lv=['Простые','Средние','Глубокие'];
const mk=(perCell)=>{const a=[];let n=0;cats.forEach(c=>lv.forEach(l=>{for(let i=0;i<perCell;i++)a.push({id:'q'+(n++),categoryId:c,level:l});}));return a;};
const pool=mk(30); // 900 вопросов, поровну
const deck=f.buildDeck(pool);
t('колода — перестановка всего пула (ничего не потеряно и не задвоено)',deck.length===pool.length&&new Set(deck.map(q=>q.id)).size===pool.length);
let worst=0,viol=0; for(let r=0;r<300;r++){ const d=r?f.buildDeck(pool):deck; let run=1; for(let i=1;i<d.length;i++){ if(d[i].categoryId===d[i-1].categoryId){run++; if(run>2) viol++;} else run=1; worst=Math.max(worst,run); } } // 300 колод: раньше тройка в хвосте выпадала примерно в 1% колод
t('одна тема не выпадает больше двух раз подряд, 300 колод (нарушений: '+viol+', максимум подряд: '+worst+')',viol===0&&worst<=2);
// кривая сложности по позициям внутри «акта» из 24 вопросов, усреднение по многим колодам
const share=(lo,hi,level,reps=300)=>{let hit=0,tot=0;for(let r=0;r<reps;r++){const d=f.buildDeck(pool);for(let i=lo;i<=hi;i++){tot++; if(d[i].level===level) hit++;}}return hit/tot;};
const deepStart=share(0,3,'Глубокие'), deepMid=share(10,13,'Глубокие'), deepEnd=share(20,23,'Глубокие'), easyStart=share(0,3,'Простые'), easyMid=share(10,13,'Простые');
t('глубокие вопросы: в начале '+(deepStart*100).toFixed(0)+'% → к середине '+(deepMid*100).toFixed(0)+'% → к концу акта '+(deepEnd*100).toFixed(0)+'%',deepMid>deepStart*3&&deepMid>deepEnd*3);
t('лёгкие вопросы: больше в начале ('+(easyStart*100).toFixed(0)+'%), чем в середине ('+(easyMid*100).toFixed(0)+'%)',easyStart>easyMid*1.6);
const sharpMid=(()=>{let h=0,tt=0;for(let r=0;r<300;r++){const d=f.buildDeck(pool);for(let i=10;i<=13;i++){tt++;if(d[i].categoryId==='intimacy')h++;}}return h/tt;})(), sharpStart=(()=>{let h=0,tt=0;for(let r=0;r<300;r++){const d=f.buildDeck(pool);for(let i=0;i<=3;i++){tt++;if(d[i].categoryId==='intimacy')h++;}}return h/tt;})();
t('«острая» тема (Интим) тоже чаще ближе к середине ('+(sharpStart*100).toFixed(1)+'% → '+(sharpMid*100).toFixed(1)+'%)',sharpMid>sharpStart*1.5);
t('цикл повторяется: во втором «акте» (вопросы 34–37) глубоких снова больше, чем в его начале (24–27)',(()=>{let a=0,b=0,tt=0;for(let r=0;r<300;r++){const d=f.buildDeck(pool);for(let i=0;i<4;i++){tt++;if(d[24+i].level==='Глубокие')a++;if(d[34+i].level==='Глубокие')b++;}}return b>a*2.5;})());
const one=Array.from({length:10},(_,i)=>({id:'o'+i,categoryId:'family',level:'Простые'})); t('одна тема в пуле: вернуть все вопросы (серия неизбежна)',f.buildDeck(one).length===10);
t('пустой и односторонний пул не ломают алгоритм',f.buildDeck([]).length===0&&f.buildDeck([{id:'z',categoryId:'x',level:'Неизвестный'}]).length===1);
const big=mk(61); const t0=Date.now(); const bd=f.buildDeck(big); t('скорость: колода из '+big.length+' вопросов за '+(Date.now()-t0)+' мс',bd.length===big.length&&Date.now()-t0<300);
console.log(out.join('\n'));
