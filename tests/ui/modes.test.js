Object.assign(globalThis, require('../harness.js')());
const FLOW=process.env.FLOW||'player'; const ADMIN=FLOW==='admin';
w.localStorage.setItem('askme_game_settings_v1',JSON.stringify(FLOW==='normal'?{timerOn:true,timerSec:30,punishOn:true,punishments:[{id:'x',text:'Спой припев',level:'any',icon:'🎤',custom:true}]}:{timerOn:false,timerSec:30,punishOn:false,punishments:[{id:'a',text:'Первое',level:'any',icon:'🎭',custom:true},{id:'b',text:'Второе',level:'Простые',icon:'🎭',custom:true},{id:'c',text:'Третье',level:'Средние',icon:'🎭',custom:true},{id:'d',text:'Четвёртое',level:'Глубокие',icon:'🎭',custom:true}]}));
if(ADMIN) w.localStorage.setItem('askme_auth_v2',JSON.stringify({owner:{idToken:'t',refreshToken:'r',expiresAt:Date.now()+3.6e6}}));
const btn=(t)=>[...D.querySelectorAll('button')].find(b=>b.textContent.replace(/\s+/g,' ').trim()===t);
const clickEl=async(el,ms=250)=>{ if(!el) throw new Error('нет элемента'); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(ms); };
(async()=>{ try{
  w.eval(code); await sleep(1800);
  const inputs=[...D.querySelectorAll('input[type="text"]')]; setVal(inputs[0],'Макс'); setVal(inputs[1],'Аня'); await sleep(200);
  await click('Создать сессию',1200); await click('Перейти к игре',900); await click('Начать игру',700);
  const h1=D.querySelector('h1'); T('страница выбора режима: заголовок по центру правее кнопки «Назад»',D.title==='Режим игры — ASK ME'&&h1&&/Выберите режим/.test(h1.textContent)&&/text-center/.test(h1.className)&&/flex-1/.test(h1.className)&&!!D.querySelector('header button[aria-label="Назад"]'));
  T('режимы: «Обычный» и «Усложнённый»'+(ADMIN?' и «Тестовый» для владельца':''),has('Обычный режим')&&has('Усложнённый режим')&&(ADMIN?has('Тестовый режим'):!has('Тестовый режим')));
  if(ADMIN){ console.log(res.join('\n')); console.log('--- captured runtime errors:',errors.length); process.exit(0); }
  if(FLOW==='normal'){
    await click('Обычный режим',3800); await click('К вопросу',700);
    T('обычный режим: настройки (таймер/наказания) не применяются даже если включены в сохранённых',!/Очередь:/.test(D.body.textContent)&&!has('⏱')&&has('Отвечает:'));
    await click('Пропустить вопрос',300); await click('Только',500);
    T('обычный режим: при пропуске наказаний нет',!has('Пропуск вопроса'));
  } else {
    await click('Усложнённый режим',700);
    T('усложнённый режим: отдельная страница и заголовок вкладки',D.title==='Усложнённый режим — ASK ME'&&w.location.hash==='#/setup');
    const start=()=>btn('Начать игру');
    T('«Ничего» выбрать нельзя: кнопка неактивна и есть подсказка под ней',start().disabled&&has('Включите хотя бы одно усложнение'));
    const sw=[...D.querySelectorAll('[role="switch"]')]; await clickEl(sw[1],300);
    T('после включения наказаний кнопка активна, подсказка исчезла',!start().disabled&&!has('Включите хотя бы одно усложнение'));
    T('наказания сгруппированы по сложности без внутренней прокрутки',['Любая сложность','Лёгкие','Средние','Глубокие'].every(t=>[...D.querySelectorAll('h3')].some(h=>h.textContent===t))&&!D.querySelector('[class*="max-h-44"]')&&['Первое','Второе','Третье','Четвёртое'].every(has));
    T('форма «Новое наказание» спрятана под кнопкой',!has('Новое наказание')&&!!btn('+ Добавить наказание'));
    await clickEl(btn('+ Добавить наказание'),300); T('форма раскрылась: заголовок и поля',has('Новое наказание')&&!!D.querySelector('input[aria-label="Текст наказания"]'));
    await clickEl(btn('Добавить'),300); T('пустой текст -> ошибка под полем',has('Опишите наказание'));
    setVal(D.querySelector('input[aria-label="Текст наказания"]'),'Тест-наказание'); await clickEl(btn('Добавить'),400);
    T('наказание добавлено в список, форма свернулась',has('Тест-наказание')&&!has('Новое наказание'));
    await clickEl(start(),3800); await click('К вопросу',700);
    T('усложнённый: применяются включённые опции (наказания) — при пропуске выпадает наказание',(await click('Пропустить вопрос',300),await click('Только',500),has('Пропуск вопроса')));
  }
  console.log(res.join('\n')); console.log('--- captured runtime errors:',errors.length); errors.slice(0,6).forEach(e=>console.log(' ',e)); process.exit(0);
 }catch(err){ console.log(res.join('\n')); console.log('TEST CRASH:',err.message.split('\n')[0],'| title:',D.title,'| body:',D.body.textContent.replace(/\s+/g,' ').slice(0,200)); process.exit(1);} })();
