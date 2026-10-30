// Режим «Правда или действие»: админка карточек (#/tod/manage) — доступ только владельцу, добавление, правка, скрытие, повторы, ошибки записи,
// разовая загрузка стартового набора. База — в памяти по правилам из tests/fixtures/tod-rules.json: пишет только токен владельца ('owner-tok').
// Заодно проверяется, что сохранённая карточка сразу видна в архиве («Все вопросы» -> «Действие») без перезагрузки и попадает в кэш устройства.
const makeEnv = require('../harness.js'); const makeDb = require('../fake-rtdb.js'); const { loadTod } = require('../tod-load.js');
const KEY = 'askme_tod_cards_v1'; const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const res = []; const T = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
const { TOD_STARTER } = loadTod(['content/tod-cards.js'], ['TOD_STARTER']);
const card = (o) => ({ isActive: true, ...o });
const SEED = {
  td_a: card({ id: 'td_a', type: 'truth', difficulty: 'easy', text: 'Вопрос про лето?', updatedAt: 1 }),
  td_b: card({ id: 'td_b', type: 'truth', difficulty: 'hard', text: 'Вопрос про секрет?', updatedAt: 2 }),
  td_c: card({ id: 'td_c', type: 'dare', difficulty: 'medium', text: 'Станцуй без музыки', updatedAt: 3, isActive: false })
};
const errs = [];
const NEW_TEXT = 'Изобрази кота, который увидел огурец';

// запуск приложения: профиль, меню; opts: owner — вход владельца, seed — карточки в базе, hook(db, E) — подмена до старта (например, поломать сеть)
const open = async (opts) => {
  const E = makeEnv(); const db = makeDb({ ownerToken: 'owner-tok' }); db.attach(E); if (opts.seed) db.seedTod(opts.seed);
  if (opts.owner) E.w.localStorage.setItem('askme_auth_v2', JSON.stringify({ owner: { idToken: 'owner-tok', refreshToken: 'r', expiresAt: Date.now() + 3.6e6 } }));
  const gate = { failRead: false, failWrite: false }; const base = E.w.fetch; // переключатели сбоев: чтение tod.json / запись карточек
  E.w.fetch = async (url, init) => {
    const u = String(url); const isW = /\/tod\/[^/]+\.json/.test(u); const isR = /\/tod\.json/.test(u);
    if (gate.failRead && isR) throw new TypeError('network');
    if (gate.failWrite && isW) throw new TypeError('network');
    return base(url, init);
  };
  E.w.eval(E.code); await sleep(1800);
  const inputs = [...E.D.querySelectorAll('input[type="text"]')]; E.setVal(inputs[0], 'Макс'); E.setVal(inputs[1], 'Аня'); await sleep(200);
  await E.click('Создать сессию', 1200); await E.click('Перейти к игре', 900);
  const q = (s) => E.D.querySelector(s); const qa = (s) => [...E.D.querySelectorAll(s)];
  const press = async (el, ms = 300) => { if (!el) throw new Error('нет элемента'); el.dispatchEvent(new E.w.MouseEvent('click', { bubbles: true })); await sleep(ms); };
  const byLabel = (l) => qa('button').find(b => b.getAttribute('aria-label') === l);
  const btnText = (t) => qa('button').find(b => b.textContent.replace(/\s+/g, ' ').trim() === t);
  const openMenu = async () => press(byLabel('Открыть меню'), 500);
  const openAdmin = async () => { await openMenu(); await press(qa('main button').find(b => /Правда или действие/.test(b.textContent)), 600); };
  // кнопка внутри группы с aria-label (фильтры: «Фильтр по типу», «Фильтр по уровню»; форма: «Тип карточки», «Уровень карточки»)
  const pick = async (group, text, ms = 250) => { const g = q('[aria-label="' + group + '"]'); const b = g && [...g.querySelectorAll('button')].find(x => x.textContent.trim() === text); if (!b) throw new Error('нет кнопки «' + text + '» в группе «' + group + '»'); return press(b, ms); };
  const setText = (v) => { const ta = q('textarea[aria-label="Текст карточки"]'); Object.getOwnPropertyDescriptor(E.w.HTMLTextAreaElement.prototype, 'value').set.call(ta, v); ta.dispatchEvent(new E.w.Event('input', { bubbles: true })); };
  const lastTod = () => db.tod();
  const puts = () => db.log.filter(l => l.method === 'PUT' && /^tod\//.test(l.path)).length;
  return { E, db, gate, q, qa, press, pick, byLabel, btnText, openMenu, openAdmin, setText, lastTod, puts, close() { errs.push(...E.errors); try { E.w.close(); } catch (e) {} } };
};
const sameCard = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  // ---------- игрок без токена владельца ----------
  const P = await open({ seed: SEED });
  await P.openMenu();
  T('игрок: в меню нет зоны владельца и пункта «Правда или действие»', !P.E.has('Только для владельца') && !P.E.has('Правда или действие') && !P.E.has('Карточки: добавить'));
  P.E.w.location.hash = '#/tod/manage'; P.E.w.dispatchEvent(new P.E.w.HashChangeEvent('hashchange')); await sleep(600);
  T('игрок по прямой ссылке #/tod/manage видит «Раздел доступен только владельцу.», без карточек и кнопок записи', P.E.has('Раздел доступен только владельцу.') && !P.E.has('Вопрос про лето?') && !P.btnText('+ Новая карточка') && P.db.stats.writes === 0);
  P.close();

  // ---------- владелец ----------
  const A = await open({ owner: true, seed: SEED }); const { E, db } = A;
  await A.openMenu();
  const zone = A.q('section[aria-label="Только для владельца"]');
  T('владелец: в зоне «видите только вы» есть пункт «Правда или действие» с подписью «Карточки: добавить, изменить, скрыть»', !!zone && zone.textContent.includes('Правда или действие') && zone.textContent.includes('Карточки: добавить, изменить, скрыть'));
  await A.press([...zone.querySelectorAll('button')].find(b => /Правда или действие/.test(b.textContent)), 600);
  T('страница: заголовок вкладки и адрес', E.D.title === 'Карточки — Правда или действие — ASK ME' && E.w.location.hash === '#/tod/manage');
  T('список из базы: все три карточки видны владельцу (и скрытая с меткой «скрыта»)', ['Вопрос про лето?', 'Вопрос про секрет?', 'Станцуй без музыки'].every(t => E.has(t)) && A.qa('.tag').some(t => t.textContent.includes('скрыта')));
  T('на экране одна главная кнопка: «+ Новая карточка»', A.qa('.btn-primary').length === 1 && !!A.btnText('+ Новая карточка'));

  // фильтры
  await A.pick('Фильтр по типу', 'Действие'); T('фильтр по типу «Действие» оставляет только «Действие»', E.has('Станцуй без музыки') && !E.has('Вопрос про лето?'));
  await A.pick('Фильтр по типу', 'Правда'); await A.pick('Фильтр по уровню', 'Жёсткие'); T('фильтр «Правда» + «Жёсткие»: одна карточка', E.has('Вопрос про секрет?') && !E.has('Вопрос про лето?') && !E.has('Станцуй без музыки'));
  await A.pick('Фильтр по типу', 'Все'); await A.pick('Фильтр по уровню', 'Жёсткие'); T('нажатие на выбранный уровень не ломает список (остаётся «Жёсткие»)', E.has('Вопрос про секрет?') && !E.has('Станцуй без музыки'));
  await A.pick('Фильтр по уровню', 'Все уровни'); T('«Все» и «Все уровни» возвращают весь список', E.has('Вопрос про лето?') && E.has('Станцуй без музыки'));

  // форма: пустой текст
  await A.press(A.btnText('+ Новая карточка'));
  T('«+ Новая карточка» открывает отдельную страницу #/tod/edit с заголовком «Новая карточка»', E.w.location.hash === '#/tod/edit' && E.D.querySelector('h1').textContent === 'Новая карточка');
  await A.press(A.btnText('Сохранить'));
  T('пустой текст -> «Введите текст карточки», в базу ничего не ушло, форма открыта', E.has('Введите текст карточки') && A.puts() === 0 && !!A.q('textarea[aria-label="Текст карточки"]'));

  // новая карточка: «Действие», «Жёсткие»
  await A.pick('Тип карточки', 'Действие'); await A.pick('Уровень карточки', 'Жёсткие');
  A.setText('  ' + NEW_TEXT + '  '); await sleep(100); await A.press(A.btnText('Сохранить'), 700);
  const ids = Object.keys(A.lastTod()).filter(k => !SEED[k]); const added = A.lastTod()[ids[0]];
  T('карточка записана в базу: поля id/type/difficulty/text/isActive/updatedAt, отказов правил нет', ids.length === 1 && added.type === 'dare' && added.difficulty === 'hard' && added.text === NEW_TEXT && added.isActive === true && typeof added.updatedAt === 'number' && /^td_[0-9a-z]+$/.test(added.id) && added.id.length <= 16 && Object.keys(added).sort().join() === 'difficulty,id,isActive,text,type,updatedAt' && db.stats.denied === 0);
  T('после записи форма закрыта, карточка видна в списке', !A.q('textarea[aria-label="Текст карточки"]') && E.has(NEW_TEXT));
  T('карточка сразу попала в кэш устройства', (() => { try { return JSON.parse(E.w.localStorage.getItem(KEY)).some(c => c.text === NEW_TEXT); } catch (e) { return false; } })());

  // повтор: тот же тип, другой регистр и лишние пробелы
  await A.press(A.btnText('+ Новая карточка'));
  await A.pick('Тип карточки', 'Действие');
  A.setText('изобрази   КОТА, который   увидел огурец'); await sleep(100); const writes0 = db.stats.writes; await A.press(A.btnText('Сохранить'), 500);
  T('повтор текста того же типа (регистр и пробелы не важны) -> «Такая карточка уже есть», запись не ушла', E.has('Такая карточка уже есть') && db.stats.writes === writes0 && Object.keys(A.lastTod()).length === 4);
  await A.pick('Тип карточки', 'Правда'); await A.press(A.btnText('Сохранить'), 700);
  T('тот же текст у другого типа («Правда») повтором не считается и записывается', Object.keys(A.lastTod()).length === 5 && Object.values(A.lastTod()).filter(c => c.text.toLowerCase().includes('изобрази')).length === 2);

  // «Скрыть» / «Показать»
  const hideNew = A.byLabel('Скрыть: ' + NEW_TEXT);
  T('у видимой карточки кнопка «Скрыть», у скрытой — «Показать»', !!hideNew && !!A.byLabel('Показать: Станцуй без музыки') && !A.byLabel('Скрыть: Станцуй без музыки'));
  await A.press(hideNew, 600);
  T('«Скрыть» -> isActive:false в базе, остальные поля целы, на карточке метка «скрыта»', A.lastTod()[ids[0]].isActive === false && A.lastTod()[ids[0]].text === NEW_TEXT && !!A.byLabel('Показать: ' + NEW_TEXT));
  await A.press(A.byLabel('Показать: ' + NEW_TEXT), 600);
  T('«Показать» -> isActive:true в базе', A.lastTod()[ids[0]].isActive === true && !!A.byLabel('Скрыть: ' + NEW_TEXT));

  // изменение текста
  const before = A.lastTod();
  await A.press(A.byLabel('Изменить: Вопрос про лето?'), 300);
  const ta = A.q('textarea[aria-label="Текст карточки"]');
  T('«Изменить»: открыта отдельная страница правки (#/tod/edit), текст подставлен', !!ta && ta.value === 'Вопрос про лето?' && E.has('Редактирование') && E.w.location.hash === '#/tod/edit');
  await A.press(A.btnText('Сохранить'), 600);
  T('сохранение без изменений не считается повтором самой себя', !E.has('Такая карточка уже есть') && !A.q('textarea[aria-label="Текст карточки"]'));
  await A.press(A.byLabel('Изменить: Вопрос про лето?'), 300); A.setText('Вопрос про зиму?'); await sleep(100); await A.press(A.btnText('Сохранить'), 700);
  const after = A.lastTod();
  T('изменение текста записано, id и остальные поля прежние, остальные карточки целы', after.td_a.text === 'Вопрос про зиму?' && after.td_a.id === 'td_a' && after.td_a.type === 'truth' && after.td_a.difficulty === 'easy' && after.td_a.isActive === true && after.td_a.updatedAt > before.td_a.updatedAt && ['td_b', 'td_c', ids[0]].every(k => sameCard(after[k], before[k])) && db.stats.denied === 0);

  // новая карточка видна в архиве без перезагрузки
  const back = A.byLabel('Назад'); await A.press(back, 500);
  T('«Назад» из админки, открытой из меню, ведёт в «Меню»', E.D.title === 'Меню — ASK ME');
  await A.press(A.qa('main button').find(b => /Все вопросы/.test(b.textContent)), 500);
  await A.press(A.qa('[role="tab"]').find(b => b.textContent.trim() === 'Действие'), 300);
  T('карточка из админки видна в архиве без перезагрузки (владельцу — вместе со скрытой)', E.has(NEW_TEXT) && E.has('Станцуй без музыки'));
  await A.press(A.qa('[role="tab"]').find(b => b.textContent.trim() === 'Правда'), 300);
  T('изменённый текст виден на вкладке «Правда»', E.has('Вопрос про зиму?') && !E.has('Вопрос про лето?'));

  // сбой сети при записи
  await A.press(A.qa('button').find(b => /Управление карточками/.test(b.textContent)), 500); await A.press(A.btnText('+ Новая карточка'));
  A.setText('Карточка при плохой сети'); await sleep(100); A.gate.failWrite = true; await A.press(A.btnText('Сохранить'), 600);
  const shown = E.D.body.textContent;
  T('ошибка сети при записи -> понятное сообщение, форма остаётся открытой с введённым текстом', /Не удалось сохранить: нет связи с сервером/.test(shown) && !!A.q('textarea[aria-label="Текст карточки"]') && A.q('textarea[aria-label="Текст карточки"]').value === 'Карточка при плохой сети' && !Object.values(A.lastTod()).some(c => c.text === 'Карточка при плохой сети'));
  T('в сообщении нет адреса базы и токена', !/firebase|auth=|owner-tok|https?:/i.test(A.qa('[role="alert"]').map(x => x.textContent).join(' ')));
  A.gate.failWrite = false; await A.press(A.btnText('Сохранить'), 700);
  T('после восстановления сети повторное «Сохранить» записывает карточку', Object.values(A.lastTod()).some(c => c.text === 'Карточка при плохой сети') && !A.q('textarea[aria-label="Текст карточки"]'));
  T('за всё время правила не отклонили ни одной записи владельца', db.stats.denied === 0);
  A.close();

  // ---------- стартовый набор ----------
  const S = await open({ owner: true }); // база пуста: админка показывает встроенный набор
  await S.openAdmin();
  const seedBtn = () => S.qa('button').find(b => /Загрузить стартовый набор/.test(b.textContent));
  T('база пуста: админка предупреждает, что показан встроенный набор, и предлагает «Загрузить стартовый набор (120 новых)»', E_has(S, 'встроенный набор') && !!seedBtn() && /\(120 новых\)/.test(seedBtn().textContent));
  // другое устройство успело поправить две карточки набора (одну изменило, другую скрыло) — приложение об этом ещё не знает
  const edited = { ...TOD_STARTER[0], text: 'Правка владельца', updatedAt: 5 }; const hiddenCard = { ...TOD_STARTER[1], isActive: false, updatedAt: 6 };
  S.db.seedTod({ [edited.id]: edited, [hiddenCard.id]: hiddenCard });
  await S.press(seedBtn(), 200);
  for (let i = 0; i < 80 && Object.keys(S.lastTod()).length < 120; i++) await sleep(250);
  await sleep(400);
  T('«Загрузить стартовый набор» записывает 120 карточек, отказов правил нет', Object.keys(S.lastTod()).length === 120 && S.db.stats.denied === 0);
  T('чужие правки не затёрты: изменённая и скрытая карточки набора остались как были (свежее чтение базы перед записью)', sameCard(S.lastTod()[edited.id], edited) && sameCard(S.lastTod()[hiddenCard.id], hiddenCard));
  T('записано ровно 118 карточек (две существующие пропущены)', S.puts() === 118);
  T('после загрузки кнопки больше нет, список и кэш обновлены (120 карточек)', !seedBtn() && (() => { try { const c = JSON.parse(S.E.w.localStorage.getItem(KEY)); return c.length === 120 && c.find(x => x.id === edited.id).text === 'Правка владельца' && c.find(x => x.id === hiddenCard.id).isActive === false; } catch (e) { return false; } })());
  T('в списке админки видна правка владельца (из свежего чтения, а не из встроенного набора)', S.E.has('Правка владельца'));
  S.close();

  // свежее чтение не удалось -> ничего не пишем
  const F = await open({ owner: true });
  await F.openAdmin(); F.gate.failRead = true;
  const fb = () => F.qa('button').find(b => /Загрузить стартовый набор/.test(b.textContent));
  await F.press(fb(), 800);
  T('чтение базы перед загрузкой не удалось -> ни одной записи (0 PUT), ясное сообщение', F.puts() === 0 && F.db.stats.writes === 0 && /ничего не записано/.test(F.E.D.body.textContent) && Object.keys(F.lastTod()).length === 0);
  T('после отказа кнопка остаётся, ошибка не раскрывает адрес базы', !!fb() && !/firebase|auth=|https?:/i.test(F.qa('[role="alert"]').map(x => x.textContent).join(' ')));
  // чтение вернуло «не ок» (а не исключение)
  F.gate.failRead = false; const baseF = F.E.w.fetch; F.E.w.fetch = async (url, init) => { if (/\/tod\.json/.test(String(url))) return { ok: false, status: 503, json: async () => null }; return baseF(url, init); };
  await F.press(fb(), 800);
  T('чтение вернуло ошибку сервера (503) -> тоже ни одной записи', F.puts() === 0 && F.db.stats.writes === 0 && /ничего не записано/.test(F.E.D.body.textContent));
  F.close();

  // обычный токен: правила отклоняют запись (401), владелец без входа получает спокойное сообщение
  const U = await open({}); // нет владельца в хранилище, токен анонимный ('t')
  const r = await U.E.w.fetch('https://project-x-5e16a-default-rtdb.europe-west1.firebasedatabase.app/tod/td_x.json?auth=t', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'td_x', type: 'truth', difficulty: 'easy', text: 'Взлом?', isActive: true }) });
  T('запись обычным токеном отклоняется правилами (401)', r.status === 401 && U.db.stats.denied === 1 && !U.lastTod().td_x);
  U.close();

  // права на запись пропали (токен не владельца, но экран открыт владельцем): сообщение про права
  const D = await open({ owner: true, seed: SEED }); await D.openAdmin();
  const baseD = D.E.w.fetch; D.E.w.fetch = async (url, init) => { if (init && init.method === 'PUT' && /\/tod\//.test(String(url))) return { ok: false, status: 401, json: async () => ({ error: 'Permission denied' }) }; return baseD(url, init); };
  await D.press(D.btnText('+ Новая карточка')); D.setText('Нет прав'); await sleep(100); await D.press(D.btnText('Сохранить'), 600);
  T('401 от базы -> спокойное сообщение про права владельца, форма открыта', /нет прав на запись/.test(D.E.D.body.textContent) && /Проверьте вход владельца/.test(D.E.D.body.textContent) && !!D.q('textarea[aria-label="Текст карточки"]'));
  D.close();

  console.log(res.join('\n')); console.log('--- captured runtime errors:', errs.length); errs.slice(0, 6).forEach(x => console.log(' ', x));
  process.exit(res.some(l => l.startsWith('FAIL')) ? 1 : 0);
})().catch(err => { console.log(res.join('\n')); console.log('TEST CRASH:', err && (err.stack || err.message)); process.exit(1); });
function E_has(o, t) { return o.E.D.body.textContent.includes(t); }
