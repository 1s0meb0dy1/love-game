Object.assign(globalThis, require('../harness.js')());
const ADMIN=process.env.FLOW==='admin'; if(ADMIN) w.localStorage.setItem('askme_auth_v2',JSON.stringify({owner:{idToken:'t',refreshToken:'r',expiresAt:Date.now()+3.6e6}}));
const byLabel=(l)=>[...D.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===l); const clickEl=async(el,ms=250)=>{ if(!el) throw new Error('нет элемента'); el.dispatchEvent(new w.MouseEvent('click',{bubbles:true})); await sleep(ms); };
(async()=>{ try{
  w.eval(code); await sleep(1800);
  const inputs=[...D.querySelectorAll('input[type="text"]')]; setVal(inputs[0],'Макс'); setVal(inputs[1],'Аня'); await sleep(200);
  await click('Создать сессию',1200); await click('Перейти к игре',900); await clickEl(byLabel('Открыть меню'),500);
  const root=D.querySelector('.safe-screen'), main=root.querySelector('main'), footer=root.querySelector('footer');
  T('страница «Меню»: заголовок по центру, вкладка и адрес',D.title==='Меню — ASK ME'&&w.location.hash==='#/more'&&/text-center/.test(root.querySelector('h1').className)&&root.querySelector('h1').textContent==='Меню');
  T('секции «Разделы» и «Настройки», строки-пункты со стрелкой и подписями',has('Разделы')&&has('Настройки')&&has('Игроки и сессия')&&has('Все вопросы')&&has('Архив')&&has('Звук и вибрация'));
  T('ID сессии показан в верхней карточке с подписью',has('ID вашей сессии')&&has('Для восстановления прогресса при выходе'));
  const headings=[...main.querySelectorAll('h2')].map(h=>h.textContent); T('порядок блоков: ID → Разделы → Настройки → «Поделиться игрой»',headings.indexOf('ID сессии')<headings.indexOf('Разделы')&&headings.indexOf('Разделы')<headings.indexOf('Настройки')&&headings.indexOf('Настройки')<headings.indexOf('Поделиться игрой'));
  const btns=[...main.querySelectorAll('button')]; const exit=btns.find(b=>/Выйти из сессии/.test(b.textContent)), share=btns.find(b=>b.textContent.trim()==='Поделиться');
  T('«Поделиться» раскрыт сразу, над ним нет сворачивания; «Выйти из сессии» — самый нижний блок',!!share&&exit===btns[btns.length-1]&&!!(share.compareDocumentPosition(exit)&4));
  T('футер — последний элемент экрана и прижимается к низу (margin-top:auto правилом .safe-screen > footer)',root.lastElementChild===footer&&/\.safe-screen > footer \{ margin-top: auto; \}/.test(html));
  const sw=main.querySelector('[role="switch"]'), before=sw.getAttribute('aria-checked'); await clickEl(sw,200); T('переключатель звука работает и меняет подпись',main.querySelector('[role="switch"]').getAttribute('aria-checked')!==before&&(has('Выключены')||has('Включены')));
  await clickEl(btns.find(b=>/Все вопросы/.test(b.textContent)),500); T('пункт «Все вопросы» ведёт на страницу тем',D.title==='Все темы — ASK ME');
  w.location.hash='#/more'; w.dispatchEvent(new w.HashChangeEvent('hashchange')); await sleep(500);
  if(ADMIN){ T('владелец: пункты «Управление темами» и «Режим владельца»',has('Управление темами')&&has('Режим владельца')); await clickEl([...D.querySelectorAll('main button')].find(b=>/Управление темами/.test(b.textContent)),500); T('«Управление темами» открывает страницу управления',D.title==='Управление темами — ASK ME'); }
  else T('обычный игрок не видит пунктов владельца',!has('Управление темами')&&!has('Режим владельца'));
  await clickEl(byLabel('Назад'),300);
  console.log(res.join('\n')); console.log('--- captured runtime errors:',errors.length); errors.slice(0,6).forEach(e=>console.log(' ',e)); process.exit(0);
 }catch(err){ console.log(res.join('\n')); console.log('TEST CRASH:',err.message.split('\n')[0],'| title:',D.title,'| body:',D.body.textContent.replace(/\s+/g,' ').slice(0,200)); process.exit(1);} })();
