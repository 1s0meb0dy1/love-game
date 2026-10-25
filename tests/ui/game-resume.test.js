// Игра не должна обрываться: после перезагрузки страницы (вышла новая версия, телефон выгрузил вкладку) партия возвращается сама,
// а не отправляет в главное меню; в самой партии вылета из игры нет, сколько бы вопросов ни прошли.
const makeEnv = require('../harness.js');
const SESSION = { sessionId: 'K7M2Q9XA', sessionKey: 'AbCdEfGhIjKlMnOpQrStUv', players: [{ id: 'p1', name: 'Макс', gender: 'guy' }, { id: 'p2', name: 'Аня', gender: 'girl' }], archivedIds: [], disabledIds: [] };
// перезагрузка страницы: новая среда, в хранилище — то, что осталось от прошлой, а адрес — как был
const reload = async (hash, saved, opts = {}) => { const A = makeEnv(opts); const ids = Object.values(A.exp).slice(0, 40).map(q => q.id);
  A.w.localStorage.setItem('askme_device_profile_v4', JSON.stringify({ ...SESSION, savedGame: saved === 'deck' ? { questionIds: ids, currentIndex: 12, maxReachedIndex: 12, turnHistory: {} } : saved, updatedAt: Date.now() }));
  A.w.history.replaceState(null, '', hash); A.w.eval(A.code); await A.sleep(2500); A.ids = ids; return A; };
const qnum = (A) => { const m = A.D.body.textContent.match(/Вопрос № (\d+)/); return m ? +m[1] : null; };

(async () => { const results = []; let errors = [];
 try {
  { const A = await reload('#/play', 'deck'); const { w, D, has, T, res } = A;
    T('страница перезагрузилась на экране игры — партия вернулась сама, адрес #/play', w.location.hash === '#/play' && D.title.startsWith('Игра') && qnum(A) !== null);
    T('вернулись на тот же вопрос (13-й из сохранения), а не на первый', /13\s*\/\s*40/.test(D.body.textContent.replace(/\s+/g, ' ')));
    T('в меню не выкинуло: кнопки «Продолжить игру» на экране нет', !has('Продолжить игру'));
    const saved = JSON.parse(w.localStorage.getItem('askme_device_profile_v4')).savedGame; T('сохранённая партия на месте (40 вопросов, 13-й)', saved && saved.questionIds.length === 40 && saved.currentIndex === 12);
    results.push(...res); errors.push(...A.errors); }
  { const A = await reload('#/play', null); const { w, D, T, res } = A;
    T('перезагрузка на экране игры, а сохранённой партии нет — спокойно открывается главная', w.location.hash === '#/' && D.title.startsWith('ASK ME —'));
    results.push(...res); errors.push(...A.errors); }
  { const A = await reload('#/play', { questionIds: ['нет_такого_1', 'нет_такого_2'], currentIndex: 1, maxReachedIndex: 1, turnHistory: {} }); const { w, D, T, res } = A;
    T('сохранённая партия из удалённых вопросов не зацикливает: открывается главная, битое сохранение убрано', w.location.hash === '#/' && D.title.startsWith('ASK ME —') && JSON.parse(w.localStorage.getItem('askme_device_profile_v4')).savedGame === null);
    results.push(...res); errors.push(...A.errors); }
  for (const [hash, name] of [['#/summary', 'итогов'], ['#/ai', 'разбора ответа']]) { const A = await reload(hash, 'deck'); const { w, D, has, T, res } = A;
    T('перезагрузка на экране ' + name + ' (' + hash + ') открывает главную с «Продолжить игру», а не пустую страницу', w.location.hash === '#/' && has('Продолжить игру'));
    results.push(...res); errors.push(...A.errors); }
  // длинная партия: ни разу не выкидывает из игры (время ускорено — рулетка и таймеры идут в 15 раз быстрее)
  { const A = makeEnv({ bigDb: 2000 }); const { w, D, sleep, has, click, setVal, T, res } = A; const st = w.setTimeout.bind(w); w.setTimeout = (fn, ms, ...a) => st(fn, ms > 60 ? Math.round(ms / 15) : ms, ...a);
    w.eval(A.code); await sleep(2500); const inputs = [...D.querySelectorAll('input[type="text"]')]; setVal(inputs[0], 'Макс'); setVal(inputs[1], 'Аня'); await sleep(200);
    await click('Создать сессию', 1500); await click('Перейти к игре', 900); await click('Начать игру', 700); await click('Обычный режим', 1500); await click('К вопросу', 500);
    let steps = 0, seen = new Set([qnum(A)]), left = null;
    for (; steps < 160; steps++) {
      if (!has('Вопрос №') || w.location.hash !== '#/play') { left = { steps, hash: w.location.hash }; break; }
      // Ждём ускоренную рулетку, закрываем её, отвечаем обоими игроками и переходим дальше.
      // Клик сквозь ещё открытую рулетку больше не должен пропускать вопрос.
      await sleep(250); await click('К вопросу', 70);
      await click('Далее', 70); await click('Далее', 70); await click('Далее', 70);
      seen.add(qnum(A));
    }
    T('160 шагов партии подряд (' + seen.size + ' разных вопросов): из игры не выкинуло ни разу' + (left ? ' — вышли на шаге ' + left.steps + ' (' + left.hash + ')' : ''), !left && seen.size > 150);
    T('после длинной партии сохранение хранит прогресс, «Продолжить игру» будет доступно', JSON.parse(w.localStorage.getItem('askme_device_profile_v4')).savedGame.maxReachedIndex >= 150);
    results.push(...res); errors.push(...A.errors); }
  console.log(results.join('\n')); console.log('--- captured runtime errors:', errors.length); errors.slice(0, 6).forEach(e => console.log(' ', e)); process.exit(0);
 } catch (err) { console.log(results.join('\n')); console.log('TEST CRASH:', err.stack.split('\n').slice(0, 3).join(' | ')); process.exit(1); } })();
