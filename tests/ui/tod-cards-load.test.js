// Режим «Правда или действие»: карточки подключены в приложение — при старте идёт один запрос /tod.json (с токеном входа), список пишется в кэш устройства,
// а любой сбой (база пуста, сеть упала) проходит молча: кэш цел, ошибок на экране и в консоли нет. Сам разбор данных проверяет tests/unit/tod-cards.test.js.
const makeEnv = require('../harness.js'); const makeDb = require('../fake-rtdb.js');
const res = []; const T = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
const KEY = 'askme_tod_cards_v1'; const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const card = (o) => ({ id: 'td_a1', type: 'truth', difficulty: 'easy', text: 'Вопрос?', isActive: true, ...o });
const DB_CARDS = { td_b: card({ id: 'td_b', text: 'Вторая?' }), td_a: card({ id: 'td_a', type: 'dare', difficulty: 'medium', text: 'Первая' }), td_h: card({ id: 'td_h', text: 'Скрытая?', isActive: false }) };
const STALE = [card({ id: 'td_old', text: 'Старая?' })];
const errs = [];

// запускает приложение с базой в памяти; opts: seed — карточки в базе, cache — что лежит в кэше устройства, down — запросы к /tod.json падают
const run = async (opts) => {
  const E = makeEnv(); const db = makeDb({ ownerToken: 'owner-tok' }); db.attach(E); if (opts.seed) db.seedTod(opts.seed);
  if (opts.cache) E.w.localStorage.setItem(KEY, opts.cache);
  const seen = []; const base = E.w.fetch;
  E.w.fetch = async (url, init) => { if (/\/tod[/.]/.test(String(url))) { seen.push(String(url)); if (opts.down) throw new TypeError('network'); } return base(url, init); };
  E.w.eval(E.code); await sleep(2200);
  errs.push(...E.errors); const shown = E.D.body.textContent;
  const out = { E, db, seen, cache: E.w.localStorage.getItem(KEY), shown, errors: E.errors.length }; try { E.w.close(); } catch (e) {} return out;
};

(async () => {
  const a = await run({ seed: DB_CARDS });
  T('старт с базой: один запрос /tod.json (GET), с токеном входа в адресе', a.seen.length === 1 && /\/tod\.json\?/.test(a.seen[0]) && /auth=t(&|$)/.test(a.seen[0]) && a.db.stats.gets.tod === 1);
  T('старт с базой: в кэш устройства записаны три карточки (и скрытая) по порядку id', !!a.cache && JSON.stringify(JSON.parse(a.cache).map(c => c.id)) === JSON.stringify(['td_a', 'td_b', 'td_h']));
  T('старт с базой: приложение открылось, ошибок нет', a.errors === 0 && /ASK ME/.test(a.shown));

  const b = await run({ seed: DB_CARDS, cache: JSON.stringify(STALE) });
  T('в кэше устаревший список, база отвечает -> кэш заменён списком из базы', !!b.cache && JSON.parse(b.cache).length === 3 && !b.cache.includes('td_old'));

  const c = await run({});
  T('база пуста, кэша нет: запрос был, кэш не создан (запасной набор в кэш не пишется), ошибок нет', c.seen.length === 1 && c.cache === null && c.errors === 0 && /ASK ME/.test(c.shown));

  const stale = JSON.stringify(STALE); const d = await run({ seed: DB_CARDS, cache: stale, down: true });
  T('сеть упала, кэш есть: кэш не тронут, молча, без ошибок и без окон с ошибкой', d.seen.length === 1 && d.cache === stale && d.errors === 0 && !/не загруз|ошибк/i.test(d.shown));

  const e = await run({ down: true });
  T('сеть упала, кэша нет: кэш не создан, приложение работает, ошибок нет', e.cache === null && e.errors === 0 && /ASK ME/.test(e.shown));

  console.log(res.join('\n')); console.log('--- captured runtime errors:', errs.length); errs.slice(0, 6).forEach(x => console.log(' ', x));
  process.exit(res.some(l => l.startsWith('FAIL')) ? 1 : 0);
})().catch(err => { console.log(res.join('\n')); console.log('TEST CRASH:', err && err.message); process.exit(1); });
