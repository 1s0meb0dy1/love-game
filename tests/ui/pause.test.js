// Пауза партии и общая шапка: в обычной игре и в «Правде или действии» шапка одна (Назад, звук, язык, Меню), из игры можно выйти
// «Поставить на паузу» без завершения, а на главной «Продолжить игру» стоит над «Начать новую игру» и возвращает в ту же партию.
const makeEnv = require('../harness.js');
const { boot } = require('../tod-ui.js');
const SESSION = { sessionId: 'K7M2Q9XA', sessionKey: 'AbCdEfGhIjKlMnOpQrStUv', players: [{ id: 'p1', name: 'Макс', gender: 'guy' }, { id: 'p2', name: 'Аня', gender: 'girl' }], archivedIds: [], disabledIds: [] };
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const results = []; const errors = []; const T = (n, c) => results.push((c ? 'PASS ' : 'FAIL ') + n);
const sig = (b) => b ? [...b.classList].filter(c => /^btn-/.test(c)).sort().join('+') : '';
// шапка: «Назад» и звук — btn-icon, язык и «Меню» — btn-secondary btn-sm; всё в одном ряду .game-head
const headInfo = (D) => { const h = D.querySelector('header.game-head'); if (!h) return null; const bs = [...h.querySelectorAll('button')];
  return { n: bs.length, back: bs.find(b => b.getAttribute('aria-label') === 'Назад'), sound: bs.find(b => /звук/.test(b.getAttribute('aria-label') || '')), lang: h.querySelector('.lang-btn'), menu: bs.find(b => norm(b.textContent).startsWith('Меню')) }; };
const headOk = (D) => { const i = headInfo(D); return !!i && !!i.back && !!i.sound && !!i.lang && !!i.menu && sig(i.back) === 'btn-icon' && sig(i.sound) === 'btn-icon' && /btn-secondary/.test(sig(i.lang)) && /btn-sm/.test(sig(i.lang)) && sig(i.menu) === 'btn-secondary+btn-sm'; };
const path = (el) => { const p = el && el.querySelector('svg path'); return p ? p.getAttribute('d') : ''; };

(async () => {
 try {
  // ── обычная игра ──
  { const A = makeEnv(); const ids = Object.values(A.exp).slice(0, 40).map(q => q.id);
    A.w.localStorage.setItem('askme_device_profile_v4', JSON.stringify({ ...SESSION, savedGame: { questionIds: ids, currentIndex: 12, maxReachedIndex: 12, turnHistory: {} }, updatedAt: Date.now() }));
    A.w.history.replaceState(null, '', '#/play'); A.w.eval(A.code); await A.sleep(2500);
    const { w, D, has, click } = A; const t = (n, c) => T('обычная игра: ' + n, c);
    t('шапка: «Назад», звук, язык, «Меню» одним рядом нужных размеров', headOk(D));
    const m0 = A.btns().find(b => /Меню/.test(b.textContent) && /btn-sm/.test(b.className)); m0.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await A.sleep(400);
    t('«Меню» спрашивает «Вы действительно хотите закончить игру?» с паузой, «Отмена» и «Выйти»', has('Вы действительно хотите закончить игру?') && has('Поставить на паузу') && has('Отмена') && A.btns().some(b => norm(b.textContent) === 'Выйти'));
    await click('Отмена', 300);
    t('«Отмена» закрывает окно, игра на месте', !has('Вы действительно хотите закончить игру?') && w.location.hash === '#/play');
    const back = headInfo(D).back; back.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await A.sleep(400);
    t('стрелка «Назад» в шапке открывает то же окно', has('Поставить на паузу') && has('Вы действительно хотите закончить игру?'));
    await click('Поставить на паузу', 700);
    t('«Поставить на паузу» уводит на главную, партия не завершена и не в архиве', w.location.hash === '#/' && D.title.startsWith('ASK ME —') && !has('Итоги'));
    const saved = JSON.parse(w.localStorage.getItem('askme_device_profile_v4')).savedGame;
    t('сохранённая партия на месте: 40 вопросов, 13-й', !!saved && saved.questionIds.length === 40 && saved.currentIndex === 12);
    const bs = A.btns(); const iR = bs.findIndex(b => norm(b.textContent).startsWith('Продолжить игру')); const iS = bs.findIndex(b => norm(b.textContent).includes('Начать новую игру'));
    t('на главной «Продолжить игру» стоит над «Начать новую игру»', iR >= 0 && iS > iR);
    t('у кнопок разные значки (продолжить — стрелки по кругу, начать — треугольник)', !!path(bs[iR]) && !!path(bs[iS]) && path(bs[iR]) !== path(bs[iS]) && /M8 5\.14/.test(path(bs[iS])) && !/M8 5\.14/.test(path(bs[iR])));
    t('на «Продолжить игру» показан номер вопроса', /вопрос\s*13/.test(norm(bs[iR].textContent)));
    await click('Продолжить игру', 1500);
    t('«Продолжить игру» возвращает в ту же партию (13-й вопрос из 40)', w.location.hash === '#/play' && /13\s*\/\s*40/.test(norm(D.body.textContent)));
    errors.push(...A.errors); }

  // ── «Правда или действие» ──
  { const A = await boot({ hash: '#/mode' }); const t = (n, c) => T('«Правда или действие»: ' + n, c);
    await A.toLobby(); await A.startGame(); await A.sleep(400);
    t('шапка та же, что в обычной игре: «Назад», звук, язык, «Меню»', headOk(A.D));
    t('на экране нет блока с правилом «не больше 3 раз подряд»', !A.D.querySelector('.tod-ruleline') && !/не больше 3 раз подряд/.test(A.text()));
    await A.press('Правда', 450); const cardTxt = A.cardBody();
    t('после выбора на экране карточка с текстом', !!cardTxt);
    await A.press('Меню', 400);
    t('«Меню» открывает окно с паузой, «Отмена» и «Выйти»', A.text().includes('Вы действительно хотите закончить игру?') && !!A.btn('Поставить на паузу') && !!A.btn('Выйти') && !!A.btn('Отмена'));
    await A.press('Поставить на паузу', 700);
    t('пауза: главная, партия не завершена, снимок лежит на устройстве', A.hashNow() === '#/' && !!A.w.localStorage.getItem('askme_tod_pause_v1'));
    const bs = A.btns(); const iR = bs.findIndex(b => norm(b.textContent).startsWith('Продолжить игру')); const iS = bs.findIndex(b => norm(b.textContent).includes('Начать новую игру'));
    t('на главной «Продолжить игру · Правда или действие» над «Начать новую игру», значки разные', iR >= 0 && iS > iR && /Правда или действие/.test(norm(bs[iR].textContent)) && path(bs[iR]) !== path(bs[iS]));
    await A.tap(bs[iR], 1200);
    t('«Продолжить игру» возвращает в партию на той же карточке', A.hashNow() === '#/tod/play' && A.cardBody() === cardTxt && !A.w.localStorage.getItem('askme_tod_pause_v1'));
    A.close(); errors.push(...A.errors); }
 } catch (err) { console.log(results.join('\n')); console.log('TEST CRASH:', err.stack.split('\n').slice(0, 4).join(' | ')); process.exit(1); }
 console.log(results.join('\n')); console.log('--- captured runtime errors:', errors.length); errors.slice(0, 6).forEach(e => console.log(' ', e)); process.exit(0);
})();
