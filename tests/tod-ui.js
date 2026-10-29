// Общий запуск приложения для UI-проверок партии «Правда или действие» (лобби, ход, итоги).
// boot({ names, seed, hash, lang }) — профиль сессии с игроками names кладётся на устройство, база (fake-rtdb) отдаёт карточки seed,
// приложение открывается на hash (по умолчанию экран режимов). Возвращает окружение харнесса и короткие помощники.
const makeEnv = require('./harness.js'); const makeDb = require('./fake-rtdb.js');

const card = (id, type, difficulty, text, isActive = true) => ({ id, type, difficulty, text, isActive });
// база по умолчанию: «Правда» лёгкая и средняя, «Действие» всех уровней; тексты уникальны, чтобы находить их на экране
const DEFAULT_DB = (() => {
  const out = {}; const add = (c) => { out[c.id] = c; };
  for (let i = 1; i <= 4; i++) add(card('td_te' + i, 'truth', 'easy', `Правда лёгкая ${i}: что ты ел на завтрак?`));
  for (let i = 1; i <= 3; i++) add(card('td_tm' + i, 'truth', 'medium', `Правда средняя ${i}: о чём ты мечтаешь?`));
  for (let i = 1; i <= 2; i++) add(card('td_th' + i, 'truth', 'hard', `Правда жёсткая ${i}: самый смелый поступок?`));
  for (let i = 1; i <= 4; i++) add(card('td_de' + i, 'dare', 'easy', `Действие лёгкое ${i}: изобрази кота`));
  for (let i = 1; i <= 3; i++) add(card('td_dm' + i, 'dare', 'medium', `Действие среднее ${i}: спой припев`));
  for (let i = 1; i <= 2; i++) add(card('td_dh' + i, 'dare', 'hard', `Действие жёсткое ${i}: станцуй без музыки`));
  return out;
})();

const profileOf = (names) => ({ sessionId: 'SID_TOD', sessionKey: 'KEY_TOD', players: names.map((n, i) => ({ id: 'p' + (i + 1), name: n, gender: i % 2 ? 'girl' : 'guy' })), archivedIds: [], disabledIds: [], savedGame: null, updatedAt: Date.now() });

// cache — список карточек в кэше устройства; todDelay — задержка ответа базы на /tod (мс): приложение сначала играет кэшем
const boot = async ({ names = ['Макс', 'Аня'], seed = DEFAULT_DB, hash = '#/mode', lang = 'ru', cache = null, todDelay = 0 } = {}) => {
  const E = makeEnv({ lang }); const db = makeDb({ ownerToken: 'owner-tok' }); db.attach(E); if (seed) db.seedTod(seed);
  if (cache) E.w.localStorage.setItem('askme_tod_cards_v1', JSON.stringify(cache));
  if (todDelay) { const base = E.w.fetch; E.w.fetch = async (url, init) => { if (/\/tod[/.]/.test(String(url))) await E.sleep(todDelay); return base(url, init); }; }
  E.w.localStorage.setItem('askme_device_profile_v4', JSON.stringify(profileOf(names)));
  E.w.history.replaceState(null, '', '/love-game/' + hash);
  E.w.eval(E.code); await E.sleep(1800);
  const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const btn = (t, { all = false } = {}) => E.btns().find(b => norm(b.textContent).includes(t) && (all || !b.disabled));
  const tap = async (el, ms = 350) => { if (!el) throw new Error('нет элемента'); el.dispatchEvent(new E.w.MouseEvent('click', { bubbles: true })); await E.sleep(ms); };
  const press = async (t, ms) => { const b = btn(t); if (!b) throw new Error('нет кнопки «' + t + '»'); await tap(b, ms); };
  const text = () => norm(E.D.body.textContent);
  const heading = () => { const h = E.D.querySelector('main h2'); return h ? norm(h.textContent) : ''; };
  const chickens = () => [...E.D.querySelectorAll('.tod-chicken')].map(x => norm(x.textContent));
  const banter = () => { const b = E.D.querySelector('.tod-banter'); return b ? norm(b.textContent) : null; };
  const cardBody = () => { const c = E.D.querySelector('.tod-flip-in p'); return c ? norm(c.textContent) : null; };
  // лобби -> игра: экран режимов -> карточка режима -> «Начать игру» (+ подтверждение 18+, если оно появится)
  const toLobby = async () => { await press('Правда или действие', 500); };
  const startGame = async () => { await press('Начать игру', 500); const ok = btn('Нам есть 18, начать'); if (ok) await tap(ok, 500); };
  const close = () => { try { E.w.close(); } catch (e) {} };
  return Object.assign(E, { db, btn, tap, press, text, heading, chickens, banter, cardBody, toLobby, startGame, close, hashNow: () => E.w.location.hash });
};

module.exports = { boot, DEFAULT_DB, card };
