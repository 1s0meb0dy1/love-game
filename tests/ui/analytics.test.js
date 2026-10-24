Object.assign(globalThis, require('../harness.js')());
const FLOW=process.env.FLOW||'player'; const ADMIN=FLOW==='admin'; const reqs=[]; const baseFetch=w.fetch;
const CAT=(id)=>id; const sample={anon:{a1:{createdAt:1700000000000,updatedAt:1700000900000,games:{g1:{startedAt:1700000000000,endedAt:1700000600000,durationSec:600,mode:'hard',timerSec:30,punishOn:true,players:2,answered:10,skipped:2,avgAnswerSec:25,byCat:{family:6,intimacy:4},byLevel:{'Простые':5,'Средние':3,'Глубокие':2},answeredIds:['2','3'],skippedIds:['4','5'],punishCount:3,punishTpl:['Станцуй 15 секунд без музыки','Выпей стакан воды залпом','Станцуй 15 секунд без музыки']}}},a2:{createdAt:1700100000000,updatedAt:1700100500000,games:{g2:{startedAt:1700100000000,endedAt:1700100300000,durationSec:300,mode:'normal',timerSec:0,players:3,answered:4,skipped:0,avgAnswerSec:0,byCat:{family:4},byLevel:{'Простые':4},answeredIds:['6'],skippedIds:[],punishCount:0,punishTpl:[]}}}},
 full:{a1:{createdAt:1700000000000,updatedAt:1700000900000,sid:'ABCD1234',names:['Макс','Аня'],games:{g1:{startedAt:1700000000000,endedAt:1700000600000,durationSec:600,mode:'hard',timerSec:30,punishOn:true,players:2,answered:10,skipped:2,avgAnswerSec:25,byCat:{family:6,intimacy:4},byLevel:{'Простые':5},answeredIds:['2','3'],skippedIds:['4'],punishCount:1,punishTpl:[],perPlayer:[{name:'Макс',answered:6,skipped:1},{name:'Аня',answered:4,skipped:1}],punishAll:['Станцуй 15 секунд без музыки'],customPunishments:['Спой припев']}}},a2:{createdAt:1700100000000,updatedAt:1700100500000,sid:'ZXCV5678',names:['Лев','Мия','Ян'],games:{g2:{startedAt:1700100000000,endedAt:1700100300000,durationSec:300,mode:'normal',timerSec:0,players:3,answered:4,skipped:0,avgAnswerSec:0,byCat:{family:4},byLevel:{'Простые':4},answeredIds:['6'],skippedIds:[],perPlayer:[]}}}}};
let live=JSON.parse(JSON.stringify(sample));
w.fetch=async(url,opt)=>{ url=String(url); const m=url.match(/\/analytics\/(anon|full)(?:\/(\w+))?\.json/); if(m){ const method=(opt&&opt.method)||'GET'; reqs.push({method,kind:m[1],aid:m[2]||null,body:opt&&opt.body?JSON.parse(opt.body):null}); if(method==='GET') return {ok:true,status:200,json:async()=>live[m[1]]}; if(method==='DELETE'&&m[2]) delete live[m[1]][m[2]]; return {ok:true,status:200,json:async()=>null}; } return baseFetch(url,opt); };
if(ADMIN) w.localStorage.setItem('askme_auth_v2',JSON.stringify({owner:{idToken:'t',refreshToken:'r',expiresAt:Date.now()+3.6e6}}));
if(FLOW==='optout') w.localStorage.setItem('askme_analytics_v1','0');
const byLabel=(l)=>[...D.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===l); const clickEl=async(el,ms=250)=>{ if(!el) throw new Error('нет элемента'); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(ms); };
const btn=(t)=>[...D.querySelectorAll('button')].find(b=>b.textContent.replace(/\s+/g,' ').trim().includes(t));
(async()=>{ try{
  w.eval(code); await sleep(1800);
  const inputs=[...D.querySelectorAll('input[type="text"]')]; setVal(inputs[0],'Макс'); setVal(inputs[1],'Аня'); await sleep(200);
  await click('Создать сессию',1200); await click('Перейти к игре',900);
  if(!ADMIN){
    await click('Начать игру',600); await click('Обычный режим',3800); await click('К вопросу',600);
    await click('Далее',500); await click('Далее',500); await click('Далее',3800); await click('К вопросу',600); await click('Пропустить вопрос',300); await click('Для всех',500);
    const menuBtn=[...D.querySelectorAll('button')].find(b=>/Меню/.test(b.textContent)&&/btn-sm/.test(b.className)); await clickEl(menuBtn,400); await clickEl([...D.querySelectorAll('.viewport-popup-box .grid button')].find(b=>b.textContent.trim()!=='Отмена'),800);
    const an=reqs.filter(r=>r.kind==='anon'&&r.method==='PATCH'), fu=reqs.filter(r=>r.kind==='full'&&r.method==='PATCH');
    if(FLOW==='optout'){ T('отказ от статистики: в базу ничего не отправляется',reqs.length===0); }
    else {
      T('после игры отправлены ДВА отдельных отчёта: обезличенный и полный (PATCH)',an.length===1&&fu.length===1&&an[0].aid===fu[0].aid&&/^a[0-9a-f]{16}$/.test(an[0].aid));
      const ag=Object.entries(an[0].body).find(([k])=>k.startsWith('games/'))[1], fg=Object.entries(fu[0].body).find(([k])=>k.startsWith('games/'))[1];
      T('обезличенный отчёт без имён и без ID сессии',!/Макс|Аня/.test(JSON.stringify(an[0].body))&&!('sid' in an[0].body)&&!('names' in an[0].body));
      T('полный отчёт: имена и результаты по игрокам, а ID сессии не отправляется (по ID можно войти в сессию) и стирается из прежних записей',fu[0].body.sid===null&&!/"[A-Z0-9]{8}"/.test(JSON.stringify(fu[0].body.names))&&JSON.stringify(fu[0].body.names)==='["Макс","Аня"]'&&fg.perPlayer.length===2&&fg.perPlayer[0].name==='Макс');
      T('итоги в отчёте: 1 отвечен, 1 пропущен, обычный режим, без таймера',ag.answered===1&&ag.skipped===1&&ag.mode==='normal'&&ag.timerSec===0&&ag.players===2&&typeof ag.durationSec==='number');
    }
  } else {
    await clickEl(byLabel('Открыть меню'),500); T('в меню владельца есть «Аналитика»',has('Аналитика'));
    await clickEl([...D.querySelectorAll('main button')].find(b=>/Аналитика/.test(b.textContent)),900);
    T('обзор: вкладка и адрес',D.title==='Аналитика — ASK ME'&&w.location.hash==='#/analytics');
    const txt=()=>D.body.textContent.replace(/\s+/g,' ');
    // порог аналитики: по умолчанию 50 отвеченных вопросов; полностью пройденные колоды учитываются всегда
    const chipN=(t)=>[...D.querySelectorAll('[aria-label="Минимум отвеченных вопросов"] button')].find(b=>b.textContent.trim()===t);
    T('порог по умолчанию — 50 отвеченных вопросов (выбрана кнопка «50»)',!!chipN('50')&&chipN('50').getAttribute('aria-pressed')==='true'&&has('В аналитику идут игры от'));
    T('в тестовых данных все игры короче 50 → сводка пуста, сказано сколько игр не вошло и что делать',has('Пока нет игр с таким числом отвеченных вопросов')&&has('Не вошло в сводку коротких игр: 2')&&!has('Популярные темы'));
    const g1=live.anon.a1.games.g1;
    live.anon.a1.games.g2={...g1,startedAt:1700001000000,endedAt:1700001900000,answered:60,skipped:0}; live.anon.a1.games.g3={...g1,startedAt:1700002000000,endedAt:1700002900000,answered:5,skipped:0,complete:1}; live.anon.a1.games.g4={...g1,startedAt:1700003000000,endedAt:1700003900000,answered:12,skipped:0,partial:1};
    await clickEl(btn('Обновить данные'),900);
    const tileGames=()=>{ const t=[...D.querySelectorAll('.font-display')].find(e=>e.nextElementSibling&&/Игр в сводке/.test(e.nextElementSibling.textContent)); return t?+t.textContent:null; };
    const expectN=(min)=>Object.values(live.anon).flatMap(r=>Object.values(r.games)).filter(g=>g.complete||g.answered>=min).length;
    T('порог 50: в сводке игра с 60 ответами и полностью пройденная (5 ответов), остальное скрыто ('+expectN(50)+')',tileGames()===expectN(50)&&expectN(50)===2&&has('Не вошло в сводку коротких игр: 3'));
    await clickEl(chipN('10'),400); T('порог 10: добавилась игра с 12 ответами и с 10 ('+expectN(10)+')',tileGames()===expectN(10)&&expectN(10)===4&&w.localStorage.getItem('askme_an_min_v1')==='10');
    await clickEl(chipN('Любых'),400); T('«Любых»: в сводке все игры ('+expectN(0)+'), порог сохранён в браузере владельца',tileGames()===expectN(0)&&expectN(0)===5&&w.localStorage.getItem('askme_an_min_v1')==='0'&&!has('Не вошло в сводку'));
    delete live.anon.a1.games.g2; delete live.anon.a1.games.g3; delete live.anon.a1.games.g4; await clickEl(btn('Обновить данные'),900);
    T('обзор: сводка по обезличенным данным (2 сессии, 2 игры, ср. игроков 2.5)',/Сессий/.test(txt())&&/2Сессий|2 Сессий/.test(txt().replace(/\s/g,''))&&has('Игр в сводке')&&has('2.5')&&has('Игроков в игре'));
    T('обзор: темы, сложность, пропускаемые вопросы, таймер и наказания',has('Популярные темы')&&has('Сложность отвеченных вопросов')&&has('Чаще всего пропускают')&&/Таймер включали в 50% игр, в среднем на 30 с/.test(txt())&&/×2\s*Станцуй 15 секунд/.test(txt()));
    T('обзор не показывает имён',!has('Макс')&&!has('Аня'));
    await clickEl(btn('Сессии'),600); T('отдельная страница «Сессии» (список с именами; ID сессии, оставшийся в старой записи, не показывается)',D.title==='Сессии — Аналитика — ASK ME'&&has('Макс · Аня')&&!has('ABCD1234')&&has('Лев · Мия · Ян'));
    await clickEl(btn('Обезличенные'),300); T('обезличенный список: без имён и ID',has('Сессия №')&&!has('Макс')&&!has('ABCD1234'));
    await clickEl(btn('Полные данные'),300); await clickEl(btn('Макс · Аня'),400);
    T('карточка сессии: имена, ключ записи (не ID сессии), игры, таймер/наказания, по игрокам, списки',has('Ключ записи:')&&!has('ABCD1234')&&has('Усложнённый')&&has('⏱ Таймер: 30 с')&&has('Макс: 6 отв. / 1 проп.')&&has('Отвеченные вопросы (2)')&&has('Свои наказания игроков (1)')&&has('Выпавшие наказания (1)'));
    await clickEl(btn('Удалить сессию'),200); T('удаление в два шага: сначала просит подтверждения',has('Точно удалить?')&&!reqs.some(r=>r.method==='DELETE'));
    await clickEl(btn('Точно удалить?'),600); const dels=reqs.filter(r=>r.method==='DELETE');
    T('удалены ОБА набора данных сессии (anon и full)',dels.length===2&&dels.every(d=>d.aid==='a1')&&new Set(dels.map(d=>d.kind)).size===2);
    T('после удаления возврат к списку без этой сессии',has('Лев · Мия · Ян')&&!has('Макс · Аня'));
  }
  console.log(res.join('\n')); console.log('--- captured runtime errors:',errors.length); errors.slice(0,6).forEach(e=>console.log(' ',e)); process.exit(0);
 }catch(err){ console.log(res.join('\n')); console.log('TEST CRASH:',err.message.split('\n')[0],'| title:',D.title,'| body:',D.body.textContent.replace(/\s+/g,' ').slice(0,220)); process.exit(1);} })();
