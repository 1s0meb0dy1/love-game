// Общие помощники для проверок живой игры: несколько «телефонов» (окон jsdom) с одной сессией и общей базой в памяти.
const makeEnv = require('./harness.js'); const makeDb = require('./fake-rtdb.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// ждать, пока условие станет истинным (до ms миллисекунд); возвращает true/false
const waitFor = async (fn, ms = 8000, step = 100) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch (e) {} await sleep(step); } try { return !!fn(); } catch (e) { return false; } };
const txt = (E) => E.D.body.textContent.replace(/\s+/g, ' ');
const qn = (E) => { const m = txt(E).match(/Вопрос № (\d+)/); return m ? +m[1] : null; };
// кто сейчас отвечает — читаем с метки на карточке, а не из окна рулетки
// номер вопроса в колоде партии («5 / 120» в шапке игры) — в отличие от «Вопрос № …» это порядок в колоде, а не номер в базе
const pos = (E) => { const d = [...E.D.querySelectorAll('header div')].find(x => /^\s*\d+\s*\/\s*\d+\s*$/.test(x.textContent)); return d ? +d.textContent.split('/')[0] : null; };
const who = (E) => { const t = [...E.D.querySelectorAll('.tag')].map(x => x.textContent.trim()).find(x => x.startsWith('Отвечает:')); return t ? t.replace('Отвечает:', '').trim() : null; };
const inGame = (E) => E.D.title === 'Игра — ASK ME';
const onSummary = (E) => E.D.title === 'Итоги игры — ASK ME';
const devId = (E) => E.w.sessionStorage.getItem('askme_dev_v1');
// нажатие без ожидания — чтобы два «телефона» нажимали практически одновременно
const tap = (E, t) => { const b = E.btns().find(x => x.textContent.replace(/\s+/g, ' ').includes(t) && !x.disabled); if (b) b.dispatchEvent(new E.w.MouseEvent('click', { bubbles: true })); return !!b; };
const chip = (E) => { const el = E.D.querySelector('[aria-label^="Устройств в игре"]'); return el ? el.textContent.replace(/\D+/g, '') : ''; };
// закрыть окно рулетки, если оно открыто
// (кнопка «К вопросу» неактивна, пока крутится рулетка, — ждём, пока станет доступной)
const closeRoulette = async (E, wait = 400) => { if (!E.has('К вопросу')) return; await waitFor(() => E.btns().some(x => x.textContent.includes('К вопросу') && !x.disabled), 7000); await E.click('К вопросу', wait); };
// через меню в игре: «Для всех» (завершить у всех) или «Выйти, остальные продолжат»
const openGameMenu = async (E) => { const b = E.btns().find(x => /Меню/.test(x.textContent) && /btn-sm/.test(x.className)); b.dispatchEvent(new E.w.MouseEvent('click', { bubbles: true })); await sleep(400); };

// n телефонов: первый создаёт сессию, остальные открывают ту же сессию (копия профиля), все на главной
async function boot(n, dbOpts, extra = {}) {
  const db = makeDb(dbOpts); const devs = Array.from({ length: n }, () => makeEnv()); devs.forEach(E => db.attach(E));
  const [A] = devs; const res = []; const T = (name, ok) => res.push((ok ? 'PASS ' : 'FAIL ') + name);
  if (extra.setupA) await extra.setupA(A);
  A.w.eval(A.code); await sleep(1800);
  const inputs = [...A.D.querySelectorAll('input[type="text"]')]; A.setVal(inputs[0], 'Макс'); A.setVal(inputs[1], 'Аня'); await sleep(200);
  await A.click('Создать сессию', 1200); await A.click('Перейти к игре', 900);
  for (const E of devs.slice(1)) {
    for (let i = 0; i < A.w.localStorage.length; i++) { const k = A.w.localStorage.key(i); if (k !== 'askme_auth_v2') E.w.localStorage.setItem(k, A.w.localStorage.getItem(k)); }
    if (extra.setupB) await extra.setupB(E);
    E.w.eval(E.code);
  }
  await sleep(2200 + 150 * n);
  const finish = (code = 0) => { console.log(res.join('\n')); const errs = devs.flatMap((E, i) => E.errors.map(e => `[${i}] ${e}`)); console.log('--- captured runtime errors:', errs.length); errs.slice(0, 6).forEach(e => console.log(' ', e)); devs.forEach(E => { try { E.w.close(); } catch (e) {} }); process.exit(code); };
  const crash = (err) => { console.log(res.join('\n')); console.log('TEST CRASH:', err.message.split('\n')[0], '|', devs.map((E, i) => `[${i}] ${E.D.title} ${txt(E).slice(0, 110)}`).join(' | ')); process.exit(1); };
  return { devs, db, T, res, finish, crash };
}
module.exports = { boot, waitFor, sleep, txt, qn, pos, who, inGame, onSummary, devId, tap, chip, closeRoulette, openGameMenu };
