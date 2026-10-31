// «Правда или действие» на двух устройствах: один вышел на главную («Поставить на паузу») — у второго пауза с отсчётом и шуткой режима;
// вернулся («Продолжить игру») — пауза снимается сама; закрыл вкладку — метка стёрта, пауза снята.
const { boot, waitFor, sleep, txt, devId } = require('../live-helpers.js'); const { DEFAULT_DB } = require('../tod-ui.js');
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const tap = (E, t) => { const b = E.btns().find(x => norm(x.textContent).includes(t) && !x.disabled); if (b) b.dispatchEvent(new E.w.MouseEvent('click', { bubbles: true })); return !!b; };
const press = async (E, t, ms = 450) => { if (!tap(E, t)) throw new Error('нет кнопки «' + t + '» | ' + txt(E).slice(0, 160)); await sleep(ms); };
const heading = (E) => { const h = E.D.querySelector('main h2'); return h ? norm(h.textContent) : ''; };
const onPlay = (E) => E.w.location.hash === '#/tod/play' && /Ход игрока:/.test(heading(E));
const joinTod = async (E) => { const b = [...E.D.querySelectorAll('[role="status"]')].find(x => /Правда или действие/.test(x.textContent)); const k = b && [...b.querySelectorAll('button')].find(x => /Присоединиться/.test(x.textContent)); if (!k) throw new Error('нет «Присоединиться»'); k.dispatchEvent(new E.w.MouseEvent('click', { bubbles: true })); await sleep(900); };
(async () => {
  const S = await boot(2, { tod: DEFAULT_DB }, { players: 2 }); const { devs, db, T } = S; const [A, B] = devs;
  try {
    const ov = (E) => E.D.querySelector('.pause-ov'); const awayKeys = () => Object.keys((db.todRoom() && db.todRoom().p) || {}).filter(k => k.startsWith('away~'));
    await press(A, 'Начать игру', 700); await press(A, 'Правда или действие', 700); await press(A, 'Начать игру', 1200);
    await waitFor(() => /Идёт игра «Правда или действие»/.test(txt(B)), 8000); await joinTod(B); await waitFor(() => onPlay(B), 10000); await sleep(9500);
    T('оба в партии, окна паузы нет', onPlay(A) && onPlay(B) && !ov(A) && !ov(B));
    await press(A, 'Меню', 400); await press(A, 'Поставить на паузу', 900);
    T('A вышел на главную: в канале метка «отошёл»', A.w.location.hash === '#/' && awayKeys().length === 1);
    const seen = await waitFor(() => !!ov(B), 8000);
    T('у B окно «Игра на паузе» с отсчётом; шутка из набора «Правды или действия»', seen && /Игра на паузе/.test(ov(B).textContent) && /\d\d:\d\d/.test(ov(B).querySelector('.pause-clock b').textContent) && ov(B).querySelector('.pause-joke').textContent.length > 15);
    T('экран хода у B остался на месте под окном', onPlay(B));
    await sleep(2500);
    await press(A, 'Продолжить игру', 1800); await waitFor(() => onPlay(A), 8000);
    const gone = await waitFor(() => !ov(B), 8000);
    T('A вернулся в партию: метка стёрта, пауза у B снята сама', onPlay(A) && gone && awayKeys().length === 0);
    await sleep(9500); await press(A, 'Меню', 400); await press(A, 'Поставить на паузу', 900); await waitFor(() => !!ov(B), 8000);
    A.w.dispatchEvent(new A.w.Event('pagehide'));
    T('закрытие вкладки A (pagehide) снимает паузу у B сразу', await waitFor(() => !ov(B) && awayKeys().length === 0, 8000));
    S.finish();
  } catch (e) { S.crash(e); }
})();
