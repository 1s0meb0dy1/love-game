// Режим «Правда или действие»: игровой экран #/tod/play на одном устройстве — выбор, уровни, карточка, пропуск с «🐔», передача хода,
// защита от двойного нажатия, завершение и выход, отсутствующая карточка, имена со скобками и разметкой.
const { boot, DEFAULT_DB } = require('../tod-ui.js');
const res = []; const T = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n); const errs = [];
const done = (A) => { errs.push(...A.errors); A.close(); };
const TEXTS = Object.values(DEFAULT_DB).map(c => c.text);
// выбрать тон в лобби и начать
const play = async (A, tone = 'Мягкий') => { await A.toLobby(); const b = A.btns().find(x => x.textContent.trim() === tone && x.hasAttribute('aria-pressed')); await A.tap(b); await A.startGame(); };

(async () => {
  try {
    let A = await boot(); await play(A, 'Мягкий');
    T('экран хода: «Ход игрока: Макс», две кнопки выбора', A.heading() === 'Ход игрока: Макс' && !!A.btn('Правда') && !!A.btn('Действие') && A.chickens().length === 2);
    await A.press('Правда', 450);
    T('«Правда» -> карточка с текстом из набора, видны «Ответил(а)» и «Пропустить»', TEXTS.includes(A.cardBody()) && /^Правда/.test(A.cardBody()) && !!A.btn('Ответил(а)') && !!A.btn('Пропустить'));
    T('реплика под карточкой есть при «Мягкий»', !!A.banter() && A.banter().length >= 8 && !/[{}]/.test(A.banter()));
    await A.sleep(550); await A.press('Пропустить', 450);
    T('«Пропустить»: снова «Ход игрока: Макс», счётчик «🐔 1», фаза выбора', A.heading() === 'Ход игрока: Макс' && A.chickens()[0] === '🐔 1' && !!A.btn('Правда') && !A.btn('Пропустить'));
    T('после пропуска видна подколка с именем', (A.banter() || '').includes('Макс'));
    await A.sleep(550); await A.press('Правда', 450); await A.sleep(550); await A.press('Пропустить', 450);
    const two = A.chickens()[0];
    await A.sleep(550); await A.press('Правда', 450); await A.sleep(550); await A.press('Ответил(а)', 450);
    T('второй пропуск: «🐔 2»; затем выполнение -> «Ход игрока: Аня», счётчик Макса остался', two === '🐔 2' && A.heading() === 'Ход игрока: Аня' && A.chickens()[0] === '🐔 2' && A.chickens()[1] === '🐔 0');
    const cur = [...A.D.querySelectorAll('.tod-chicken')].map(x => x.closest('li'));
    T('игрок в очереди выделен', cur[1].className.includes('is-on') && cur[1].getAttribute('aria-current') === 'true' && !cur[0].className.includes('is-on'));
    await A.sleep(550); await A.press('Действие', 450);
    const lv = (t) => A.btns().find(b => b.textContent.includes(t) && b.className.includes('tod-lvl'));
    T('«Действие» -> три уровня; при выключенных «Жёстких» «Жёстко» недоступно с подписью «пока пусто»', !!lv('Легко') && !!lv('Средне') && lv('Жёстко').disabled && lv('Жёстко').textContent.includes('пока пусто') && !lv('Легко').disabled);
    await A.sleep(550); await A.tap(lv('Средне'), 450);
    T('уровень «Средне» -> карточка «Действие», главная кнопка «Выполнено»', /^Действие среднее/.test(A.cardBody()) && !!A.btn('Выполнено'));
    await A.sleep(550);
    const main = A.btn('Выполнено'); main.dispatchEvent(new A.w.MouseEvent('click', { bubbles: true })); await A.sleep(120);
    const again = A.btn('Выполнено') || A.btn('Ответил(а)'); if (again) again.dispatchEvent(new A.w.MouseEvent('click', { bubbles: true }));
    await A.sleep(400);
    T('два быстрых нажатия «Ответил(а)» (в пределах 500 мс) -> ход передан один раз', A.heading() === 'Ход игрока: Макс' && !A.btn('Пропустить'));
    T('кнопки хода — классы btn-* или opt-card (не меньше 44 px по дизайн-системе)', [A.btn('Правда'), A.btn('Действие'), A.btn('Меню')].every(b => b && /\b(btn-[a-z]+|opt-card)\b/.test(b.className)));
    await A.sleep(550); await A.press('Меню', 350);
    T('«Завершить» просит подтверждения', A.text().includes('Вы действительно хотите закончить игру?') && !!A.btn('Завершить для всех') && A.btn('Завершить для всех').className.includes('btn-danger'));
    await A.press('Вернуться в игру', 350);
    T('«Вернуться в игру» возвращает в игру', !A.text().includes('Вы действительно хотите закончить игру?') && A.hashNow() === '#/tod/play' && A.heading() === 'Ход игрока: Макс');
    await A.press('Меню', 350); await A.press('Завершить для всех', 500);
    T('«Завершить для всех» открывает итоги (#/tod/results)', A.hashNow() === '#/tod/results' && A.D.title === 'Итоги — Правда или действие — ASK ME' && A.text().includes('Зал позора'));
    done(A);

    A = await boot(); await play(A, 'Выкл');
    await A.press('Правда', 450);
    T('реплики нет при тоне «Выкл»', A.banter() === null && !!A.cardBody());
    await A.sleep(550); await A.press('Меню', 350); await A.press('Поставить на паузу', 500);
    T('«Меню» -> «Поставить на паузу» ведёт на главную (#/), партия остаётся на паузе и не завершена', A.hashNow() === '#/' && !A.text().includes('Ход игрока') && !!A.w.localStorage.getItem('askme_tod_pause_v1') && A.text().includes('Продолжить игру'));
    done(A);

    // карточки нет у устройства: игра началась по кэшу, а потом пришёл ответ базы без этих карточек — id в колоде есть, текста нет
    const cache = [1, 2, 3].map(i => ({ id: 'td_c' + i, type: 'truth', difficulty: 'easy', text: 'Карточка из кэша ' + i, isActive: true })).concat([{ id: 'td_cd', type: 'dare', difficulty: 'easy', text: 'Действие из кэша', isActive: true }]);
    A = await boot({ cache, todDelay: 4000 }); await play(A, 'Мягкий');
    await A.press('Правда', 450);
    const fromCache = /^Карточка из кэша/.test(A.cardBody() || '');
    await A.sleep(4200); for (let i = 0; i < 120 && A.cardBody() !== 'Карточка недоступна'; i++) await A.sleep(100); // после ответа базы карточку ещё раз ищут точечным запросом
    T('карточка отсутствует у устройства: «Карточка недоступна», «Пропустить» работает, ошибок в консоли нет', fromCache && A.cardBody() === 'Карточка недоступна' && A.errors.length === 0);
    await A.press('Пропустить', 450);
    T('после пропуска недоступной карточки игра продолжается', A.chickens()[0] === '🐔 1' && !!A.btn('Правда'));
    done(A);
    // правило «Правда не больше 3 раз подряд»: после трёх правд кнопка запирается, подсказка объясняет, «Действие» снимает запрет
    A = await boot(); await play(A, 'Мягкий');
    const truthBtn = () => A.btns().find(b => b.className.includes('tod-pick-truth'));
    const lockedNow = () => !!truthBtn() && truthBtn().getAttribute('aria-disabled') === 'true';
    T('в начале хода правда открыта, постоянного блока про лимит на экране нет', !lockedNow() && !A.D.querySelector('.tod-ruleline') && !A.text().includes('Правда — не больше 3 раз подряд'));
    for (let i = 0; i < 3; i++) { await A.sleep(550); await A.press('Правда', 450); await A.sleep(550); await A.press('Пропустить', 450); }
    T('после 3 правд подряд кнопка «Правда» заперта (aria-disabled), блока с объяснением нет, у «Действия» акцент', lockedNow() && !A.D.querySelector('.tod-ruleline') && !!A.D.querySelector('.tod-pick-dare.tod-attn') && A.heading() === 'Ход игрока: Макс');
    await A.sleep(550); await A.tap(truthBtn(), 450);
    T('нажатие на запертую «Правду» ничего не выбирает: карточки нет, ход тот же', !A.cardBody() && A.heading() === 'Ход игрока: Макс' && lockedNow());
    const toast = A.D.querySelector('.toast');
    T('при этом всплывает уведомление: «Макс, три «Правды» подряд — теперь только «Действие»»', !!toast && /Макс, три «Правды» подряд — теперь только «Действие»/.test(toast.textContent));
    await A.sleep(550); await A.press('Действие', 450); await A.sleep(550); await A.tap(A.btns().find(b => b.textContent.includes('Легко') && b.className.includes('tod-lvl')), 450); await A.sleep(550); await A.press('Пропустить', 450);
    T('после «Действия» правда снова открыта', !lockedNow());
    done(A);

    // шапка и порядок блоков: «Назад» и «Меню», заголовок по центру под шапкой, «Ход игрока» под карточкой, подколка-пузырь, уровни без эмодзи
    A = await boot(); await play(A, 'Острый');
    const hdr = A.D.querySelector('header'); const h1 = A.D.querySelector('main h1');
    T('шапка игры: слева «Назад», справа «Меню ☰», кнопки «Завершить» в шапке нет; заголовок h1 «Правда или действие» под шапкой и подпись «Круг 1»', !!hdr.querySelector('button[aria-label="Назад"]') && hdr.textContent.includes('Меню') && !hdr.textContent.includes('Завершить') && !!h1 && h1.textContent === 'Правда или действие' && !hdr.contains(h1) && A.text().includes('Круг 1'));
    await A.press('Правда', 450);
    const flipEl = A.D.querySelector('.tod-flip'); const act = A.btn('Ответил(а)'); const turnIn = flipEl && flipEl.querySelector('.tod-card-turn h2');
    T('«Ход игрока» стоит прямо на карточке (в начале), без отдельного блока; кнопки «Ответил(а)» и «Пропустить» — под карточкой', !!flipEl && !!turnIn && /Ход игрока: Макс/.test(turnIn.textContent) && !A.D.querySelector('.tod-stage') && !!(flipEl.compareDocumentPosition(act) & 4) && A.heading() === 'Ход игрока: Макс');
    const cardEl = flipEl.querySelector('.tod-card'); const cardKids = [...cardEl.children].map(c => c.className);
    T('на карточке по порядку: «Ход игрока», уровень, текст; карточка выровнена по центру (классы tod-card, flex-col)', cardEl.className.includes('tod-card') && cardKids[0].includes('tod-card-turn') && cardKids[1].includes('tod-lvl') && cardEl.querySelector('p') !== null);
    const heckle = A.D.querySelector('.tod-heckle');
    T('подколка оформлена как реплика ведущего: лицо-эмодзи + пузырь .tod-banter, при тоне «Острый» класс is-spicy', !!heckle && !!heckle.querySelector('.tod-heckle-face') && !!heckle.querySelector('.tod-banter') && heckle.classList.contains('is-spicy'));
    await A.sleep(550); await A.press('Пропустить', 450); await A.sleep(550); await A.press('Действие', 450);
    const lvBtns = A.btns().filter(b => b.className.includes('tod-lvl') && b.className.includes('tod-heat'));
    T('выбор уровня: три кнопки только с точками, эмодзи 🟢🟡🔴 нет', lvBtns.length === 3 && lvBtns.every(b => b.querySelectorAll('.tod-lvl-dots i').length === 3 && !/[🟢🟡🔴]/u.test(b.textContent)));
    await A.sleep(550); await A.tap(lvBtns[0], 450);
    T('карточка действия: метка уровня тоже с точками без эмодзи', !!A.D.querySelector('.tod-card .tod-lvl-dots') && !/[🟢🟡🔴]/u.test(A.D.querySelector('.tod-card').textContent));
    // «Назад» тоже спрашивает подтверждение и ведёт в лобби
    await A.sleep(550); await A.tap(A.D.querySelector('header button[aria-label="Назад"]'), 350);
    T('«Назад» открывает вопрос «Вы действительно хотите закончить игру?» с тремя вариантами', A.text().includes('Вы действительно хотите закончить игру?') && !!A.btn('Завершить для всех') && !!A.btn('Поставить на паузу') && !!A.btn('Вернуться в игру'));
    await A.press('Поставить на паузу', 600);
    T('пауза через «Назад» тоже ведёт на главную, где «Продолжить игру» стоит над «Начать новую игру»', A.hashNow() === '#/' && A.btns().findIndex(b => b.textContent.includes('Продолжить игру')) >= 0 && A.btns().findIndex(b => b.textContent.includes('Продолжить игру')) < A.btns().findIndex(b => b.textContent.includes('Начать новую игру')));
    done(A);

    const tricky = '{name}<b>Я</b>{a|b}';
    const db2 = { ...DEFAULT_DB };
    A = await boot({ names: [tricky, 'Аня'], seed: db2 }); await play(A, 'Мягкий');
    T('имя игрока со скобками {name} и <b> показано как есть в заголовке', A.heading() === 'Ход игрока: ' + tricky.replace(/[<>]/g, '') || A.heading() === 'Ход игрока: ' + tricky);
    await A.press('Правда', 450); await A.sleep(550); await A.press('Пропустить', 450);
    T('имя со скобками в реплике выводится как есть, без повторной подстановки', (A.banter() || '').includes(tricky.replace(/[<>]/g, '')) && !A.D.querySelector('.tod-banter b'));
    done(A);
  } catch (e) { T('сценарий выполнился без исключений: ' + (e && e.stack), false); }
  console.log(res.join('\n')); console.log('--- captured runtime errors: ' + errs.length); errs.slice(0, 5).forEach(e => console.log(e));
  process.exit(res.some(l => l.startsWith('FAIL')) || errs.length ? 1 : 0);
})();
