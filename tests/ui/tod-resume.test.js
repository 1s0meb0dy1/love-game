// Режим «Правда или действие»: возврат после перезагрузки страницы (та же карточка и ход, без повторного 18+), итоги после перезагрузки,
// пустой или испорченный канал, перезагрузка без сессии, блокировка старта, пока идёт классическая живая игра, и приглашение в новую партию на экране итогов.
const makeEnv = require('../harness.js');
const { boot, waitFor, sleep, txt, openGameMenu } = require('../live-helpers.js'); const { DEFAULT_DB } = require('../tod-ui.js');

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const btn = (E, t) => E.btns().find(b => norm(b.textContent).includes(t) && !b.disabled);
const tap = (E, t) => { const b = btn(E, t); if (b) b.dispatchEvent(new E.w.MouseEvent('click', { bubbles: true })); return !!b; };
const press = async (E, t, ms = 450) => { if (!tap(E, t)) throw new Error('нет кнопки «' + t + '» | ' + txt(E).slice(0, 160)); await sleep(ms); };
const heading = (E) => { const h = E.D.querySelector('main h2'); return h ? norm(h.textContent) : ''; };
const cardText = (E) => { const c = E.D.querySelector('.tod-flip-in p'); return c ? norm(c.textContent) : null; };
const onPlay = (E) => E.w.location.hash === '#/tod/play' && /Ход игрока:/.test(heading(E));
const onResults = (E) => E.w.location.hash === '#/tod/results' && /Зал позора/.test(txt(E));
const hasBanner = (E) => /Идёт игра «Правда или действие»/.test(txt(E));
const adult = (E) => /Только для взрослых 18\+/.test(txt(E));
const table = (E) => [...E.D.querySelectorAll('table td')].map(x => norm(x.textContent)).join('|');
const joinTod = async (E) => { const b = [...E.D.querySelectorAll('[role="status"]')].find(x => /Правда или действие/.test(x.textContent)); const k = b && [...b.querySelectorAll('button')].find(x => /Присоединиться/.test(x.textContent)); if (!k) throw new Error('нет баннера | ' + txt(E).slice(0, 160)); k.dispatchEvent(new E.w.MouseEvent('click', { bubbles: true })); await sleep(700); if (btn(E, 'Понятно')) await press(E, 'Понятно', 600); };
const startTod = async (E) => { await press(E, 'Начать игру', 600); if (btn(E, 'Нам есть 18, начать')) await press(E, 'Нам есть 18, начать', 1200); };

(async () => {
  const S = await boot(2, { tod: DEFAULT_DB }, { players: 2 }); const { devs, db, T } = S; let [A, B] = devs;
  // «перезагрузка»: новое окно с тем же хранилищем устройства (и тем же id устройства) открывается на адресе hash
  const reload = async (E, hash, { profile = true } = {}) => {
    const N = makeEnv({}); db.attach(N);
    for (let i = 0; i < E.w.localStorage.length; i++) { const k = E.w.localStorage.key(i); N.w.localStorage.setItem(k, E.w.localStorage.getItem(k)); }
    for (let i = 0; i < E.w.sessionStorage.length; i++) { const k = E.w.sessionStorage.key(i); N.w.sessionStorage.setItem(k, E.w.sessionStorage.getItem(k)); }
    if (!profile) N.w.localStorage.removeItem('askme_device_profile_v4');
    N.w.history.replaceState(null, '', '/love-game/' + hash);
    try { E.w.close(); } catch (e) {}
    devs[devs.indexOf(E)] = N; N.w.eval(N.code); await sleep(2600); return N;
  };
  const room = () => db.todRoom(); const st = () => JSON.parse(room().st);
  try {
    await press(A, 'Начать игру', 700); await press(A, 'Правда или действие', 700); await press(A, 'Острый', 300); await startTod(A);
    await waitFor(() => hasBanner(B), 8000); await joinTod(B); await waitFor(() => onPlay(B), 10000); await sleep(700);
    await press(A, 'Правда', 900);
    const c0 = cardText(A), h0 = heading(A), seq0 = st().seq;
    A = await reload(A, '#/tod/play');
    const back = await waitFor(() => onPlay(A) && !!cardText(A), 8000);
    T('A перезагрузил страницу посреди хода на #/tod/play: та же карточка, тот же игрок', back && cardText(A) === c0 && heading(A) === h0 && st().seq === seq0);
    T('перезагрузка не показывает предупреждение 18+ повторно', !adult(A));
    await sleep(600); await press(A, 'Ответил(а)', 700); await press(A, 'Правда', 900);
    const s1 = st();
    T('после перезагрузки следующая выдача — по порядку колоды, а не повтор', cardText(A) !== c0 && s1.cur.truth.i === 2 && s1.cur.truth.round === 0 && cardText(B) === cardText(A));
    await sleep(600); await press(A, 'Меню', 400); await press(A, 'Завершить для всех', 900);
    await waitFor(() => onResults(B), 6000);
    const t0 = table(A);
    A = await reload(A, '#/tod/results');
    T('перезагрузка на #/tod/results после завершения: итоги те же', await waitFor(() => onResults(A), 8000) && table(A) === t0 && t0 !== '');
    // новая партия: B ещё на итогах прошлой
    await press(A, 'Сыграть ещё', 700); await startTod(A);
    T('новая партия («Сыграть ещё» на A): у B на экране итогов появился баннер присоединения', await waitFor(() => onResults(B) && hasBanner(B), 8000));
    await press(A, 'Меню', 400); await press(A, 'Завершить для всех', 900);
    // испорченный канал: состояние не разбирается -> главная, адрес заменён на #/
    const key = db.todRoomKey();
    db.seed(key, ['st'], '{"v":1,"turn":99');
    A = await reload(A, '#/tod/play');
    T('перезагрузка на #/tod/play, когда узел испорчен: главная, адрес заменён на #/', await waitFor(() => A.w.location.hash === '#/' && /Начать игру/.test(txt(A)), 8000) && !onPlay(A));
    db.seed(key, [], null);
    A = await reload(A, '#/tod/play');
    T('перезагрузка на #/tod/play, когда в узле нет игры: главная, адрес заменён на #/', await waitFor(() => A.w.location.hash === '#/' && /Начать игру/.test(txt(A)), 8000));
    const noProf = await reload(A, '#/tod/play', { profile: false }); A = noProf;
    T('перезагрузка без профиля сессии на #/tod/play -> экран без сессии, без ошибок', await waitFor(() => /Создать сессию/.test(txt(A)), 8000) && !onPlay(A) && A.errors.length === 0);
    // вернуть A сессию: профиль из B
    A.w.localStorage.setItem('askme_device_profile_v4', B.w.localStorage.getItem('askme_device_profile_v4'));
    A = await reload(A, '#/');
    // классическая живая игра на B блокирует старт в лобби A
    await press(B, 'В меню', 900); await press(B, 'Начать игру', 700); await press(B, 'Обычный режим', 4500);
    if (btn(B, 'К вопросу')) { await waitFor(() => !!btn(B, 'К вопросу'), 7000); await press(B, 'К вопросу', 400); }
    await press(A, 'Начать игру', 700); await press(A, 'Правда или действие', 700);
    const blocked = await waitFor(() => /В сессии идёт классическая игра — завершите её/.test(txt(A)), 8000);
    await press(A, 'Начать игру', 500);
    T('классическая игра идёт на B: в лобби A старт заблокирован с текстом про классическую игру', blocked && A.w.location.hash === '#/tod');
    await openGameMenu(B); { const ok = [...B.D.querySelectorAll('.viewport-popup-box .grid button')].find(b => b.textContent.trim() !== 'Отмена'); ok.dispatchEvent(new B.w.MouseEvent('click', { bubbles: true })); await sleep(1500); } // один на устройстве — меню сразу спрашивает, завершить ли
    const freed = await waitFor(() => !/В сессии идёт классическая игра/.test(txt(A)), 8000);
    if (freed) await startTod(A);
    T('после завершения классической игры старт доступен', freed && onPlay(A));
    T('db.stats.denied === 0 на всём протяжении', db.stats.denied === 0);
    S.finish(0);
  } catch (err) { S.crash(err); }
})();
