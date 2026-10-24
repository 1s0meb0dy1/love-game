// Быстрые правки интерфейса: фильтр вопросов по глубине, «Показать ещё», ошибка под «Начать игру», «Продолжить»/«Начать новую игру»
// с подтверждением, блок «Таймер на ответ», анимация «Отвечает», иконка «Пропущено», зона владельца в меню, «Скрыть для всех» в тестовой игре.
Object.assign(globalThis, require('../harness.js')());
const FLOW = process.env.FLOW || 'player'; const ADMIN = FLOW === 'admin';
let alerts = 0; w.alert = () => { alerts++; };
const patches = []; const baseFetch = w.fetch;
w.fetch = async (url, opt) => { url = String(url); if (opt && opt.method === 'PATCH' && url.includes('/questions')) { patches.push({ url, body: JSON.parse(opt.body) }); return { ok: true, status: 200, json: async () => null }; } return baseFetch(url, opt); };
if (ADMIN) w.localStorage.setItem('askme_auth_v2', JSON.stringify({ owner: { idToken: 't', refreshToken: 'r', expiresAt: Date.now() + 3.6e6 } }));
else for (let i = 1; i <= 130; i++) qs['9' + String(100 + i)] = { categoryId: 'family', id: 'zz_' + i, level: 'Простые', text: 'Дополнительный вопрос номер ' + i + '?' };
const famBy = (lvl) => Object.values(exp).filter(q => q.categoryId === 'family' && q.level === lvl).length + (ADMIN ? 0 : (lvl === 'Простые' ? 130 : 0));
const byLabel = (l) => [...D.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === l);
const clickEl = async (el, ms = 250) => { if (!el) throw new Error('нет элемента'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await sleep(ms); };
const btn = (t) => [...D.querySelectorAll('button')].find(b => b.textContent.replace(/\s+/g, ' ').trim().includes(t) && !b.disabled);
const exact = (t) => [...D.querySelectorAll('button')].find(b => b.textContent.replace(/\s+/g, ' ').trim() === t);
const go = async (hash, ms = 500) => { w.location.hash = hash; w.dispatchEvent(new w.HashChangeEvent('hashchange')); await sleep(ms); };
const startBtn = () => [...D.querySelectorAll('button')].find(b => /^\s*Начать (новую )?игру\s*$/.test(b.textContent));
const rows = () => (D.body.textContent.match(/№ \d+\./g) || []).length;
const h3s = () => [...D.querySelectorAll('main h3, .flex-1 h3')].map(h => h.textContent.replace(/\s+/g, ' ').trim());
(async () => { try {
  w.eval(code); await sleep(1800);
  const inputs = [...D.querySelectorAll('input[type="text"]')]; setVal(inputs[0], 'Макс'); setVal(inputs[1], 'Аня'); await sleep(200);
  await click('Создать сессию', 1200); await click('Перейти к игре', 900);

  if (!ADMIN) {
    // ---------- 8, 11: кнопки старта и ошибка под ними ----------
    T('главная: «Начать игру» с полной заливкой, «Продолжить игру» пока нет', !!startBtn() && /btn-primary/.test(startBtn().className) && /Начать игру/.test(startBtn().textContent) && !btn('Продолжить игру'));
    await click('Снять все', 300);
    let err = D.querySelector('.inline-error');
    T('нет тем → под кнопкой «Начать игру» ошибка «Выберите хотя бы одну тему»', !!err && /Выберите хотя бы одну тему\./.test(err.textContent) && !!(startBtn().compareDocumentPosition(err) & 4));
    T('кнопка помечена недоступной для скринридера и связана с подсказкой', startBtn().getAttribute('aria-disabled') === 'true' && startBtn().getAttribute('aria-describedby') === 'start-hint' && !!D.getElementById('start-hint'));
    await clickEl(startBtn(), 400);
    T('нажатие на недоступную кнопку не уводит с главной и не вызывает системный alert', D.title.startsWith('ASK ME —') && alerts === 0);
    T('после нажатия ошибка «встряхивается» и объявляется (role="alert")', /shake/.test(D.querySelector('.inline-error').className) && D.querySelector('.inline-error').getAttribute('role') === 'alert');
    await click('Выбрать все', 300);
    T('темы выбраны → ошибка исчезла', !D.querySelector('.inline-error'));
    for (const d of ['Легкие', 'Средние', 'Глубокие']) await clickEl(exact(d) || btn(d), 120);
    err = D.querySelector('.inline-error');
    T('нет сложности → ошибка «Выберите хотя бы один уровень сложности»', !!err && /Выберите хотя бы один уровень сложности\./.test(err.textContent));
    await click('Снять все', 300);
    T('нет ни тем, ни сложности → одна общая ошибка', /Выберите хотя бы одну тему и один уровень сложности\./.test(D.querySelector('.inline-error').textContent));
    await click('Выбрать все', 200); for (const d of ['Легкие', 'Средние', 'Глубокие']) await clickEl(exact(d) || btn(d), 120);
    T('всё выбрано снова → ошибки нет, кнопка активна', !D.querySelector('.inline-error') && startBtn().getAttribute('aria-disabled') !== 'true');

    // ---------- 1: фильтр по глубине на странице темы ----------
    await go('#/topics', 600); await clickEl(btn('Семья'), 700);
    const tabs = () => [...D.querySelectorAll('[role="tablist"][aria-label="Сортировка по глубине"] [role="tab"]')];
    const tl = tabs().map(t => t.textContent.replace(/\s+/g, ' ').trim());
    const total = famBy('Простые') + famBy('Средние') + famBy('Глубокие');
    T('страница темы: быстрые вкладки «Все / Легкие / Средние / Глубокие» со счётчиками', tabs().length === 4 && tl[0] === 'Все ' + total && tl[1] === 'Легкие ' + famBy('Простые') && tl[2] === 'Средние ' + famBy('Средние') && tl[3] === 'Глубокие ' + famBy('Глубокие'));
    T('по умолчанию выбрано «Все», показаны все три уровня', tabs()[0].getAttribute('aria-selected') === 'true' && h3s().filter(h => /^(Легкие|Средние|Глубокие)/.test(h)).length === 3);
    await clickEl(tabs()[3], 300);
    T('«Глубокие»: остался только этот уровень и ровно его вопросы (' + famBy('Глубокие') + ')', tabs()[3].getAttribute('aria-selected') === 'true' && h3s().filter(h => /^(Легкие|Средние|Глубокие)/.test(h)).length === 1 && /^Глубокие/.test(h3s()[0]) && rows() === famBy('Глубокие'));
    await clickEl(tabs()[2], 300);
    T('«Средние»: только средние вопросы (' + famBy('Средние') + ')', h3s().filter(h => /^(Легкие|Средние|Глубокие)/.test(h)).length === 1 && /^Средние/.test(h3s()[0]) && rows() === famBy('Средние'));
    await clickEl(tabs()[1], 300);
    T('«Легкие»: показаны первые 60 из ' + famBy('Простые') + ' и кнопка «Показать ещё 60 из ' + (famBy('Простые') - 60) + '»', rows() === 60 && !!btn('Показать ещё 60 из ' + (famBy('Простые') - 60)));
    await click('Показать ещё', 300); T('«Показать ещё» добавляет следующие 60 (120)', rows() === 120 && !!btn('Показать ещё 27 из 27'));
    await click('Показать ещё', 300); T('и до конца: все ' + famBy('Простые') + ' вопросов, кнопки больше нет', rows() === famBy('Простые') && !btn('Показать ещё'));
    await clickEl(tabs()[0], 300); T('«Все» возвращает все уровни; у игрока нет кнопки «Новый вопрос»', h3s().filter(h => /^(Легкие|Средние|Глубокие)/.test(h)).length === 3 && !btn('Новый вопрос'));
    await go('#/', 600);

    // ---------- 9, 11: игра, «Продолжить» и «Начать новую игру» ----------
    await click('Начать игру', 700); await click('Обычный режим', 3800); await click('К вопросу', 600);
    const tag = [...D.querySelectorAll('.tag')].find(x => /^Отвечает:/.test(x.textContent.trim()));
    T('«Отвечает: ИМЯ» оформлено анимируемой плашкой (turn-tag, живая точка, имя отдельным элементом)', !!tag && /turn-tag/.test(tag.className) && !!tag.querySelector('.turn-dot') && !!tag.querySelector('.turn-name') && tag.querySelector('.turn-name').textContent.length > 0);
    T('в стилях есть анимации появления, имени и точки; при «меньше движения» они отключаются общим правилом', /@keyframes turnIn/.test(html) && /@keyframes turnName/.test(html) && /@keyframes turnDot/.test(html) && /prefers-reduced-motion: reduce\) \{ \*, \*::before/.test(html));
    const name0 = tag.querySelector('.turn-name').textContent;
    await click('Далее', 2500);
    const tag1 = [...D.querySelectorAll('.tag')].find(x => /^Отвечает:/.test(x.textContent.trim()));
    T('при смене хода плашка пересоздаётся (анимация проигрывается заново) с новым именем', !!tag1 && tag1 !== tag && tag1.querySelector('.turn-name').textContent !== name0);
    await go('#/', 700);
    const cont = btn('Продолжить игру');
    T('есть сохранённая партия: «Продолжить игру» — контурная (ghost), «Начать игру» стала «Начать новую игру» с заливкой', !!cont && /btn-ghost/.test(cont.className) && !!startBtn() && /Начать новую игру/.test(startBtn().textContent) && /btn-primary/.test(startBtn().className) && !/Начать игру/.test(startBtn().textContent));
    await clickEl(startBtn(), 400);
    const pop = D.querySelector('.viewport-popup-box');
    T('«Начать новую игру» просит подтверждение: вопрос и пояснение про сброс прогресса', !!pop && /Вы точно хотите начать новую игру\?/.test(pop.textContent) && /прогресс/i.test(pop.textContent) && /сбросится/.test(pop.textContent) && /вопрос \d+ из \d+/.test(pop.textContent));
    await clickEl([...D.querySelectorAll('.viewport-popup-box button')].find(b => b.textContent.trim() === 'Отмена'), 400);
    T('«Отмена» закрывает окно: остаёмся на главной, партия не потеряна', !D.querySelector('.viewport-popup-box') && D.title.startsWith('ASK ME —') && !!btn('Продолжить игру'));
    await clickEl(startBtn(), 400); await clickEl([...D.querySelectorAll('.viewport-popup-box button')].find(b => b.textContent.trim() === 'Начать новую'), 900);
    T('подтверждение ведёт к выбору режима', D.title === 'Режим игры — ASK ME');
    await click('Обычный режим', 3800); await click('К вопросу', 600);
    const posEl = [...D.querySelectorAll('header div')].find(x => /^\s*\d+\s*\/\s*\d+\s*$/.test(x.textContent));
    T('новая игра началась с первого вопроса', !!posEl && /^\s*1\s*\//.test(posEl.textContent));

    // ---------- 10: итоги, «Пропущено» ----------
    await click('Далее', 600); await click('Пропустить вопрос', 300);
    const mb = [...D.querySelectorAll('button')].find(b => /Меню/.test(b.textContent) && /btn-sm/.test(b.className)); await clickEl(mb, 400);
    await clickEl([...D.querySelectorAll('.viewport-popup-box .grid button')].find(b => b.textContent.trim() !== 'Отмена'), 1000);
    T('итоги игры открыты', D.title === 'Итоги игры — ASK ME');
    const ico = D.querySelector('.skip-ico');
    T('у «Пропущено» вместо символа «↷» — аккуратная иконка в цветной плашке (SVG)', !!ico && !!ico.querySelector('svg') && !D.body.textContent.includes('↷') && /Пропущено/.test(ico.parentElement.textContent));
    await click('В меню', 600);
    T('после итогов «Продолжить игру» больше нет, снова «Начать игру»', !btn('Продолжить игру') && !!startBtn() && /Начать игру/.test(startBtn().textContent));

    // ---------- 6: блок «Таймер на ответ» ----------
    await click('Начать игру', 700); await click('Усложнённый режим', 700);
    T('усложнённый режим: без усложнений — подсказка-ошибка и кнопка «Начать игру» недоступна', !!D.querySelector('.inline-error') && /Включите хотя бы одно усложнение/.test(D.body.textContent) && [...D.querySelectorAll('button')].some(b => b.textContent.trim() === 'Начать игру' && b.disabled));
    T('блок таймера оформлен карточкой, пока таймер выключен — только заголовок и переключатель', !!D.querySelector('.fx-card') && !D.querySelector('.timer-range') && !!D.querySelector('[role="switch"][aria-label="Таймер на ответ"]'));
    await clickEl(D.querySelector('[role="switch"][aria-label="Таймер на ответ"]'), 400);
    const num = () => D.querySelector('input.timer-num'), rng = () => D.querySelector('input.timer-range');
    T('таймер включён: крупное число (30), кнопки − и +, ползунок и быстрые значения', !!num() && num().value === '30' && !!byLabel('Меньше на 5 секунд') && !!byLabel('Больше на 5 секунд') && !!rng() && rng().value === '30' && ['15 с', '30 с', '45 с', '60 с', '90 с'].every(t => !!exact(t)) && /Живой темп/.test(D.body.textContent));
    T('после включения таймера ошибка про усложнения исчезла, «Начать игру» доступна', !D.querySelector('.inline-error') && [...D.querySelectorAll('button')].some(b => b.textContent.trim() === 'Начать игру' && !b.disabled));
    await clickEl(byLabel('Больше на 5 секунд'), 200); T('«+» добавляет 5 секунд (35)', num().value === '35' && rng().value === '35');
    await clickEl(byLabel('Меньше на 5 секунд'), 150); await clickEl(byLabel('Меньше на 5 секунд'), 150); T('«−» убавляет по 5 (25)', num().value === '25');
    await clickEl(exact('60 с'), 200); T('быстрое значение «60 с» ставит 60; выбранное подсвечено; подпись «Есть время подумать · 1 мин»', num().value === '60' && /is-on/.test(exact('60 с').className) && exact('60 с').getAttribute('aria-pressed') === 'true' && /Есть время подумать · 1 мин/.test(D.body.textContent));
    setVal(rng(), '120'); await sleep(200); T('ползунок двигает значение (120 → «2 мин»)', num().value === '120' && /2 мин/.test(D.body.textContent));
    const blur = (el) => { el.dispatchEvent(new w.FocusEvent('focusout', { bubbles: true })); return sleep(200); };
    setVal(num(), '4'); await sleep(150); T('при вводе своего числа поле не «прыгает»: набрано «4» — так и остаётся', num().value === '4');
    setVal(num(), '45'); await blur(num()); T('набрано «45» → после выхода из поля таймер 45 с', num().value === '45' && rng().value === '45');
    setVal(num(), '400'); await blur(num()); T('больше предела (400) → 300', num().value === '300');
    setVal(num(), '2'); await blur(num()); T('меньше предела (2) → 5, «−» блокируется', num().value === '5' && byLabel('Меньше на 5 секунд').disabled);
    setVal(num(), ''); await blur(num()); T('пустое поле при выходе возвращает прежнее значение (5)', num().value === '5');
    await clickEl(exact('45 с'), 200);
    T('значение сохраняется в настройках игры', JSON.parse(w.localStorage.getItem('askme_game_settings_v1')).timerSec === 45 && JSON.parse(w.localStorage.getItem('askme_game_settings_v1')).timerOn === true);
    await clickEl([...D.querySelectorAll('button')].find(b => b.textContent.trim() === 'Начать игру'), 3800);
    T('усложнённая партия с таймером запускается', D.title === 'Игра — ASK ME');
    await go('#/more', 600);
    T('обычный игрок в меню: нет «Только для владельца», тем, наказаний, аналитики, скрытых вопросов и режима владельца',
      !has('Только для владельца') && !has('владельц') && !has('Управление темами') && !has('Шаблоны наказаний') && !has('Аналитика') && !has('Скрытые вопросы'));
    await go('#/topics', 600);
    T('«Все вопросы» у игрока: кнопки «Новый вопрос» нет', !btn('Новый вопрос'));
  } else {
    // ---------- 3: зона владельца в меню ----------
    await clickEl(byLabel('Открыть меню'), 500);
    const zone = D.querySelector('section[aria-label="Только для владельца"]');
    T('владелец видит отдельную зону «Только для владельца» с пометкой «видите только вы»', !!zone && /Только для владельца/.test(zone.textContent) && /видите только вы/.test(zone.textContent));
    T('в зоне владельца пять пунктов: темы, наказания, аналитика, скрытые вопросы, режим владельца', ['Управление темами', 'Шаблоны наказаний', 'Аналитика', 'Скрытые вопросы', 'Режим владельца'].every(t => zone.textContent.includes(t)));
    const common = [...D.querySelectorAll('main > section')].filter(s => s !== zone && s.querySelector('h2')).map(s => s.textContent);
    T('в общих разделах («Разделы», «Настройки») пунктов владельца нет', common.filter(t => /Игроки и сессия|Звук и вибрация/.test(t)).every(t => !/Управление темами|Шаблоны наказаний|Аналитика|Скрытые вопросы|Режим владельца/.test(t)));
    const secs = [...D.querySelectorAll('main > section')]; const iz = secs.indexOf(zone), iSet = secs.findIndex(s => /Звук и вибрация/.test(s.textContent));
    T('зона владельца идёт после общих настроек и визуально отличается (пунктирная рамка)', iz > iSet && iSet > 0 && /owner-zone-box/.test(zone.innerHTML) && /\.owner-zone-box \{[^}]*dashed/.test(html));
    await clickEl([...zone.querySelectorAll('button')].find(b => /Управление темами/.test(b.textContent)), 500);
    T('пункты зоны владельца работают (открылось «Управление темами»)', D.title === 'Управление темами — ASK ME');

    // ---------- 4: «Новый вопрос» один и закреплён снизу ----------
    await go('#/topics', 600);
    const nq = [...D.querySelectorAll('button')].filter(b => /Новый вопрос/.test(b.textContent));
    T('«Все вопросы» у владельца: одна кнопка «Новый вопрос», закреплена снизу и видна на всех размерах экрана', nq.length === 1 && /fixed bottom-5/.test(nq[0].parentElement.className) && !/lg:hidden/.test(nq[0].parentElement.className) && !D.querySelector('header .btn-primary'));
    await clickEl(btn('Семья'), 600);
    const nq2 = [...D.querySelectorAll('button')].filter(b => /Новый вопрос/.test(b.textContent));
    T('страница темы: тоже одна закреплённая «Новый вопрос» (без дубля в шапке)', nq2.length === 1 && /fixed bottom-5/.test(nq2[0].parentElement.className) && !D.querySelector('header .btn-primary'));

    // ---------- 5: «Скрыть для всех» в тестовой игре ----------
    await go('#/', 600); await click('Начать игру', 700); await click('Тестовый режим', 1500);
    T('тестовый режим открыт', D.title === 'Игра — ASK ME');
    const edit = byLabel('Редактировать вопрос'), hide = byLabel('Скрыть вопрос для всех');
    T('в шапке тестовой игры у владельца есть «Редактировать» и «Скрыть для всех»', !!edit && !!hide && !!hide.closest('header'));
    const n0 = patches.length; await clickEl(hide, 600);
    const p = patches[n0];
    T('«Скрыть для всех» отправляет в базу {hidden:true} для текущего вопроса', !!p && /\/questions\/\w+\.json/.test(p.url) && p.body.hidden === true && typeof p.body.hiddenAt === 'number');
    T('после скрытия: метка «Скрыт» в шапке и кнопка «Вернуть вопрос всем»', !!byLabel('Вернуть вопрос всем') && [...D.querySelectorAll('header .tag')].some(t => /Скрыт/.test(t.textContent)));
    await clickEl(byLabel('Вернуть вопрос всем'), 600);
    const p2 = patches[n0 + 1]; T('«Вернуть вопрос всем» снимает скрытие ({hidden:null}); метка пропала', !!p2 && p2.body.hidden === null && !!byLabel('Скрыть вопрос для всех') && ![...D.querySelectorAll('header .tag')].some(t => /Скрыт/.test(t.textContent)));
    await clickEl(byLabel('Редактировать вопрос'), 600);
    const hb = btn('Скрыть для всех');
    T('на странице «Редактирование» тоже есть «Скрыть для всех» с пояснением', D.title === 'Редактирование вопроса — ASK ME' && !!hb && /Игроки перестанут видеть вопрос/.test(D.body.textContent));
    await clickEl(hb, 600); const p3 = patches[n0 + 2];
    T('со страницы редактирования вопрос скрывается ({hidden:true}); кнопка меняется на «Вернуть вопрос всем», подпись — «Сейчас вопрос скрыт»', !!p3 && p3.body.hidden === true && !!btn('Вернуть вопрос всем') && /Сейчас вопрос скрыт/.test(D.body.textContent));
  }
  console.log(res.join('\n')); console.log('--- captured runtime errors:', errors.length); errors.slice(0, 6).forEach(e => console.log(' ', e)); process.exit(0);
 } catch (err) { console.log(res.join('\n')); console.log('TEST CRASH:', err.message.split('\n')[0], '| title:', D.title, '| body:', D.body.textContent.replace(/\s+/g, ' ').slice(0, 240)); process.exit(1); } })();
