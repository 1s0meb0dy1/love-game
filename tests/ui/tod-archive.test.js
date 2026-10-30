// Режим «Правда или действие»: вкладки «Классика / Правда / Действие» на экране «Все вопросы» — архив карточек по уровням.
// FLOW=player — игрок, база отвечает; offline — база недоступна (запасной набор и копия на устройстве); admin — владелец (видит скрытые, есть «Управление карточками»).
// Заодно проверяется, что карточки из app.jsx (состояния todCards/todSource) реально доходят до экрана: тексты, которых нет в стартовом наборе, видны только если пришли из базы.
const makeEnv = require('../harness.js'); const makeDb = require('../fake-rtdb.js'); const { loadTod } = require('../tod-load.js');
const FLOW = process.env.FLOW || 'player';
const KEY = 'askme_tod_cards_v1'; const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const res = []; const T = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
const { TOD_STARTER } = loadTod(['content/tod-cards.js'], ['TOD_STARTER']);
const STARTER_TRUTH = TOD_STARTER.find(c => c.type === 'truth' && c.difficulty === 'easy').text; // любая «Правда» из набора
const STARTER_DARE = TOD_STARTER.find(c => c.type === 'dare' && c.difficulty === 'medium').text;
const STARTER_HARD = TOD_STARTER.find(c => c.type === 'truth' && c.difficulty === 'hard').text;
const card = (o) => ({ isActive: true, ...o });
// база: три активные «Правды» разных уровней и одна скрытая «Действие»; тексты не из стартового набора
const DB = {
  td_t1: card({ id: 'td_t1', type: 'truth', difficulty: 'easy', text: 'Какую песню ты поёшь в душе?' }),
  td_t2: card({ id: 'td_t2', type: 'truth', difficulty: 'medium', text: 'Когда ты в последний раз плакал над фильмом?' }),
  td_t3: card({ id: 'td_t3', type: 'truth', difficulty: 'hard', text: 'О чём ты никогда не рассказывал родителям?' }),
  td_d1: card({ id: 'td_d1', type: 'dare', difficulty: 'medium', text: 'Скрытая карточка', isActive: false })
};
const errs = [];

// запуск приложения: профиль, меню -> «Все вопросы»; opts: seed — карточки в базе, down — запросы к /tod падают, cache — что лежит в кэше устройства, owner — вход владельца
const open = async (opts) => {
  const E = makeEnv(); const db = makeDb({ ownerToken: 'owner-tok' }); db.attach(E); if (opts.seed) db.seedTod(opts.seed);
  if (opts.owner) E.w.localStorage.setItem('askme_auth_v2', JSON.stringify({ owner: { idToken: 'owner-tok', refreshToken: 'r', expiresAt: Date.now() + 3.6e6 } }));
  if (opts.cache) E.w.localStorage.setItem(KEY, opts.cache);
  if (opts.down) { const base = E.w.fetch; E.w.fetch = async (url, init) => { if (/\/tod[/.]/.test(String(url))) throw new TypeError('network'); return base(url, init); }; }
  E.w.eval(E.code); await sleep(1800);
  const inputs = [...E.D.querySelectorAll('input[type="text"]')]; E.setVal(inputs[0], 'Макс'); E.setVal(inputs[1], 'Аня'); await sleep(200);
  await E.click('Создать сессию', 1200); await E.click('Перейти к игре', 900);
  const menu = E.D.querySelector('button[aria-label="Открыть меню"]'); menu.dispatchEvent(new E.w.MouseEvent('click', { bubbles: true })); await sleep(500);
  await E.click('Все вопросы', 500);
  const tab = (name) => [...E.D.querySelectorAll('[role="tab"]')].find(b => b.textContent.trim() === name);
  const goTab = async (name) => { const b = tab(name); if (!b) return false; b.dispatchEvent(new E.w.MouseEvent('click', { bubbles: true })); await sleep(300); return true; };
  const btn = (t) => E.btns().find(b => b.textContent.replace(/\s+/g, ' ').includes(t));
  return { E, db, tab, goTab, btn, close() { errs.push(...E.errors); try { E.w.close(); } catch (e) {} } };
};

(async () => {
  if (FLOW === 'player') {
    const A = await open({ seed: DB }); const { E } = A;
    T('в «Все вопросы» три вкладки: Классика, Правда, Действие', E.D.title === 'Все темы — ASK ME' && !!A.tab('Классика') && !!A.tab('Правда') && !!A.tab('Действие') && A.tab('Правда').getAttribute('role') === 'tab');
    T('по умолчанию выбрана «Классика», сетка тем на месте, карточек режима нет', A.tab('Классика').getAttribute('aria-selected') === 'true' && E.has('Семья') && E.has('Активных:') && !E.has(DB.td_t1.text));
    await A.goTab('Правда');
    T('вкладка «Правда» выбрана; сетки тем нет', A.tab('Правда').getAttribute('aria-selected') === 'true' && A.tab('Классика').getAttribute('aria-selected') === 'false' && !E.has('Активных:'));
    T('вкладка «Правда»: группы Простые, Средние, Жёсткие и тексты трёх карточек из базы', ['Простые', 'Средние', 'Жёсткие'].every(t => E.has(t)) && [DB.td_t1, DB.td_t2, DB.td_t3].every(c => E.has(c.text)));
    T('карточки пришли из базы, а не из запасного набора (текстов стартового набора нет)', !E.has(STARTER_TRUTH) && !E.has(STARTER_HARD));
    const mark = (lv) => E.D.querySelector('.tod-lvl-' + lv);
    T('у каждого уровня метка с цветом, значком и подписью (цвет не единственный признак)', [['easy', 'Простые'], ['medium', 'Средние'], ['hard', 'Жёсткие']].every(([lv, label]) => mark(lv) && mark(lv).textContent.includes(label) && !!mark(lv).querySelector('.tod-lvl-dots[aria-hidden="true"]')));
    T('скрытая карточка игроку не видна ни на вкладке «Правда», ни на «Действие»', !E.has('Скрытая карточка'));
    await A.goTab('Действие');
    T('вкладка «Действие»: активных карточек нет -> понятная пустая заметка, скрытая не видна', E.has('Пока нет карточек') && !E.has('Скрытая карточка') && !E.has(DB.td_t1.text));
    T('у игрока нет «Управление карточками», «Управление темами» и «Новый вопрос»', !E.has('Управление карточками') && !E.has('Управление темами') && !A.btn('Новый вопрос'));
    await A.goTab('Классика');
    T('возврат на «Классика» возвращает сетку тем без изменений', E.has('Семья') && E.has('Активных:') && !E.has('Пока нет карточек'));
    A.close();
  }

  if (FLOW === 'offline') {
    const A = await open({ seed: DB, down: true }); const { E } = A;
    await A.goTab('Правда');
    T('база недоступна, копии нет -> виден текст из стартового набора (простая и жёсткая «Правда»)', E.has(STARTER_TRUTH) && E.has(STARTER_HARD) && !E.has(DB.td_t1.text));
    T('стартовый набор: в группе «Простые» 20 карточек (счётчик в метке)', /Простые\s*·\s*20/.test(E.D.querySelector('.tod-lvl-easy').textContent));
    await A.goTab('Действие');
    T('на вкладке «Действие» тоже стартовый набор', E.has(STARTER_DARE) && !E.has('Пока нет карточек'));
    T('стартовый набор в кэш не записан', E.w.localStorage.getItem(KEY) === null);
    A.close();

    const copy = [card({ id: 'td_c1', type: 'truth', difficulty: 'easy', text: 'Вопрос из копии на устройстве?' })];
    const B = await open({ down: true, cache: JSON.stringify(copy) });
    await B.goTab('Правда');
    T('база недоступна, на устройстве есть копия -> показана копия, а не стартовый набор', B.E.has('Вопрос из копии на устройстве?') && !B.E.has(STARTER_TRUTH));
    B.close();
  }

  if (FLOW === 'admin') {
    const A = await open({ seed: DB, owner: true }); const { E } = A;
    T('владелец: три вкладки и классический экран на месте («Управление темами», «Новый вопрос»)', !!A.tab('Классика') && !!A.tab('Правда') && !!A.tab('Действие') && !!A.btn('Управление темами') && !!A.btn('Новый вопрос'));
    await A.goTab('Правда');
    T('владелец на «Правда»: активные карточки из базы видны, меток «скрыта» нет (скрытая — на «Действие»)', [DB.td_t1, DB.td_t2, DB.td_t3].every(c => E.has(c.text)) && ![...E.D.querySelectorAll('.tag')].some(t => t.textContent.includes('скрыта')));
    await A.goTab('Действие');
    T('владельцу видна скрытая карточка с меткой «скрыта»', E.has('Скрытая карточка') && [...E.D.querySelectorAll('.tag')].some(t => t.textContent.trim().includes('скрыта')));
    T('у владельца на вкладках режима есть «Управление карточками»; классических «Управление темами» и «Новый вопрос» нет (одна главная кнопка не нужна)', !!A.btn('Управление карточками') && !A.btn('Управление темами') && !A.btn('Новый вопрос') && !E.D.querySelector('.btn-primary'));
    await A.goTab('Классика');
    T('назад на «Классика» кнопки темы и «Новый вопрос» возвращаются, «Управление карточками» исчезает', !!A.btn('Управление темами') && !!A.btn('Новый вопрос') && !A.btn('Управление карточками'));
    await A.goTab('Действие'); await E.click('Управление карточками', 500);
    T('«Управление карточками» открывает админку: адрес и заголовок вкладки', E.D.title === 'Карточки — Правда или действие — ASK ME' && E.w.location.hash === '#/tod/manage');
    const back = E.D.querySelector('button[aria-label="Назад"]'); back.dispatchEvent(new E.w.MouseEvent('click', { bubbles: true })); await sleep(500);
    T('«Назад» из админки возвращает во «Все вопросы» на ту же вкладку «Действие»', E.D.title === 'Все темы — ASK ME' && A.tab('Действие').getAttribute('aria-selected') === 'true' && E.has('Скрытая карточка'));
    // правка и скрытие прямо в архиве: у каждой карточки «Изменить» и «Скрыть/Показать»
    const labelBtn = (pre) => E.btns().find(b => (b.getAttribute('aria-label') || '').startsWith(pre));
    T('владелец: у карточки в архиве есть «Изменить» и «Показать» (для скрытой) с названием карточки в aria-label', !!labelBtn('Изменить: Скрытая карточка') && !!labelBtn('Показать: Скрытая карточка') && E.btns().filter(b => (b.getAttribute('aria-label') || '').startsWith('Изменить: ')).length === 1);
    labelBtn('Показать: Скрытая карточка').dispatchEvent(new E.w.MouseEvent('click', { bubbles: true })); await sleep(900);
    T('«Показать» возвращает карточку в игру: в базе isActive true, метка «скрыта» исчезла, кнопка стала «Скрыть»', A.db.tod().td_d1.isActive === true && ![...E.D.querySelectorAll('.tag')].some(t => t.textContent.includes('скрыта')) && !!labelBtn('Скрыть: Скрытая карточка'));
    labelBtn('Изменить: Скрытая карточка').dispatchEvent(new E.w.MouseEvent('click', { bubbles: true })); await sleep(700);
    const ta = E.D.querySelector('textarea[aria-label="Текст карточки"]');
    T('«Изменить» открывает админку сразу с формой этой карточки (текст подставлен)', E.w.location.hash === '#/tod/manage' && !!ta && ta.value === 'Скрытая карточка' && E.has('Редактирование карточки'));
    const back2 = E.D.querySelector('button[aria-label="Назад"]'); back2.dispatchEvent(new E.w.MouseEvent('click', { bubbles: true })); await sleep(500);
    T('«Назад» из формы возвращает в архив, а повторное «Управление карточками» открывается без формы', E.D.title === 'Все темы — ASK ME' && (await E.click('Управление карточками', 500), !E.D.querySelector('textarea[aria-label="Текст карточки"]')));
    A.close();
  }

  console.log(res.join('\n')); console.log('--- captured runtime errors:', errs.length); errs.slice(0, 6).forEach(x => console.log(' ', x));
  process.exit(res.some(l => l.startsWith('FAIL')) ? 1 : 0);
})().catch(err => { console.log(res.join('\n')); console.log('TEST CRASH:', err && err.message); process.exit(1); });
