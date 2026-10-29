// Режим «Правда или действие»: карточка на экране режимов, лобби #/tod, предупреждение 18+, запуск и блокировки старта.
const { boot, DEFAULT_DB, card } = require('../tod-ui.js');
const res = []; const T = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n); const errs = [];
const done = (A) => { errs.push(...A.errors); A.close(); };

(async () => {
  try {
    let A = await boot();
    const modeCard = A.btn('Правда или действие');
    T('на экране режимов есть карточка «Правда или действие»', A.hashNow() === '#/mode' && !!modeCard && modeCard.className.includes('opt-card') && A.text().includes('позор за пропуск. 18+'));
    await A.toLobby();
    T('лобби: адрес #/tod, заголовок, оба игрока в списке', A.hashNow() === '#/tod' && A.D.title === 'Правда или действие — ASK ME' && [...A.D.querySelectorAll('main li')].map(li => li.textContent).join('|').includes('Макс') && A.text().includes('Аня'));
    const tone = (t) => A.btns().find(b => b.textContent.trim() === t && b.hasAttribute('aria-pressed'));
    const sw = () => A.D.querySelector('button[role="switch"][aria-label="Жёсткие 18+"]');
    T('по умолчанию тон «Мягкий» выбран (aria-pressed), «Жёсткие 18+» выключены', tone('Мягкий').getAttribute('aria-pressed') === 'true' && tone('Выкл').getAttribute('aria-pressed') === 'false' && sw() && sw().getAttribute('aria-checked') === 'false');
    await A.press('Начать игру', 500);
    T('«Начать игру» без предупреждения запускает игру: #/tod/play', A.hashNow() === '#/tod/play' && A.D.title === 'Игра — Правда или действие — ASK ME' && A.heading() === 'Ход игрока: Макс');
    done(A);

    A = await boot(); await A.toLobby();
    await A.tap(A.D.querySelector('button[role="switch"][aria-label="Жёсткие 18+"]'));
    await A.press('Начать игру', 400);
    const warnShown = A.text().includes('Игра для взрослых: откровенные карточки, вульгарность и чёрный юмор. Пропуск засчитывается в итогах как позор. Играйте только с теми, кому комфортно.');
    const back = A.btns().filter(b => b.textContent.trim() === 'Назад').pop(); await A.tap(back, 400);
    T('включены «Жёсткие 18+» -> перед стартом предупреждение 18+; «Назад» остаёмся в лобби', warnShown && A.hashNow() === '#/tod' && !A.text().includes('Игра для взрослых'));
    await A.tap(A.D.querySelector('button[role="switch"]')); // выключить жёсткие
    await A.tap(A.btns().find(b => b.textContent.trim() === 'Острый' && b.hasAttribute('aria-pressed')));
    await A.press('Начать игру', 400);
    const warn2 = A.text().includes('Игра для взрослых');
    await A.press('Нам есть 18, начать', 500);
    T('тон «Острый» -> то же предупреждение; подтверждение запускает игру', warn2 && A.hashNow() === '#/tod/play');
    done(A);

    const onlyTruth = {}; Object.values(DEFAULT_DB).filter(c => c.type === 'truth').forEach(c => { onlyTruth[c.id] = c; });
    A = await boot({ seed: onlyTruth }); await A.toLobby();
    await A.press('Начать игру', 400);
    T('в базе только «Правда» (нет «Действия») -> старт заблокирован, видна причина', A.hashNow() === '#/tod' && A.text().includes('Нет карточек «Действие»'));
    done(A);

    const onlyHardDare = { ...onlyTruth, td_dh1: card('td_dh1', 'dare', 'hard', 'Жёсткое действие') };
    A = await boot({ seed: onlyHardDare }); await A.toLobby();
    const blockedSoft = A.text().includes('Нет карточек «Действие»');
    await A.tap(A.D.querySelector('button[role="switch"]'));
    T('«Действие» только жёсткое: без «Жёстких» старт заблокирован, с ними — доступен', blockedSoft && !A.text().includes('Нет карточек «Действие»'));
    done(A);

    A = await boot({ names: ['Макс'] }); await A.toLobby();
    await A.press('Начать игру', 400);
    T('в сессии 1 игрок -> старт заблокирован, видна причина «минимум два игрока»', A.hashNow() === '#/tod' && A.text().includes('минимум два игрока'));
    done(A);

    A = await boot(); await A.toLobby();
    await A.press('Поделиться сессией', 500);
    const inInvite = A.hashNow() === '#/invite';
    await A.tap(A.D.querySelector('button[aria-label="Назад"]'), 500);
    T('кнопка «Поделиться сессией» открывает экран приглашения, «Назад» возвращает в лобби', inInvite && A.hashNow() === '#/tod');
    await A.tap(A.D.querySelector('button[aria-label="Назад"]'), 400);
    T('«Назад» из лобби — на экран режимов', A.hashNow() === '#/mode');
    done(A);

    A = await boot({ hash: '#/tod/play' });
    T('адрес #/tod/play без партии (перезагрузка) -> главная', A.hashNow() === '#/' && !A.text().includes('Ход игрока'));
    done(A);

    A = await boot({ lang: 'uk' });
    T('украинский интерфейс: карточка режима на экране режимов переведена', !!A.btn('Правда чи дія') && A.text().includes('сором за пропуск'));
    await A.press('Правда чи дія', 500);
    T('украинский интерфейс: лобби и кнопка старту переведены', A.hashNow() === '#/tod' && !!A.btn('Почати гру') && A.text().includes('Підколки') && !A.text().includes('Начать игру'));
    await A.press('Почати гру', 500); await A.sleep(520); await A.press('Правда', 450);
    T('украинский интерфейс: экран ходу и подколка переведены', A.heading().startsWith('Хід гравця:') && !!A.btn('Відповів(ла) — передати хід') && !!A.banter() && !/[ыэъё]/i.test(A.banter()));
    done(A);
  } catch (e) { T('сценарий выполнился без исключений: ' + (e && e.message), false); }
  console.log(res.join('\n')); console.log('--- captured runtime errors: ' + errs.length); errs.slice(0, 5).forEach(e => console.log(e));
  process.exit(res.some(l => l.startsWith('FAIL')) || errs.length ? 1 : 0);
})();
