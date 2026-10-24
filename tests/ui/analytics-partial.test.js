// Игра, которую бросили на середине, попадает в аналитику: промежуточная запись после 10 пройденных вопросов (затем каждые 5
// и при сворачивании приложения), а итог игры перезаписывает её под тем же номером. Владелец и отказ от статистики ничего не отправляют.
const makeEnv = require('../harness.js');
const A = makeEnv(); const { w, D, sleep, errors } = A; const res = []; const T = (n, ok) => res.push((ok ? 'PASS ' : 'FAIL ') + n);
const reqs = []; const baseFetch = w.fetch;
w.fetch = async (url, opt) => { url = String(url); const m = url.match(/\/analytics\/(anon|full)\/(\w+)\.json/); if (m) { reqs.push({ method: (opt && opt.method) || 'GET', kind: m[1], aid: m[2], body: opt && opt.body ? JSON.parse(opt.body) : null }); return { ok: true, status: 200, json: async () => null }; } return baseFetch(url, opt); };
const clickEl = async (el, ms = 250) => { if (!el) throw new Error('нет элемента'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await sleep(ms); };
const game = (r) => { const e = Object.entries(r.body).find(([k]) => k.startsWith('games/')); return e ? { gid: e[0].slice(6), g: e[1] } : null; };
(async () => { try {
  w.eval(A.code); await sleep(1800);
  const inputs = [...D.querySelectorAll('input[type="text"]')]; A.setVal(inputs[0], 'Макс'); A.setVal(inputs[1], 'Аня'); await sleep(200);
  await A.click('Создать сессию', 1200); await A.click('Перейти к игре', 900);
  await A.click('Начать игру', 700); await A.click('Обычный режим', 3800); await A.click('К вопросу', 600);
  // подменяем сохранённую партию: 14 вопросов уже пройдены обоими игроками, мы на 15-м
  const prof = JSON.parse(w.localStorage.getItem('askme_device_profile_v4')); const sg = prof.savedGame;
  const ids = sg.questionIds; const hist = {}; for (let i = 0; i < 14; i++) hist[i] = { cur: null, answered: prof.players.map(p => p.id), skippedBy: i === 3 ? [prof.players[0].id] : [], skippedAll: false };
  prof.savedGame = { questionIds: ids, currentIndex: 14, maxReachedIndex: 14, turnHistory: hist };
  const B = makeEnv(); const bReqs = [];
  const bBase = B.w.fetch; B.w.fetch = async (url, opt) => { url = String(url); const m = url.match(/\/analytics\/(anon|full)\/(\w+)\.json/); if (m) { bReqs.push({ method: (opt && opt.method) || 'GET', kind: m[1], aid: m[2], body: opt && opt.body ? JSON.parse(opt.body) : null }); return { ok: true, status: 200, json: async () => null }; } return bBase(url, opt); };
  for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); if (k !== 'askme_auth_v2') B.w.localStorage.setItem(k, w.localStorage.getItem(k)); }
  B.w.localStorage.setItem('askme_device_profile_v4', JSON.stringify(prof)); B.w.localStorage.setItem('askme_sess_' + prof.sessionId, JSON.stringify(prof));
  w.close();
  B.w.eval(B.code); await sleep(2200);
  T('после перезапуска есть кнопка «Продолжить игру»', !!B.btns().find(b => /Продолжить игру/.test(b.textContent)));
  await B.click('Продолжить игру', 700); await B.click('К вопросу', 600).catch(() => {});
  T('партия продолжена с 15-го вопроса', /15\s*\/\s*\d+/.test(B.D.body.textContent.replace(/\s+/g, ' ')) && B.D.title === 'Игра — ASK ME');
  T('пока пройдено 14 вопросов (< 15) в аналитику ничего не ушло', bReqs.filter(r => r.method === 'PATCH').length === 0);
  // 15-й вопрос: отвечает первый, потом второй, потом «Далее» к 16-му
  for (let i = 0; i < 6 && !/16\s*\/\s*\d+/.test(B.D.body.textContent.replace(/\s+/g, ' ')); i++) { await B.click('Далее', 700); await B.click('К вопросу', 300).catch(() => {}); if (i % 2) await sleep(2800); }
  await sleep(1200);
  const pa = bReqs.filter(r => r.method === 'PATCH' && r.kind === 'anon'), pf = bReqs.filter(r => r.method === 'PATCH' && r.kind === 'full');
  T('на 15 пройденных вопросах отправлена промежуточная запись (обезличенная и полная, под одним ID)', pa.length >= 1 && pf.length >= 1 && pa[0].aid === pf[0].aid);
  const g1 = game(pa[0]);
  T('в записи пометка «игра идёт» (partial), нет пометки «колода пройдена», учтено 15 пройденных вопросов (' + JSON.stringify({ a: g1.g.answered, s: g1.g.skipped }) + ')', !!g1 && g1.g.partial === 1 && g1.g.complete === undefined && g1.g.answered + g1.g.skipped === 15);
  T('в обезличенной записи нет имён игроков', !/Макс|Аня/.test(JSON.stringify(pa[0].body)));
  const nBefore = bReqs.filter(r => r.method === 'PATCH').length;
  // сворачивание приложения: ещё одна промежуточная запись, номер игры тот же
  Object.defineProperty(B.D, 'visibilityState', { value: 'hidden', configurable: true }); B.D.dispatchEvent(new B.w.Event('visibilitychange')); await sleep(500);
  const pa2 = bReqs.filter(r => r.method === 'PATCH' && r.kind === 'anon');
  T('при сворачивании приложения запись обновляется под тем же номером игры', bReqs.filter(r => r.method === 'PATCH').length > nBefore && game(pa2[pa2.length - 1]).gid === g1.gid);
  Object.defineProperty(B.D, 'visibilityState', { value: 'visible', configurable: true });
  // завершение игры: итоговая запись заменяет промежуточную (тот же номер, без partial)
  const mb = B.btns().find(b => /Меню/.test(b.textContent) && /btn-sm/.test(b.className)); await clickEl(mb, 400);
  await clickEl([...B.D.querySelectorAll('.viewport-popup-box .grid button')].find(b => b.textContent.trim() !== 'Отмена'), 1000);
  const pa3 = bReqs.filter(r => r.method === 'PATCH' && r.kind === 'anon'), last = game(pa3[pa3.length - 1]);
  T('итог игры записан под тем же номером и без пометки partial (она перезаписана)', B.D.title === 'Итоги игры — ASK ME' && last.gid === g1.gid && last.g.partial === undefined);
  T('ошибок выполнения нет', errors.length === 0 && B.errors.length === 0);
  console.log(res.join('\n')); console.log('--- captured runtime errors:', errors.length + B.errors.length); process.exit(0);
 } catch (err) { console.log(res.join('\n')); console.log('TEST CRASH:', err.message.split('\n')[0], '|', D.title, D.body.textContent.replace(/\s+/g, ' ').slice(0, 200)); process.exit(1); } })();
