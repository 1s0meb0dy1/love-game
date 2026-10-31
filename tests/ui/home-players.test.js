// Главная и общие правки: игроки «таблетками» с меню, подзаголовок в одну строку, окно выхода, версия, «Наверх» с касания, копирование текста на информационных страницах.
const { boot } = require('../tod-ui.js');
const res = []; const T = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n); const errs = [];
const done = (A) => { errs.push(...A.errors); A.close(); };
const css = require('fs').readFileSync(require('path').join(__dirname, '../../src/styles.css'), 'utf8');
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();

(async () => {
  try {
    let A = await boot({ names: ['Макс', 'Аня', 'Ира'], hash: '#/' });
    const pills = () => [...A.D.querySelectorAll('.pl-pill')];
    T('главная (компания): имена в таблетках .pl-pill, справа от имени эмодзи, по числу игроков', pills().length === 3 && pills().every(p => p.querySelector('.pl-name') && p.querySelector('.pl-emo') && p.lastElementChild.classList.contains('pl-emo')));
    T('подзаголовок один (.home-sub), без переносов (white-space: nowrap) и с размером от длины фразы', !!A.D.querySelector('.home-sub') && /\.home-sub \{[^}]*white-space: nowrap/.test(css) && /--sub-em/.test(A.D.querySelector('.home-sub').getAttribute('style')) && /компании/.test(A.D.querySelector('.home-sub').textContent));
    await A.tap(pills()[0], 200);
    const menu = () => A.D.querySelector('.pl-menu');
    T('нажатие на имя открывает меню: «Поделиться сессией», «Изменить имя», «Удалить игрока», «Отмена»', !!menu() && [...menu().querySelectorAll('[role="menuitem"]')].map(b => norm(b.textContent)).join('|') === 'Поделиться сессией|Изменить имя|Удалить игрока|Отмена' && pills()[0].getAttribute('aria-expanded') === 'true');
    await A.tap([...menu().querySelectorAll('button')].find(b => /Отмена/.test(b.textContent)), 200);
    T('«Отмена» закрывает меню', !menu());
    await A.tap(pills()[0], 200); await A.tap([...menu().querySelectorAll('button')].find(b => /Изменить имя/.test(b.textContent)), 300);
    const inp = A.D.querySelector('.viewport-popup-box input.pl-input');
    T('«Изменить имя» открывает окно с полем, где уже стоит текущее имя', !!inp && inp.value === 'Макс');
    const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(A.w.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new A.w.Event('input', { bubbles: true })); };
    setVal(inp, '   '); await A.sleep(100); await A.tap(A.btn('Сохранить'), 200);
    T('пустое имя не сохраняется: окно остаётся и показывает ошибку', !!A.D.querySelector('.viewport-popup-box input.pl-input') && /Введите имя/.test(A.text()));
    setVal(A.D.querySelector('.viewport-popup-box input.pl-input'), 'Максим<b>7'); await A.sleep(100); await A.tap(A.btn('Сохранить'), 400);
    T('новое имя очищается от «<>» и цифр и сразу видно на главной', !A.D.querySelector('.viewport-popup-box input.pl-input') && pills()[0].textContent.startsWith('Максимb') && !pills()[0].textContent.includes('<'));
    const saved = JSON.parse(A.w.localStorage.getItem('askme_device_profile_v4') || '{}');
    T('имя записано в профиль на устройстве', saved.players && saved.players[0].name === 'Максимb');
    await A.tap(pills()[1], 200); await A.tap([...menu().querySelectorAll('button')].find(b => /Удалить игрока/.test(b.textContent)), 300);
    T('«Удалить игрока» просит подтверждение с именем', /Удалить игрока «Аня»\?/.test(A.text()));
    await A.tap([...A.D.querySelectorAll('.viewport-popup-box button')].find(b => b.textContent.trim() === 'Отмена'), 200);
    T('отмена удаления: игроков по-прежнему три', pills().length === 3);
    await A.tap(pills()[1], 200); await A.tap([...menu().querySelectorAll('button')].find(b => /Удалить игрока/.test(b.textContent)), 300);
    await A.tap([...A.D.querySelectorAll('.viewport-popup-box button')].find(b => b.textContent.trim() === 'Удалить'), 400);
    T('удаление: остаётся два игрока, Ани нет', pills().length === 2 && !pills().some(p => p.textContent.includes('Аня')));
    await A.tap(pills()[0], 200); await A.tap([...menu().querySelectorAll('button')].find(b => /Удалить игрока/.test(b.textContent)), 300);
    T('двух игроков удалить нельзя: подтверждения нет, показано предупреждение', !/Удалить игрока «/.test(A.text()) && pills().length === 2 && /минимум два игрока/.test(A.text()));
    await A.tap(pills()[0], 200); await A.tap([...menu().querySelectorAll('button')].find(b => /Поделиться сессией/.test(b.textContent)), 400);
    T('«Поделиться сессией» открывает страницу приглашения (#/invite)', A.hashNow() === '#/invite');
    done(A);

    // экран режимов: игроки — аккордеон внизу, подсказка «до 10 игроков»
    A = await boot({ names: ['Макс', 'Аня'], hash: '#/mode' });
    const acc = A.D.querySelector('.room-acc'); const mainEl = A.D.querySelector('main');
    T('«Выберите режим»: «Состав сессии» — закрытый аккордеон в самом низу экрана (последний в main, над подвалом)', !!acc && mainEl.lastElementChild === acc && !acc.classList.contains('is-open') && acc.querySelector('.room-acc-head').getAttribute('aria-expanded') === 'false');
    T('подсказка на экране режимов: «до 10 игроков», а не число устройств', /до 10 игроков/.test(A.text()) && !/до 2 устройств/.test(A.text()));
    await A.tap(acc.querySelector('.room-acc-head'), 250);
    T('аккордеон раскрывается: видны имена и «Пока только это устройство»', acc.classList.contains('is-open') && acc.textContent.includes('Макс') && acc.textContent.includes('Пока только это устройство'));
    T('закрытый аккордеон скрыт от Tab и скринридера (visibility), открытый — виден', /\.room-acc-body \{[^}]*visibility: hidden/.test(css) && /\.room-acc\.is-open \.room-acc-body \{[^}]*visibility: visible/.test(css));
    await A.tap(A.D.querySelector('.room-acc-head'), 250);
    done(A);

    // окно выхода и «Наверх»
    A = await boot({ names: ['Макс', 'Аня'], hash: '#/tod' }); await A.startGame();
    await A.press('Меню', 400);
    const box = A.D.querySelector('.viewport-popup-box .exit-dlg');
    const order = box ? [...box.children].map(c => c.className.split(' ')[0] || c.tagName).join(',') : '';
    T('«Правда или действие»: окно выхода — заголовок, пауза, линия, «Отмена»/«Выйти», пояснение под кнопками; описания «Можно поставить игру на паузу» нет', order === 'exit-dlg-t,btn-primary,exit-dlg-rule,exit-dlg-row,exit-dlg-note' && !/Можно поставить игру на паузу/.test(A.text()) && !!A.btn('Выйти') && !!A.btn('Отмена') && !A.btn('Да'));
    await A.press('Отмена', 300);
    await A.sleep(800); await A.press('Действие', 900); await A.tap([...A.D.querySelectorAll('button.tod-lvl')].find(b => !b.disabled), 1000);
    const acts = [...A.D.querySelectorAll('.tod-actions > button')].map(b => norm(b.textContent));
    T('карточка: «Пропустить» слева, «Выполнено» справа', acts.length === 2 && /Пропустить/.test(acts[0]) && /Выполнено/.test(acts[1]));
    done(A);

    A = await boot({ names: ['Макс', 'Аня'], hash: '#/tod' }); await A.startGame();
    await A.sleep(300);
    const stage = A.D.querySelector('.tod-stage'); const pick = A.D.querySelector('.tod-choose');
    T('выбор «Правда/Действие»: блок «Ход игрока» стоит выше карточек выбора, у обеих карточек есть нижняя строка (серия точек / пустая) для выравнивания', !!stage && !!pick && !!(stage.compareDocumentPosition(pick) & 4) && A.D.querySelectorAll('.tod-pick > .tod-pick-foot').length === 2);
    done(A);

    // версия, «Наверх», копирование текста
    A = await boot({ names: ['Макс', 'Аня'], hash: '#/about' });
    T('подвал показывает версию «Версия 0.1.29а»', /Версия 0\.1\.29а/.test(A.D.querySelector('footer').textContent));
    T('страница «Об игре» помечена .selectable (текст можно выделять и копировать), а в стилях кнопки остаются невыделяемыми', !!A.D.querySelector('.safe-screen.selectable') && /\.selectable[^{]*\{[^}]*user-select: text/.test(css) && /\.selectable :where\(button[^{]*\{[^}]*user-select: none/.test(css));
    done(A);
    A = await boot({ names: ['Макс', 'Аня'], hash: '#/privacy' });
    T('документ (#/privacy) тоже .selectable', !!A.D.querySelector('.safe-screen.selectable'));
    const topB = A.D.querySelector('.to-top'); let called = 0; A.w.scrollTo = () => { called++; };
    { const pd = new A.w.Event('pointerdown', { bubbles: true }); pd.pointerType = 'touch'; pd.button = 0; topB.dispatchEvent(pd); } await A.sleep(50);
    topB.dispatchEvent(new A.w.MouseEvent('click', { bubbles: true })); await A.sleep(50);
    T('«Наверх»: палец срабатывает с первого касания (pointerdown), следующий click не дублирует прокрутку', called === 1);
    topB.dispatchEvent(new A.w.MouseEvent('click', { bubbles: true })); await A.sleep(900); topB.dispatchEvent(new A.w.MouseEvent('click', { bubbles: true })); await A.sleep(50);
    T('мышь и клавиатура: обычный click тоже работает', called >= 2);
    done(A);

    T('прокрутка колёсиком: html режет по горизонтали, body — clip (не контейнер прокрутки), overscroll только у html', /\nhtml \{ overflow-x: hidden; overscroll-behavior-y: none; \}\nbody \{ overflow-x: visible; overscroll-behavior-y: auto; \}\n@supports \(overflow: clip\) \{ body \{ overflow-x: clip; \} \}/.test(css));
    T('шапка ниже верхнего края: .safe-screen не меньше 2 rem сверху', /:root \.safe-screen \{ padding-top: max\(2rem, calc\(env\(safe-area-inset-top\) \+ 0\.75rem\)\); \}/.test(css));
  } catch (e) { T('сценарий выполнился без исключений: ' + e, false); }
  console.log(res.join('\n')); console.log('--- captured runtime errors: ' + errs.length); errs.slice(0, 5).forEach(e => console.log(' ', e)); process.exit(0);
})();
