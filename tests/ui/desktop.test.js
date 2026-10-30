// Десктопная версия (от 1024 px): верхняя панель, расширенный подвал, раскладка в колонки, игра «Правда или действие» в две колонки.
// Окно «шире 1024 px» имитируется ответом matchMedia; на телефоне (по умолчанию) ничего из этого нет.
const { boot } = require('../tod-ui.js');
const res = []; const T = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n); const errs = [];
const done = (A) => { errs.push(...A.errors); A.close(); };

(async () => {
  try {
    let A = await boot({ hash: '#/' });
    T('телефон: верхней панели и расширенного подвала нет', !A.D.querySelector('.desk-nav') && !A.D.querySelector('.desk-footer') && !!A.btn('Игроки'));
    done(A);

    A = await boot({ hash: '#/', desktop: true });
    const nav = A.D.querySelector('.desk-nav');
    T('компьютер: на главной есть верхняя панель с разделами, ID сессии, звуком, языком и «Меню»', !!nav && ['Главная', 'Играть', 'Вопросы', 'Об игре'].every(t => nav.textContent.includes(t)) && /ID:\s*[A-Z0-9]{8}/.test(nav.textContent) && nav.textContent.includes('Меню') && !!nav.querySelector('.lang-btn') && !!nav.querySelector('button[aria-label="Выключить звук"]'));
    T('«Главная» в панели подсвечена (aria-current), а собственной шапки главной («Игроки», «Меню») нет — не дублируем', nav.querySelector('.desk-link.is-on').textContent === 'Главная' && nav.querySelector('[aria-current="page"]') && ![...A.D.querySelectorAll('main button, .safe-screen > div > button, header button')].some(b => b.textContent.trim() === 'Игроки'));
    const foot = A.D.querySelector('.desk-footer');
    T('расширенный подвал: четыре колонки, ссылки на режимы и документы, подсказка про стрелки', !!foot && foot.querySelectorAll('.desk-fcol').length === 4 && !!foot.querySelector('a[href="#/tod"]') && !!foot.querySelector('a[href="#/privacy"]') && foot.textContent.includes('стрелками'));
    const link = (t) => [...nav.querySelectorAll('.desk-link')].find(b => b.textContent === t);
    await A.tap(link('Играть'), 500);
    T('«Играть» ведёт на экран режимов: три карточки в сетке .mode-grid, панель подсвечивает «Играть»', A.hashNow() === '#/mode' && !!A.D.querySelector('.mode-grid') && A.D.querySelectorAll('.mode-grid > button').length === 3 && A.D.querySelector('.desk-nav .desk-link.is-on').textContent === 'Играть');
    await A.tap(A.D.querySelector('.desk-nav button[aria-label="Выключить звук"]'), 300);
    T('кнопка звука в панели выключает звук и меняет подпись', !!A.D.querySelector('.desk-nav button[aria-label="Включить звук"]'));
    await A.tap([...A.D.querySelectorAll('.desk-nav button')].find(b => b.textContent.trim() === 'Меню'), 500);
    T('«Меню» в панели открывает меню; там колонки .desk-cols и блок «О сессии» с числом игроков и подсказкой про клавиши', A.hashNow() === '#/more' && !!A.D.querySelector('main.desk-cols') && !!A.D.querySelector('.desk-info') && A.D.querySelector('.desk-info').textContent.includes('←') && A.D.querySelectorAll('.lang-btn').length === 1);
    await A.tap(link('Играть'), 400); await A.press('Правда или действие', 600);
    T('лобби «Правды или действия» на компьютере: колонки, кнопка «Поделиться сессией» над «Начать игру»', A.hashNow() === '#/tod' && !!A.D.querySelector('main.desk-cols'));
    await A.startGame();
    T('экран игры: верхней панели нет (чтобы не уйти из партии случайно), раскладка .tod-desk в две колонки', A.hashNow() === '#/tod/play' && !A.D.querySelector('.desk-nav') && !!A.D.querySelector('.tod-desk .tod-desk-main') && !!A.D.querySelector('.tod-desk .tod-desk-side'));
    T('справа: игроки столбиком (.tod-roster.is-col), слева выбор «Правда/Действие» и блок «Ход игрока»', !!A.D.querySelector('.tod-desk-side .tod-roster.is-col') && !!A.D.querySelector('.tod-desk-main .tod-pick-truth') && !!A.D.querySelector('.tod-desk-main .tod-stage') && A.heading() === 'Ход игрока: Макс');
    await A.press('Правда', 500);
    T('после выбора: карточка и «Ход игрока» слева (карточка выше), подколка справа', !!A.D.querySelector('.tod-desk-main .tod-flip') && !!(A.D.querySelector('.tod-desk-main .tod-flip').compareDocumentPosition(A.D.querySelector('.tod-desk-main .tod-stage')) & 4) && !!A.D.querySelector('.tod-desk-side .tod-heckle') && !!A.btn('Ответил(а)'));
    done(A);
  } catch (e) { T('сценарий выполнился без исключений: ' + (e && e.stack), false); }
  console.log(res.join('\n')); console.log('--- captured runtime errors: ' + errs.length); errs.slice(0, 5).forEach(e => console.log(e));
  process.exit(res.some(l => l.startsWith('FAIL')) || errs.length ? 1 : 0);
})();
