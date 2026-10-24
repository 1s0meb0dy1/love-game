Object.assign(globalThis, require('../harness.js')());
const FLOW=process.env.FLOW||'admin'; const ADMIN=FLOW==='admin'; const patches=[]; const baseFetch=w.fetch;
w.fetch=async(url,opt)=>{ url=String(url); if(opt&&opt.method==='PATCH'&&url.includes('/questions')){ patches.push({url,body:JSON.parse(opt.body)}); return {ok:true,status:200,json:async()=>null}; } return baseFetch(url,opt); };
if(ADMIN) w.localStorage.setItem('askme_auth_v2',JSON.stringify({owner:{idToken:'t',refreshToken:'r',expiresAt:Date.now()+3.6e6}}));
else Object.keys(qs).filter(k=>/^\d+$/.test(k)).slice(0,50).forEach(k=>{ qs[k]={...qs[k],hidden:true}; });
const byLabel=(l)=>[...D.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===l); const allByLabel=(l)=>[...D.querySelectorAll('button')].filter(b=>b.getAttribute('aria-label')===l);
const clickEl=async(el,ms=250)=>{ if(!el) throw new Error('нет элемента'); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(ms); };
const btn=(t)=>[...D.querySelectorAll('button')].find(b=>b.textContent.replace(/\s+/g,' ').trim().includes(t));
(async()=>{ try{
  w.eval(code); await sleep(1800);
  const inputs=[...D.querySelectorAll('input[type="text"]')]; setVal(inputs[0],'Макс'); setVal(inputs[1],'Аня'); await sleep(200);
  await click('Создать сессию',1200); await click('Перейти к игре',900);
  if(!ADMIN){
    T('игрок: скрытые вопросы полностью исчезли из счётчиков (всего − 50)',has(String(qCount-50))&&!has(String(qCount)));
    await click('Начать игру',600); await click('Обычный режим',3800); await click('К вопросу',600);
    T('игра с колодой нового алгоритма запускается (рулетка и вопрос на экране)',has('Отвечает:')&&/Вопрос № \d+/.test(D.body.textContent));
  } else {
    w.location.hash='#/topics'; w.dispatchEvent(new w.HashChangeEvent('hashchange')); await sleep(600);
    await clickEl(btn('Семья'),600);
    T('владелец: в списке вопросов у каждого есть кнопка «🙈 Скрыть для всех»',allByLabel('Скрыть вопрос для всех').length>=5);
    await clickEl(byLabel('Скрыть вопрос для всех'),500);
    const p=patches[0]; T('скрытие: PATCH в базу {hidden:true, hiddenAt} на нужный вопрос',!!p&&/\/questions\/\w+\.json/.test(p.url)&&p.body.hidden===true&&typeof p.body.hiddenAt==='number');
    T('вопрос помечен «Скрыт», кнопка сменилась на «Вернуть вопрос»',has('Скрыт')&&!!byLabel('Вернуть вопрос'));
    await clickEl(allByLabel('Скрыть вопрос для всех')[0],500); T('скрыт второй вопрос',patches.length===2);
    w.location.hash='#/more'; w.dispatchEvent(new w.HashChangeEvent('hashchange')); await sleep(500);
    T('меню владельца: «Скрытые вопросы» с количеством (2)',has('Скрытые вопросы')&&has('Сейчас скрыто: 2'));
    await clickEl([...D.querySelectorAll('main button')].find(b=>/Скрытые вопросы/.test(b.textContent)),500);
    T('страница скрытых: заголовок вкладки, адрес, список с кнопками «Вернуть»',D.title==='Скрытые вопросы — ASK ME'&&w.location.hash==='#/questions/hidden'&&[...D.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Вернуть').length===2);
    await clickEl([...D.querySelectorAll('button')].find(b=>b.textContent.trim()==='Вернуть'),500);
    const p3=patches[2]; T('возврат: PATCH {hidden:null}; в списке остался 1',p3&&p3.body.hidden===null&&[...D.querySelectorAll('button')].filter(b=>b.textContent.trim()==='Вернуть').length===1);
    await clickEl(btn('Вернуть все'),200); T('«Вернуть все» просит подтверждения',has('Точно вернуть все (1)'));
    await clickEl(btn('Точно вернуть все'),600); const p4=patches[3]; T('массовый возврат одним запросом на узел вопросов (multi-path PATCH)',p4&&/\/questions\.json/.test(p4.url)&&Object.values(p4.body).every(v=>v===null)&&Object.keys(p4.body).length===2);
    T('после возврата — «Скрытых вопросов нет»',has('Скрытых вопросов нет'));
  }
  console.log(res.join('\n')); console.log('--- captured runtime errors:',errors.length); errors.slice(0,6).forEach(e=>console.log(' ',e)); process.exit(0);
 }catch(err){ console.log(res.join('\n')); console.log('TEST CRASH:',err.message.split('\n')[0],'| title:',D.title,'| body:',D.body.textContent.replace(/\s+/g,' ').slice(0,220)); process.exit(1);} })();
