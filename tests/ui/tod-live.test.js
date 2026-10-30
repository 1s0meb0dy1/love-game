// Режим «Правда или действие» на нескольких устройствах: партия в канале live/<комната>_t, приглашение и вход, одновременные нажатия,
// точечная подгрузка карточки, выход одного устройства, «Завершить для всех», лимит устройств и предупреждение 18+ при входе.
const { boot, waitFor, sleep, txt, devId } = require('../live-helpers.js'); const { DEFAULT_DB } = require('../tod-ui.js');

const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const btn = (E, t) => E.btns().find(b => norm(b.textContent).includes(t) && !b.disabled);
const tap = (E, t) => { const b = btn(E, t); if (b) b.dispatchEvent(new E.w.MouseEvent('click', { bubbles: true })); return !!b; };
const press = async (E, t, ms = 450) => { if (!tap(E, t)) throw new Error('нет кнопки «' + t + '» | ' + txt(E).slice(0, 160)); await sleep(ms); };
const heading = (E) => { const h = E.D.querySelector('main h2'); return h ? norm(h.textContent) : ''; };
const cardText = (E) => { const c = E.D.querySelector('.tod-flip-in p'); return c ? norm(c.textContent) : null; };
const banter = (E) => { const b = E.D.querySelector('.tod-banter'); return b ? norm(b.textContent) : null; };
const chickens = (E) => [...E.D.querySelectorAll('.tod-chicken')].map(x => norm(x.textContent));
const onPlay = (E) => E.w.location.hash === '#/tod/play' && /Ход игрока:/.test(heading(E));
const onResults = (E) => E.w.location.hash === '#/tod/results' && /Зал позора/.test(txt(E));
const hasBanner = (E) => /Идёт игра «Правда или действие»/.test(txt(E));
const joinTod = async (E) => { const b = [...E.D.querySelectorAll('[role="status"]')].find(x => /Правда или действие/.test(x.textContent)); const k = b && [...b.querySelectorAll('button')].find(x => /Присоединиться/.test(x.textContent)); if (!k) throw new Error('нет баннера'); k.dispatchEvent(new E.w.MouseEvent('click', { bubbles: true })); await sleep(600); };
// у B и C в общем списке нет карточек «Правда»: их текст они получат только точечным запросом tod/<id>
const noTruth = (E) => { const base = E.w.fetch; E.w.fetch = async (url, init) => { const r = await base(url, init); if (/\/tod\.json/.test(String(url)) && (!init || !init.method || init.method === 'GET')) { const data = await r.json(); const out = {}; Object.entries(data || {}).forEach(([k, v]) => { if (v.type !== 'truth') out[k] = v; }); return { ok: true, status: 200, json: async () => out }; } return r; }; };

(async () => {
  const S = await boot(3, { tod: DEFAULT_DB }, { players: 2, setupB: noTruth }); const { devs, db, T } = S; const [A, B, C] = devs;
  try {
    // A открывает партию
    await press(A, 'Начать игру', 700); await press(A, 'Правда или действие', 700); await press(A, 'Начать игру', 1200);
    T('A открыл игру: в канале active, ведущий A', onPlay(A) && !!db.todRoom() && db.todRoom().status === 'active' && db.todRoom().by === devId(A));
    const sawBanner = await waitFor(() => hasBanner(B), 8000);
    await joinTod(B); const joined = await waitFor(() => onPlay(B), 10000); await sleep(700);
    T('A запускает игру: у B появился баннер, B присоединяется, оба видят «Ход игрока: Макс»', sawBanner && joined && heading(A) === 'Ход игрока: Макс' && heading(B) === 'Ход игрока: Макс');
    await press(A, 'Правда', 300);
    const same1 = await waitFor(() => cardText(B) && cardText(B) === cardText(A) && !/Загружаем/.test(cardText(B)), 8000);
    T('A выбирает «Правда»: у B тот же текст карточки', same1 && /^Правда/.test(cardText(A)));
    const spotId = db.todRoom() && JSON.parse(db.todRoom().st).card.id;
    T('карточка, которой нет у B в todCards, подгружается точечным запросом (stats.gets содержит tod/<id>)', !!spotId && db.stats.gets['tod/' + spotId] >= 1);
    await sleep(600); await press(B, 'Ответил(а)', 300);
    T('B нажимает «Ответил(а)»: у A ход перешёл к Ане', await waitFor(() => heading(A) === 'Ход игрока: Аня' && heading(B) === 'Ход игрока: Аня', 6000));
    await press(A, 'Правда', 300); await waitFor(() => !!cardText(B) && !/Загружаем/.test(cardText(B)), 8000); await sleep(800);
    const seq0 = JSON.parse(db.todRoom().st).seq;
    tap(A, 'Ответил(а)'); tap(B, 'Ответил(а)');
    await sleep(2600);
    const st1 = JSON.parse(db.todRoom().st);
    T('одновременные нажатия на «Ответил(а)»: ход ушёл ровно на одного игрока, на обоих экранах один и тот же игрок', st1.seq === seq0 + 1 && st1.turn === 0 && heading(A) === 'Ход игрока: Макс' && heading(B) === heading(A));
    await press(A, 'Действие', 650); await press(A, 'Средне', 400); await sleep(700); await press(A, 'Пропустить', 300);
    T('пропуск на A виден на B: «🐔 1», тот же игрок «Ход игрока: Макс»', await waitFor(() => chickens(B)[0] === '🐔 1' && heading(B) === heading(A) && heading(A) === 'Ход игрока: Макс', 6000)); // после пропуска ход остаётся у того же игрока
    T('реплика под карточкой одинакова на обоих устройствах', !!banter(A) && banter(A) === banter(B));
    // третье устройство: игроков двое, устройств уже два
    await waitFor(() => hasBanner(C), 8000); await joinTod(C); await sleep(1200);
    T('третье устройство сверх числа игроков не пускают, видно сообщение про число устройств', !onPlay(C) && /В игре уже 2 устройства/.test(txt(C)));
    // B уходит, A продолжает
    await sleep(600); await press(B, 'Меню', 400); await press(B, 'Выйти, остальные продолжат', 900);
    const p = db.todRoom().p;
    T('«Выйти, остальные продолжат» на B не прерывает игру A, в p остаётся только отметка A', B.w.location.hash === '#/more' && onPlay(A) && db.todRoom().status === 'active' && Object.keys(p).length === 1 && !!p[devId(A)]);
    await waitFor(() => hasBanner(B), 8000); await joinTod(B); await waitFor(() => onPlay(B), 10000); await sleep(800);
    await press(A, 'Действие', 650); await press(A, 'Легко', 400); await sleep(700); await press(A, 'Выполнено', 900);
    await press(A, 'Меню', 400); await press(A, 'Завершить для всех', 900);
    const res = await waitFor(() => onResults(B), 6000);
    const table = (E) => [...E.D.querySelectorAll('table td, .tod-table td')].map(x => norm(x.textContent)).join('|');
    T('«Завершить для всех» на A: у B открылись итоги с теми же числами', onResults(A) && res && table(A) !== '' && table(A) === table(B) && db.todRoom().status === 'ended');
    // новая партия с тоном «Острый»: вход с предупреждением 18+
    await press(A, 'Сыграть ещё', 700); await press(A, 'Острый', 300); await press(A, 'Начать игру', 600); await press(A, 'Нам есть 18, начать', 1200);
    const banner2 = await waitFor(() => hasBanner(B), 8000); await joinTod(B); await sleep(900);
    const warned = /Только для взрослых 18\+/.test(txt(B)) && !onPlay(B);
    await press(B, 'Понятно', 600); const after = await waitFor(() => onPlay(B), 6000);
    T('предупреждение 18+ при входе в игру с тоном «Острый»: до «Понятно» экран игры не открыт', banner2 && warned && after);
    T('db.stats.denied === 0 на всём протяжении', db.stats.denied === 0);
    S.finish(0);
  } catch (err) { S.crash(err); }
})();
