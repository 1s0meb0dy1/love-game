Object.assign(globalThis, require('../harness.js')());
const FLOW=process.env.FLOW||'player'; const ADMIN=FLOW==='admin'; const puts=[]; let dbData=null; const baseFetch=w.fetch;
w.fetch=async(url,opt)=>{ url=String(url); if(url.includes('/punishments.json')){ if(opt&&opt.method==='PUT'){ const b=JSON.parse(opt.body); puts.push(b); dbData=b; return {ok:true,status:200,json:async()=>null}; } return {ok:true,status:200,json:async()=>dbData}; } return baseFetch(url,opt); };
if(ADMIN) w.localStorage.setItem('askme_auth_v2',JSON.stringify({owner:{idToken:'t',refreshToken:'r',expiresAt:Date.now()+3.6e6}}));
else { dbData={a:{id:'a',text:'Шаблон из базы 1',level:'Простые',icon:'💧',n:0},b:{id:'b',text:'Шаблон из базы 2',level:'Глубокие',icon:'🫶',n:1},bad:{id:'bad',text:'',level:'Простые'},bad2:{id:'x',text:'Нет уровня',level:'Невозможный'}};
  w.localStorage.setItem('askme_game_settings_v1',JSON.stringify({timerOn:false,timerSec:30,punishOn:true,punishments:[{id:'u1',text:'Моё наказание',level:'any',icon:'🎤',custom:true},{id:'old1',text:'Старый шаблон',level:'any'}],hiddenTemplates:[]})); }
const byLabel=(l)=>[...D.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===l); const btn=(t)=>[...D.querySelectorAll('button')].find(b=>b.textContent.replace(/\s+/g,' ').trim()===t);
const clickEl=async(el,ms=250)=>{ if(!el) throw new Error('нет элемента'); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(ms); };
(async()=>{ try{
  w.eval(code); await sleep(1800);
  const inputs=[...D.querySelectorAll('input[type="text"]')]; setVal(inputs[0],'Макс'); setVal(inputs[1],'Аня'); await sleep(200);
  await click('Создать сессию',1200); await click('Перейти к игре',900);
  if(!ADMIN){
    await click('Начать игру',600); await click('Усложнённый режим',700);
    T('шаблоны из БД показаны в игре (валидные), прошлые встроенные/старые не показываются, свои сохранены',has('Шаблон из базы 1')&&has('Шаблон из базы 2')&&has('Моё наказание')&&!has('Старый шаблон')&&!has('Выпей стакан воды')&&!has('Нет уровня'));
    await clickEl(byLabel('Скрыть наказание'),300); T('у шаблона кнопка «Скрыть» (у своего — «Удалить»): шаблон скрыт, появилась ссылка «Вернуть скрытые (1)»',!has('Шаблон из базы 1')&&has('Вернуть скрытые (1)')&&!!byLabel('Удалить наказание'));
    await clickEl(btn('Вернуть скрытые (1)'),300); T('«Вернуть скрытые» возвращает шаблон',has('Шаблон из базы 1'));
    await clickEl(byLabel('Скрыть наказание'),300);
    const st=[...D.querySelectorAll('button')].reverse().find(b=>b.textContent.trim()==='Начать игру'); await clickEl(st,3800); await click('К вопросу',700); await click('Пропустить вопрос',300); await click('Только',500);
    T('при пропуске выпадает наказание только из доступных (не скрытый шаблон)',has('Пропуск вопроса')&&(has('Шаблон из базы 2')||has('Моё наказание'))&&!has('Шаблон из базы 1')&&!has('Старый шаблон'));
  } else {
    await clickEl(byLabel('Открыть меню'),500); T('в меню владельца есть «Шаблоны наказаний»',has('Шаблоны наказаний'));
    await clickEl([...D.querySelectorAll('main button')].find(b=>/Шаблоны наказаний/.test(b.textContent)),500);
    T('страница управления: заголовок вкладки и адрес',D.title==='Шаблоны наказаний — ASK ME'&&w.location.hash==='#/punishments/manage');
    T('если в БД шаблонов ещё нет, показан встроенный набор (8) по группам',has('Выпей стакан воды')&&has('Любая сложность')&&has('Глубокие')&&D.querySelectorAll('main section [aria-label^="Изменить:"]').length===8);
    await clickEl(btn('+ Новый шаблон'),300); await clickEl(btn('Сохранить'),200); T('пустой текст -> ошибка под полем',has('Опишите наказание'));
    setVal(D.querySelector('input[aria-label="Эмодзи шаблона"]'),'x'); setVal(D.querySelector('input[aria-label="Текст наказания"]'),'Тестовый шаблон'); await clickEl(btn('Сохранить'),200); T('не эмодзи -> «Введите эмодзи»',has('Введите эмодзи'));
    setVal(D.querySelector('input[aria-label="Эмодзи шаблона"]'),'🎯'); const sel=D.querySelector('select[aria-label="Для какой сложности вопроса"]'); Object.getOwnPropertyDescriptor(w.HTMLSelectElement.prototype,'value').set.call(sel,'Средние'); sel.dispatchEvent(new w.Event('change',{bubbles:true})); await sleep(100);
    await clickEl(btn('Сохранить'),600); const p1=puts[0]; const ent=p1&&Object.values(p1);
    T('новый шаблон записан в БД: 9 записей, поля id/text/level/icon/n, порядок 0..8',!!p1&&ent.length===9&&ent.some(e=>e.text==='Тестовый шаблон'&&e.level==='Средние'&&e.icon==='🎯')&&ent.map(e=>e.n).sort((a,b)=>a-b).join()==='0,1,2,3,4,5,6,7,8');
    T('шаблон сразу виден в списке',has('Тестовый шаблон'));
    await clickEl(D.querySelector('[aria-label^="Изменить:"]'),300); const ti=D.querySelector('input[aria-label="Текст наказания"]'); T('редактирование: форма заполнена текущим текстом',ti.value.length>3&&has('Редактирование шаблона'));
    setVal(ti,'Изменённый текст'); await clickEl(btn('Сохранить'),600); T('изменение записано в БД (без потери остальных)',puts.length===2&&Object.values(puts[1]).length===9&&Object.values(puts[1]).some(e=>e.text==='Изменённый текст'));
    const del=D.querySelector('[aria-label^="Удалить:"]'); await clickEl(del,200); T('удаление в два шага: первое нажатие просит «Точно?»',has('Точно?')&&puts.length===2);
    await clickEl(D.querySelector('[aria-label="Подтвердить удаление"]'),600); T('второе нажатие удаляет и записывает 8 шаблонов',puts.length===3&&Object.values(puts[2]).length===8);
  }
  console.log(res.join('\n')); console.log('--- captured runtime errors:',errors.length); errors.slice(0,6).forEach(e=>console.log(' ',e)); process.exit(0);
 }catch(err){ console.log(res.join('\n')); console.log('TEST CRASH:',err.message.split('\n')[0],'| title:',D.title,'| body:',D.body.textContent.replace(/\s+/g,' ').slice(0,200)); process.exit(1);} })();
