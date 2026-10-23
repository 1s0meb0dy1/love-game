// Две «телефона» (два независимых окна) играют одну игру через общую «базу» в памяти.
const makeEnv = require('../harness.js');
const A = makeEnv(), B = makeEnv(); const res = []; const T = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const rooms = {}; let reqCount = 0;
const route = (E) => { const base = E.w.fetch; E.w.fetch = async (url, opt) => { url = String(url); const m = url.match(/\/live\/(l_[0-9a-f]+)(\/ver)?\.json/); if (!m) return base(url, opt); reqCount++;
  const method = (opt && opt.method) || 'GET', room = m[1], j = (o) => ({ ok: true, status: 200, json: async () => o });
  if (method === 'PUT') { rooms[room] = JSON.parse(opt.body); return j(null); } if (method === 'PATCH') { rooms[room] = { ...(rooms[room] || {}), ...JSON.parse(opt.body) }; return j(null); }
  const doc = rooms[room] || null; return j(m[2] ? (doc ? doc.ver : null) : doc); }; };
route(A); route(B);
const txt = (E) => E.D.body.textContent.replace(/\s+/g, ' ');
const qn = (E) => { const m = txt(E).match(/Вопрос № (\d+)/); return m ? +m[1] : null; };
const who = (E) => { const m = txt(E).match(/Отвечает:\s*(Макс|Аня)/); return m ? m[1] : null; };
(async () => { try {
  A.w.eval(A.code); await sleep(1800);
  const inputs = [...A.D.querySelectorAll('input[type="text"]')]; A.setVal(inputs[0], 'Макс'); A.setVal(inputs[1], 'Аня'); await sleep(200);
  await A.click('Создать сессию', 1200); await A.click('Перейти к игре', 900);
  // второй телефон: та же сессия (профиль скопирован), открыт на главной
  for (let i = 0; i < A.w.localStorage.length; i++) { const k = A.w.localStorage.key(i); B.w.localStorage.setItem(k, A.w.localStorage.getItem(k)); }
  B.w.eval(B.code); await sleep(2200);
  T('второй телефон открыт на главной той же сессии', B.has('Начать игру') && !B.has('Присоединиться'));
  await A.click('Начать игру', 600);
  T('на странице выбора режима есть «С двух телефонов»', A.has('С двух телефонов'));
  await A.click('С двух телефонов', 3800);
  T('телефон 1 (хозяин): игра запущена, идёт рулетка', A.has('Определяем') || A.has('К вопросу'));
  await sleep(3500);
  T('телефон 2: на главной появилось приглашение «Присоединиться»', B.has('Партнёр запустил игру') && B.has('Присоединиться'));
  await A.click('К вопросу', 600);
  await B.click('Присоединиться', 1500);
  T('телефон 2 присоединился: открыт экран игры', B.D.title === 'Игра — ASK ME');
  await sleep(1500);
  if (B.has('К вопросу')) await B.click('К вопросу', 500);
  const qa = qn(A), qb = qn(B), wa = who(A), wb = who(B);
  T('оба телефона видят один и тот же вопрос (№' + qa + ') и одного отвечающего (' + wa + ')', qa && qa === qb && wa && wa === wb);
  await A.click('Далее', 2500);
  T('«Далее» на телефоне 1 → телефон 2 переходит к следующему игроку (' + who(A) + ' = ' + who(B) + ')', who(A) && who(B) === who(A) && who(A) !== wa);
  await B.click('Далее', 2500);
  T('«Далее» на телефоне 2 → телефон 1 видит «Вопрос пройден»', A.has('Вопрос пройден') && B.has('Вопрос пройден'));
  await B.click('Далее', 3800); await sleep(300);
  T('рулетку нового вопроса запустил телефон 2, и телефон 1 видит её тоже', A.has('Определяем') || A.has('К вопросу'));
  await sleep(3000); if (A.has('К вопросу')) await A.click('К вопросу', 400); if (B.has('К вопросу')) await B.click('К вопросу', 400);
  const qa2 = qn(A), qb2 = qn(B); T('новый вопрос одинаков на обоих телефонах (№' + qa2 + ')', qa2 && qa2 === qb2 && qa2 !== qa);
  T('отвечающий на новом вопросе одинаков (' + who(A) + ')', who(A) && who(A) === who(B));
  const doc = Object.values(rooms)[0]; T('в общей «базе» одна комната: версия растёт, история игры хранится строкой, без имён игроков в ней', Object.keys(rooms).length === 1 && doc.ver > 5 && typeof doc.hist === 'string' && !/Макс|Аня/.test(JSON.stringify({ ids: doc.ids, hist: doc.hist })));
  const menuBtn = [...A.D.querySelectorAll('button')].find(b => /Меню/.test(b.textContent) && /btn-sm/.test(b.className)); menuBtn.dispatchEvent(new A.w.MouseEvent('click', { bubbles: true })); await sleep(400);
  [...A.D.querySelectorAll('.viewport-popup-box .grid button')].find(b => b.textContent.trim() !== 'Отмена').dispatchEvent(new A.w.MouseEvent('click', { bubbles: true })); await sleep(1500);
  T('телефон 1 завершил игру → итоги', A.D.title === 'Итоги игры — ASK ME');
  await sleep(3000);
  T('телефон 2 автоматически получил завершение: итоги игры и сообщение', B.D.title === 'Итоги игры — ASK ME');
  T('комната помечена завершённой, чтобы новые приглашения не появлялись', Object.values(rooms)[0].status === 'ended');
  console.log(res.join('\n')); console.log('--- captured runtime errors:', A.errors.length + B.errors.length); [...A.errors, ...B.errors].slice(0, 6).forEach(e => console.log(' ', e)); process.exit(0);
} catch (err) { console.log(res.join('\n')); console.log('TEST CRASH:', err.message.split('\n')[0], '| A:', A.D.title, txt(A).slice(0, 140), '| B:', B.D.title, txt(B).slice(0, 140)); process.exit(1); } })();
