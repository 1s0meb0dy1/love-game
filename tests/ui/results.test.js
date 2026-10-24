Object.assign(globalThis, require('../harness.js')());
const clickEl=async(el,ms=250)=>{ if(!el) throw new Error('нет элемента'); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(ms); };
(async()=>{ try{
  w.eval(code); await sleep(1800);
  const inputs=[...D.querySelectorAll('input[type="text"]')]; setVal(inputs[0],'Макс'); setVal(inputs[1],'Аня'); await sleep(200);
  await click('Создать сессию',1200); await click('Перейти к игре',900); await click('Начать игру',600); await click('Обычный режим',3800); await click('К вопросу',600);
  await click('Далее',500); await click('Далее',500);           // вопрос 1: ответили оба
  await click('Далее',3800); await click('К вопросу',600);      // вопрос 2
  await click('Пропустить вопрос',300); await click('Для всех',500); // вопрос 2: пропущен для всех
  const menuBtn=[...D.querySelectorAll('button')].find(b=>/Меню/.test(b.textContent)&&/btn-sm/.test(b.className)); await clickEl(menuBtn,400);
  const confirm=[...D.querySelectorAll('.viewport-popup-box .grid button')].find(b=>b.textContent.trim()!=='Отмена'); await clickEl(confirm,500);
  await sleep(1800);
  T('итоги: страница и заголовок вкладки',D.title==='Итоги игры — ASK ME'&&has('Игра завершена'));
  T('имена игроков под заголовком',/Макс\s*·\s*Аня|Аня\s*·\s*Макс/.test(D.body.textContent));
  const ring=D.querySelector('svg circle[style*="stroke-dashoffset"]'); T('кольцо результата: заполнено на долю отвеченных (1 из 2 = 50%)',!!ring&&Math.abs(parseFloat(ring.style.strokeDashoffset)-339.29*0.5)<2);
  T('счётчик «отвечено» показывает 1',/1\s*отвечено/.test(D.body.textContent));
  const labels=['Лёгкие','Средние','Глубокие']; T('три строки сложности с полосами',labels.every(has)&&D.querySelectorAll('div.h-2.rounded-full > div').length===3);
  const widths=[...D.querySelectorAll('div.h-2.rounded-full > div')].map(d=>d.style.width); T('полоса отвеченного уровня заполнена на 100% (остальные 0%)',widths.filter(x=>x==='100%').length===1&&widths.filter(x=>x==='0%').length===2);
  T('пропущено: 1 (вопрос, пропущенный для всех)',/Пропущено\s*1/.test(D.body.textContent.replace(/\s+/g,' ')));
  T('титул-награда показан',/(🏆|💪|🌊|🛡️|🔥|✨)\s*[А-ЯЁ]/.test(D.body.textContent));
  T('конфетти: 26 элементов, скрываются при «уменьшить анимацию» (CSS)',D.querySelectorAll('.confetti-piece').length===26&&/prefers-reduced-motion: reduce\) \{ \.reveal \{ animation: none; opacity: 1; \} \.confetti-layer \{ display: none; \}/.test(html));
  T('ступенчатое появление блоков (reveal + animationDelay)',D.querySelectorAll('.reveal').length>=6&&[...D.querySelectorAll('.reveal')].some(e=>e.style.animationDelay==='460ms'));
  const g=[...D.querySelectorAll('.reveal.grid')][0]; T('кнопки «Играть ещё» и «В меню» 50/50',g&&g.className.includes('grid-cols-2')&&g.children.length===2&&/Играть ещё/.test(g.children[0].textContent)&&/В меню/.test(g.children[1].textContent));
  await click('Играть ещё',500); T('«Играть ещё» открывает выбор режима',has('Выберите режим'));
  console.log(res.join('\n')); console.log('--- captured runtime errors:',errors.length); errors.slice(0,6).forEach(e=>console.log(' ',e)); process.exit(0);
 }catch(err){ console.log(res.join('\n')); console.log('TEST CRASH:',err.message.split('\n')[0],'| title:',D.title,'| body:',D.body.textContent.replace(/\s+/g,' ').slice(0,220)); process.exit(1);} })();
