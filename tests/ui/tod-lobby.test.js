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

    // новое лобби: правила, перевороты карточек, свои карточки на устройстве
    A = await boot(); await A.toLobby();
    const shareB = A.btns().find(b => b.textContent.includes('Поделиться сессией')); const startB = A.btn('Начать игру');
    T('кнопка «Поделиться сессией» стоит прямо над «Начать игру»', !!shareB && !!startB && !!(shareB.compareDocumentPosition(startB) & 4) && shareB.parentElement === startB.parentElement.parentElement);
    const strip = A.D.querySelector('.room-strip');
    T('блок состава сессии: имена игроков, одно устройство «Пока только это устройство», метка устройства одна', !!strip && strip.textContent.includes('Макс') && strip.textContent.includes('Аня') && strip.textContent.includes('Пока только это устройство') && strip.querySelectorAll('.room-pips i').length === 1);
    T('блок состава тише кнопки «Поделиться»: у него нет класса btn-* и фон прозрачнее, а сама кнопка заметна', !strip.className.includes('btn-') && shareB.className.includes('btn-secondary'));

    T('лобби: блок «Правила» с правилом про 3 правды подряд и «Пропуск — это позор»', A.text().includes('«Правда» — не больше 3 раз подряд') && A.text().includes('Пропуск — это позор') && !!A.D.querySelector('.tod-lockdemo'));
    T('лобби: «В колоде» считает карточки по текущим настройкам (без жёстких: 7 правд · 7 действий)', A.text().includes('В колоде: 7 правд · 7 действий'));
    const face = A.D.querySelector('.tod-face-truth'); await A.tap(face, 400);
    const faceQ = A.D.querySelector('.tod-face-truth .tod-face-q');
    T('нажатие на карточку «Правда» переворачивает её и показывает пример из базы (не жёсткий)', face.classList.contains('is-flipped') && !!faceQ && /^Правда (лёгкая|средняя)/.test(faceQ.textContent) && face.getAttribute('aria-pressed') === 'true');
    await A.tap(face, 300); T('второе нажатие возвращает карточку лицом', !face.classList.contains('is-flipped'));
    const hardSw = A.D.querySelector('button[role="switch"][aria-label="Жёсткие 18+"]'); await A.tap(hardSw, 300);
    T('«Жёсткие 18+» добавляют в колоду жёсткие карточки: 9 правд · 9 действий', A.text().includes('В колоде: 9 правд · 9 действий')); await A.tap(hardSw, 300);
    T('свои карточки: переключателя нет, пока карточек нет', !A.D.querySelector('button[role="switch"][aria-label="Добавить мои карточки"]') && A.text().includes('Свои карточки · 0'));
    await A.press('Свои карточки', 300);
    const setArea = (v) => { const ta = A.D.querySelector('textarea[aria-label="Текст карточки"]'); Object.getOwnPropertyDescriptor(A.w.HTMLTextAreaElement.prototype, 'value').set.call(ta, v); ta.dispatchEvent(new A.w.Event('input', { bubbles: true })); };
    await A.press('Добавить карточку', 300);
    T('пустой текст не добавляется: показана ошибка', A.text().includes('Введите текст карточки') && A.text().includes('Свои карточки · 0'));
    setArea('Какой у тебя самый странный страх?'); await A.press('Добавить карточку', 400);
    T('своя «Правда» добавлена: счётчик 1, текст в списке, ключ хранилища заполнен, колода 8 правд', A.text().includes('Свои карточки · 1') && A.text().includes('Какой у тебя самый странный страх?') && /странный страх/.test(A.w.localStorage.getItem('askme_tod_mine_v1') || '') && A.text().includes('В колоде: 8 правд · 7 действий'));
    T('после добавления появился переключатель «Добавить мои карточки» и он включён', (() => { const m = A.D.querySelector('button[role="switch"][aria-label="Добавить мои карточки"]'); return !!m && m.getAttribute('aria-checked') === 'true'; })());
    setArea('  какой у тебя самый   странный страх?  '); await A.press('Добавить карточку', 400);
    T('повтор (без учёта регистра и пробелов) отклонён', A.text().includes('Такая карточка у вас уже есть') && A.text().includes('Свои карточки · 1'));
    const m = A.D.querySelector('button[role="switch"][aria-label="Добавить мои карточки"]'); await A.tap(m, 300);
    T('выключенный переключатель убирает свои карточки из колоды: снова 7 правд', A.text().includes('В колоде: 7 правд · 7 действий')); await A.tap(m, 300);
    await A.tap(A.btns().find(b => (b.getAttribute('aria-label') || '').startsWith('Удалить: Какой у тебя')), 300);
    T('удаление своей карточки: счётчик 0, переключатель исчез, хранилище пустое', A.text().includes('Свои карточки · 0') && !A.D.querySelector('button[role="switch"][aria-label="Добавить мои карточки"]') && A.w.localStorage.getItem('askme_tod_mine_v1') === '[]');
    done(A);

    A = await boot({ lang: 'uk' });
    T('украинский интерфейс: карточка режима на экране режимов переведена', !!A.btn('Правда чи дія') && A.text().includes('ганьба за пропуск'));
    await A.press('Правда чи дія', 500);
    T('украинский интерфейс: лобби и кнопка старту переведены', A.hashNow() === '#/tod' && !!A.btn('Почати гру') && A.text().includes('Підколки') && !A.text().includes('Начать игру'));
    await A.press('Почати гру', 500); await A.sleep(520); await A.press('Правда', 450);
    T('украинский интерфейс: экран ходу и подколка переведены', A.heading().startsWith('Хід гравця:') && !!A.btn('Відповів(ла)') && !!A.banter() && !/[ыэъё]/i.test(A.banter()));
    done(A);
  } catch (e) { T('сценарий выполнился без исключений: ' + (e && e.message), false); }
  console.log(res.join('\n')); console.log('--- captured runtime errors: ' + errs.length); errs.slice(0, 5).forEach(e => console.log(e));
  process.exit(res.some(l => l.startsWith('FAIL')) || errs.length ? 1 : 0);
})();
