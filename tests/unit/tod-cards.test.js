// Режим «Правда или действие»: загрузка карточек, кэш, запись и разовая загрузка стартового набора (src/tod/cards.js).
// Основные проверки идут с фейковым env (fetch-заглушка и хранилище-объект), как в app.jsx: env = { baseUrl, fetch(url, opts, ms), storage, starter }.
// Последний блок прогоняет запись и загрузку через базу в памяти (tests/fake-rtdb.js) с правилами узла tod: владельцу запись разрешена, обычному токену — 401.
const fs = require('fs'); const path = require('path');
const { loadTod } = require('../tod-load.js'); const { makeRules } = require('../rules-eval.js'); const makeDb = require('../fake-rtdb.js');
const res = []; const T = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
const finish = () => { console.log(res.join('\n')); console.log('--- captured runtime errors: 0'); process.exit(res.some(l => l.startsWith('FAIL')) ? 1 : 0); };
const NAMES = ['TOD_STARTER', 'TOD_CACHE_KEY', 'todCleanCard', 'todCleanList', 'todReadCache', 'todWriteCache', 'todLoadCards', 'todSaveCard', 'todSeedStarter', 'todActive', 'todFillUk'];
let M = null;
try { M = loadTod(['content/tod-cards.js', 'tod/model.js', 'tod/cards.js'], NAMES); } catch (e) { T('модуль src/tod/cards.js загружается: ' + (e && e.message), false); finish(); }
const { TOD_STARTER, TOD_CACHE_KEY, todCleanCard, todCleanList, todReadCache, todWriteCache, todLoadCards, todSaveCard, todSeedStarter, todActive, todFillUk } = M;

const rules = makeRules(JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/tod-rules.json'), 'utf8')));
const passesRules = (c) => rules.check('PUT', ['tod', c.id], { uid: 'OWNER_UID' }, c) === null;
const BASE = 'https://db.example.test';
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const card = (o) => ({ id: 'td_a1', type: 'truth', difficulty: 'easy', text: 'Вопрос?', isActive: true, ...o });

// хранилище-объект с интерфейсом localStorage; broken — все операции бросают (приватный режим, переполнение)
const mkStorage = (init, broken) => {
  const m = new Map(Object.entries(init || {}));
  return { getItem: (k) => { if (broken) throw new Error('storage'); return m.has(k) ? m.get(k) : null; }, setItem: (k, v) => { if (broken) throw new Error('storage'); m.set(k, String(v)); }, has: (k) => m.has(k), raw: (k) => m.get(k) };
};
// env с заглушкой fetch: handler(url, opts, ms) возвращает ответ или бросает; все вызовы пишутся в calls
const mkEnv = (handler, storage) => {
  const calls = []; let active = 0, maxActive = 0;
  const env = { baseUrl: BASE, storage: storage || mkStorage(), starter: TOD_STARTER, calls,
    fetch: async (url, opts, ms) => { calls.push({ url, opts: opts || {}, ms }); active++; maxActive = Math.max(maxActive, active); try { await Promise.resolve(); return await handler(url, opts || {}, ms, calls.length); } finally { active--; } } };
  Object.defineProperty(env, 'maxActive', { get: () => maxActive });
  return env;
};
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const asMap = (list) => { const o = {}; list.forEach(c => { o[c.id] = c; }); return o; };
const CACHED = [card({ id: 'td_c1', text: 'Из кэша?' }), card({ id: 'td_c2', type: 'dare', difficulty: 'medium', text: 'Кэш-действие' })];
const rejects = async (p) => { try { await p; return null; } catch (e) { return e; } };

(async () => {
  // --- константы и стартовый набор ---
  T('TOD_CACHE_KEY = askme_tod_cards_v1', TOD_CACHE_KEY === 'askme_tod_cards_v1');
  T('стартовый набор: 120 карточек', Array.isArray(TOD_STARTER) && TOD_STARTER.length === 120);

  // --- украинский текст стартового набора для карточек базы без text_uk ---
  {
    const s1 = TOD_STARTER[0]; const s2 = TOD_STARTER[1];
    const old = { ...s1 }; delete old.text_uk; // так набор лежал в базе до появления перевода
    const edited = { ...s2, text: 'Переписанный владельцем вопрос?' }; delete edited.text_uk;
    const own = card({ id: 'td_own', text: 'Своя?' });
    const db = asMap([old, edited, own]);
    const r = await todLoadCards(mkEnv(async () => reply(200, db)));
    const byId = (id) => r.list.find(c => c.id === id);
    T('uk-подстановка: карточке набора без text_uk достаётся перевод из набора', byId(s1.id).text_uk === s1.text_uk && byId(s1.id).text === s1.text);
    T('uk-подстановка: переписанная владельцем карточка остаётся без перевода', !byId(s2.id).text_uk);
    T('uk-подстановка: своя карточка не трогается', same(byId('td_own'), own));
    const st = mkStorage({ [TOD_CACHE_KEY]: JSON.stringify([old]) });
    const rc = await todLoadCards(mkEnv(async () => { throw new Error('offline'); }, st));
    T('uk-подстановка: и для списка из кэша', rc.source === 'cache' && rc.list[0].text_uk === s1.text_uk);
    T('uk-подстановка: готовый text_uk не перезаписывается', todFillUk([{ ...s1, text_uk: 'Свій переклад?' }], TOD_STARTER)[0].text_uk === 'Свій переклад?');
    T('uk-подстановка: мусор на входе — пустой список', same(todFillUk(null, TOD_STARTER), []));
  }

  // --- загрузка из базы ---
  {
    const good = [card({ id: 'td_b', text: 'Вторая?' }), card({ id: 'td_a', type: 'dare', difficulty: 'hard', text: 'Первая', isActive: false, updatedAt: 1700000000000 }), card({ id: 'td_c', text: 'Третья?', difficulty: 'medium' })];
    const db = { ...asMap(good), junk1: null, junk2: 'строка', junk3: 5, junk4: { id: 'td_x', type: 'question', difficulty: 'easy', text: 'Не тот тип?', isActive: true },
      junk5: { id: 'td_y', type: 'truth', difficulty: 'easy', text: '   ', isActive: true }, junk6: { id: 'td_z', type: 'truth', difficulty: 'easy', text: 'Нет isActive?' },
      td_ex: { ...card({ id: 'td_ex', text: 'С лишним полем?' }), extra: 'x', n: 7 } };
    const st = mkStorage(); const env = mkEnv(async () => reply(200, db), st);
    const r = await todLoadCards(env);
    T('из базы: мусор отброшен, остались 4 корректные карточки по порядку id', same(r.list.map(c => c.id), ['td_a', 'td_b', 'td_c', 'td_ex']));
    T('из базы: source = db', r.source === 'db');
    T('из базы: лишние поля карточки отброшены, updatedAt и isActive:false сохранены', same(r.list[0], good[1]) && same(r.list[3], card({ id: 'td_ex', text: 'С лишним полем?' })));
    T('из базы: кэш записан под ключом askme_tod_cards_v1 и совпадает со списком', st.has(TOD_CACHE_KEY) && same(JSON.parse(st.raw(TOD_CACHE_KEY)), r.list));
    T('из базы: один запрос GET на ' + BASE + '/tod.json', env.calls.length === 1 && env.calls[0].url.startsWith(BASE + '/tod.json') && !/^\/tod\//.test(env.calls[0].url.slice(BASE.length)) && (!env.calls[0].opts.method || env.calls[0].opts.method === 'GET'));
    T('из базы: адрес без лишнего пути (после .json только ?t=…)', /^https:\/\/db\.example\.test\/tod\.json(\?t=\d+)?$/.test(env.calls[0].url));
    T('из базы: скрытые карточки (isActive:false) в списке остаются (они нужны админке)', r.list.some(c => c.isActive === false));
    T('из базы: массив тоже понимается (ключи 0, 1, …)', same((await todLoadCards(mkEnv(async () => reply(200, good)))).list.map(c => c.id), ['td_a', 'td_b', 'td_c']));
  }

  // --- база пуста ---
  {
    const st = mkStorage({ [TOD_CACHE_KEY]: JSON.stringify(CACHED) }); const env = mkEnv(async () => reply(200, null), st);
    const r = await todLoadCards(env);
    T('база пуста (null) и кэш есть -> source cache, список из кэша', r.source === 'cache' && same(r.list, CACHED));
    T('база пуста и кэш есть -> кэш не перезаписан', st.raw(TOD_CACHE_KEY) === JSON.stringify(CACHED));
  }
  {
    const st = mkStorage(); const env = mkEnv(async () => reply(200, null), st);
    const r = await todLoadCards(env);
    T('база пуста и кэша нет -> source starter (120 карточек)', r.source === 'starter' && r.list.length === 120);
    T('стартовый набор в ответе — чистые копии (тот же состав и порядок, сам TOD_STARTER не тронут)', same(r.list, todCleanList(TOD_STARTER)) && r.list[0] !== TOD_STARTER[0] && TOD_STARTER.length === 120 && TOD_STARTER.every(c => !('updatedAt' in c)));
    T('стартовый набор в кэш не пишется (иначе «запасной» набор стал бы «кэшем»)', !st.has(TOD_CACHE_KEY));
  }
  {
    const r1 = await todLoadCards(mkEnv(async () => reply(200, {})));
    const r2 = await todLoadCards(mkEnv(async () => reply(200, { a: null, b: 3, c: { id: 'td_q', type: 'x' } })));
    T('база вернула {} или одни неподходящие записи -> запасной набор, как при пустой базе', r1.source === 'starter' && r2.source === 'starter' && r1.list.length === 120 && r2.list.length === 120);
    const st = mkStorage({ [TOD_CACHE_KEY]: JSON.stringify(CACHED) }); const r3 = await todLoadCards(mkEnv(async () => reply(200, { a: 5 }), st));
    T('база вернула одни неподходящие записи, кэш есть -> source cache, кэш цел', r3.source === 'cache' && same(r3.list, CACHED) && st.raw(TOD_CACHE_KEY) === JSON.stringify(CACHED));
  }

  // --- fetch бросает / !ok / битый ответ -> тот же откат, без исключения ---
  {
    const failing = { 'fetch бросает': async () => { throw new TypeError('network'); }, 'ответ !ok (503)': async () => reply(503, null), 'ответ !ok (401)': async () => reply(401, { error: 'Permission denied' }), 'json() бросает': async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad json'); } }), 'ответ undefined': async () => undefined };
    for (const [name, h] of Object.entries(failing)) {
      let thrown = null, rc = null, rs = null;
      try { rc = await todLoadCards(mkEnv(h, mkStorage({ [TOD_CACHE_KEY]: JSON.stringify(CACHED) }))); rs = await todLoadCards(mkEnv(h, mkStorage())); } catch (e) { thrown = e; }
      T(name + ': без исключения; кэш есть -> cache, кэша нет -> starter (120)', !thrown && rc && rc.source === 'cache' && same(rc.list, CACHED) && rs && rs.source === 'starter' && rs.list.length === 120);
    }
    const rBad = await todLoadCards(mkEnv(async () => { throw new Error('x'); }, mkStorage({ [TOD_CACHE_KEY]: '{не json' })));
    T('битый кэш и база недоступна -> starter', rBad.source === 'starter' && rBad.list.length === 120);
    const rBroken = await todLoadCards(mkEnv(async () => reply(200, asMap(CACHED)), mkStorage({}, true)));
    T('хранилище бросает (приватный режим): из базы список всё равно получен, без исключения', rBroken.source === 'db' && rBroken.list.length === 2);
    const rNoStore = await todLoadCards({ baseUrl: BASE, fetch: async () => reply(200, null), storage: null, starter: TOD_STARTER });
    T('нет хранилища (null) и база пуста -> starter', rNoStore.source === 'starter' && rNoStore.list.length === 120);
    const rNoEnv = await todLoadCards({ baseUrl: BASE, storage: mkStorage(), starter: TOD_STARTER });
    T('нет fetch в env -> молчаливый откат на starter', rNoEnv.source === 'starter');
    const rNoStarter = await todLoadCards({ baseUrl: BASE, fetch: async () => reply(200, null), storage: mkStorage() });
    T('нет starter в env и база пуста -> source starter, пустой список (без исключения)', rNoStarter.source === 'starter' && same(rNoStarter.list, []));
  }

  // --- кэш: чтение и запись ---
  {
    const st = mkStorage();
    T('todReadCache: пустое хранилище -> []', same(todReadCache(st), []));
    todWriteCache(st, CACHED);
    T('todWriteCache -> todReadCache возвращает то же', same(todReadCache(st), CACHED) && st.has(TOD_CACHE_KEY));
    T('todReadCache: битый JSON -> []', same(todReadCache(mkStorage({ [TOD_CACHE_KEY]: '{[' })), []));
    T('todReadCache: не тот тип (число, строка, null) -> []', same(todReadCache(mkStorage({ [TOD_CACHE_KEY]: '5' })), []) && same(todReadCache(mkStorage({ [TOD_CACHE_KEY]: '"abc"' })), []) && same(todReadCache(mkStorage({ [TOD_CACHE_KEY]: 'null' })), []));
    T('todReadCache: мусор внутри массива отброшен, порядок по id', same(todReadCache(mkStorage({ [TOD_CACHE_KEY]: JSON.stringify([5, null, card({ id: 'td_z' }), { id: 'td_q' }, card({ id: 'td_k' })]) })).map(c => c.id), ['td_k', 'td_z']));
    T('todReadCache: хранилище бросает или null -> []', same(todReadCache(mkStorage({}, true)), []) && same(todReadCache(null), []) && same(todReadCache(undefined), []));
    let threw = false; try { todWriteCache(mkStorage({}, true), CACHED); todWriteCache(null, CACHED); todWriteCache(st, undefined); } catch (e) { threw = true; }
    T('todWriteCache: хранилище бросает, нет хранилища или нет списка -> без исключения', !threw);
    const st2 = mkStorage(); todWriteCache(st2, [card({ id: 'td_b' }), { id: 'bad' }, card({ id: 'td_a' })]);
    T('todWriteCache: в кэш попадают только чистые карточки', same(JSON.parse(st2.raw(TOD_CACHE_KEY)).map(c => c.id), ['td_a', 'td_b']));
  }

  // --- запись одной карточки ---
  {
    const env = mkEnv(async () => reply(200, null)); const t0 = Date.now();
    const out = await todSaveCard(env, { id: 'td_new1', type: 'dare', difficulty: 'hard', text: '  Сделайте <b>комплимент</b>  ', isActive: true, extra: 'x', updatedAt: 5 });
    const c = env.calls[0]; const body = JSON.parse(c.opts.body);
    T('save: ровно один запрос PUT на /tod/td_new1.json', env.calls.length === 1 && c.opts.method === 'PUT' && c.url.startsWith(BASE + '/tod/td_new1.json') && /^https:\/\/db\.example\.test\/tod\/td_new1\.json$/.test(c.url));
    T('save: заголовок Content-Type: application/json', c.opts.headers && c.opts.headers['Content-Type'] === 'application/json');
    T('save: тело очищено (угловые скобки и лишнее поле убраны, пробелы обрезаны)', body.text === 'Сделайте bкомплимент/b' && !('extra' in body) && same(Object.keys(body).sort(), ['difficulty', 'id', 'isActive', 'text', 'type', 'updatedAt']));
    T('save: updatedAt — число «сейчас» (а не из карточки)', typeof body.updatedAt === 'number' && body.updatedAt >= t0 && body.updatedAt <= Date.now());
    T('save: возвращает записанную карточку', same(out, body) && out !== null);
    T('save: тело проходит правила узла tod', passesRules(body));
    const e2 = await rejects(todSaveCard(mkEnv(async () => reply(401, { error: 'Permission denied' })), card()));
    T('save: !ok (401) -> Error("HTTP 401")', e2 instanceof Error && e2.message === 'HTTP 401');
    const e3 = await rejects(todSaveCard(mkEnv(async () => reply(503, null)), card()));
    T('save: !ok (503) -> Error("HTTP 503")', e3 instanceof Error && e3.message === 'HTTP 503');
    const e4 = await rejects(todSaveCard(mkEnv(async () => { throw new TypeError('network'); }), card()));
    T('save: сеть упала -> ошибка пробрасывается (форма покажет сообщение)', e4 instanceof Error && e4.message === 'network');
    const bad = mkEnv(async () => reply(200, null)); const e5 = await rejects(todSaveCard(bad, card({ type: 'question' })));
    T('save: неверная карточка -> ошибка, в базу ничего не уходит', e5 instanceof Error && bad.calls.length === 0);
    const e6 = await rejects(todSaveCard(bad, card({ text: '<>' }))); const e7 = await rejects(todSaveCard(bad, null));
    T('save: пустой после очистки текст и null -> ошибка, запросов нет', e6 instanceof Error && e7 instanceof Error && bad.calls.length === 0);
    const a = JSON.parse((await (async () => { const e = mkEnv(async () => reply(200, null)); await todSaveCard(e, card({ isActive: false })); return e.calls[0].opts; })()).body);
    T('save: скрытая карточка (isActive:false) пишется как есть', a.isActive === false);
    const orig = card({ updatedAt: 1 }); const snap = JSON.stringify(orig); await todSaveCard(mkEnv(async () => reply(200, null)), orig);
    T('save: исходный объект карточки не меняется', JSON.stringify(orig) === snap);
  }

  // --- разовая загрузка стартового набора ---
  {
    const existing = TOD_STARTER.slice(0, 7).map(c => c.id).concat(['td_own1']);
    const env = mkEnv(async () => reply(200, null)); const r = await todSeedStarter(env, existing);
    const puts = env.calls.filter(c => c.opts.method === 'PUT'); const putIds = puts.map(c => decodeURIComponent(c.url.slice((BASE + '/tod/').length).replace(/\.json.*$/, '')));
    T('seed: added = 120 - существующие из набора, skipped = существующие из набора (чужой td_own1 в счёт не идёт)', r.added === 113 && r.skipped === 7 && r.added === 120 - 7);
    T('seed: существующие id пропущены, остальные записаны (PUT по одной), порядок как в наборе', puts.length === 113 && env.calls.length === 113 && same(putIds, TOD_STARTER.slice(7).map(c => c.id)));
    T('seed: записи идут строго по одной (одновременно не больше одного запроса)', env.maxActive === 1);
    T('seed: каждое тело проходит правила узла tod и содержит updatedAt-число', puts.every(c => { const b = JSON.parse(c.opts.body); return passesRules(b) && typeof b.updatedAt === 'number' && b.isActive === true; }));
    T('seed: тексты записаны как в стартовом наборе', puts.every((c, i) => JSON.parse(c.opts.body).text === todCleanCard(TOD_STARTER[7 + i]).text));
    const none = mkEnv(async () => reply(200, null)); const r0 = await todSeedStarter(none, TOD_STARTER.map(c => c.id));
    T('seed: всё уже есть -> { added: 0, skipped: 120 }, запросов нет', r0.added === 0 && r0.skipped === 120 && none.calls.length === 0);
    const all = mkEnv(async () => reply(200, null)); const rAll = await todSeedStarter(all, []);
    T('seed: существующих нет -> added 120, skipped 0', rAll.added === 120 && rAll.skipped === 0 && all.calls.length === 120);
    const odd = mkEnv(async () => reply(200, null)); const rOdd = await todSeedStarter(odd, undefined);
    T('seed: existingIds не массив -> считается пустым (added 120)', rOdd.added === 120 && rOdd.skipped === 0);
  }
  {
    const env = mkEnv(async (url, o, ms, n) => (n === 3 ? reply(500, null) : reply(200, null)));
    const err = await rejects(todSeedStarter(env, []));
    T('seed: сбой на третьей записи -> ошибка с added === 2', err instanceof Error && err.added === 2);
    T('seed: после сбоя запись останавливается (3 запроса, не 120)', env.calls.length === 3);
    T('seed: сообщение ошибки сохраняет причину (HTTP 500)', err && err.message === 'HTTP 500');
    const env2 = mkEnv(async (url, o, ms, n) => { if (n === 1) throw new TypeError('network'); return reply(200, null); });
    const err2 = await rejects(todSeedStarter(env2, []));
    T('seed: сеть упала на первой записи -> ошибка с added === 0', err2 instanceof Error && err2.added === 0 && env2.calls.length === 1);
    const env3 = mkEnv(async () => reply(401, { error: 'Permission denied' })); const err3 = await rejects(todSeedStarter(env3, TOD_STARTER.slice(0, 5).map(c => c.id)));
    T('seed: отказ правил (401) -> ошибка HTTP 401, added 0', err3 instanceof Error && err3.message === 'HTTP 401' && err3.added === 0);
  }

  // --- todActive ---
  {
    const list = [card({ id: 'td_1' }), card({ id: 'td_2', isActive: false }), card({ id: 'td_3', type: 'dare' }), null, { id: 'td_4' }, card({ id: 'td_5', isActive: 'true' })];
    T('todActive отбрасывает isActive:false (и всё, где isActive не true)', same(todActive(list).map(c => c.id), ['td_1', 'td_3']));
    T('todActive: не массив -> [], исходный список не меняется', same(todActive(null), []) && same(todActive(undefined), []) && same(todActive({}), []) && list.length === 6);
  }

  // --- через базу в памяти с правилами tod ---
  {
    const mkFake = (token, ownerToken) => { const fake = makeDb({ ownerToken }); const env = { baseUrl: BASE, storage: mkStorage(), starter: TOD_STARTER, fetch: (url, opts) => fake.handle(url + (url.includes('?') ? '&' : '?') + 'auth=' + token, opts) }; return { fake, env }; };
    const own = mkFake('owner-tok', 'owner-tok');
    const rSeed = await todSeedStarter(own.env, []);
    T('база в памяти, владелец: seed записал 120 карточек, отказов правил нет', rSeed.added === 120 && Object.keys(own.fake.tod()).length === 120 && own.fake.stats.denied === 0);
    const rLoad = await todLoadCards(own.env);
    T('база в памяти: загрузка после seed -> source db, 120 карточек, кэш записан', rLoad.source === 'db' && rLoad.list.length === 120 && todReadCache(own.env.storage).length === 120);
    const saved = await todSaveCard(own.env, card({ id: 'td_mine', type: 'dare', difficulty: 'easy', text: 'Своя карточка' }));
    T('база в памяти, владелец: своя карточка записана с updatedAt', own.fake.tod().td_mine && same(own.fake.tod().td_mine, saved) && typeof saved.updatedAt === 'number');
    const rSeed2 = await todSeedStarter(own.env, (await todLoadCards(own.env)).list.map(c => c.id));
    T('база в памяти: повторный seed с актуальными id -> added 0, skipped 120', rSeed2.added === 0 && rSeed2.skipped === 120);
    const anon = mkFake('anon-tok', 'owner-tok');
    const eAnon = await rejects(todSeedStarter(anon.env, []));
    T('база в памяти, обычный токен: seed отклонён правилами (HTTP 401, added 0), в базе пусто', eAnon instanceof Error && eAnon.message === 'HTTP 401' && eAnon.added === 0 && Object.keys(anon.fake.tod()).length === 0 && anon.fake.stats.denied === 1);
    const eAnon2 = await rejects(todSaveCard(anon.env, card()));
    T('база в памяти, обычный токен: save -> HTTP 401', eAnon2 instanceof Error && eAnon2.message === 'HTTP 401');
    const rAnon = await todLoadCards(anon.env);
    T('база в памяти, база пуста: загрузка читает без входа владельца и откатывается на starter', rAnon.source === 'starter' && rAnon.list.length === 120);
  }

  // --- app.jsx: импорты модулей режима. В тестах модули подставляются в код app.jsx целиком (tests/harness.js), поэтому забытый или лишний импорт
  //     тесты не заметят, а в настоящей сборке получится ReferenceError в браузере; эта проверка закрывает такую дыру для всех задач режима ---
  {
    const SRC = path.join(__dirname, '../../src'); const app = fs.readFileSync(path.join(SRC, 'app.jsx'), 'utf8'); const body = app.replace(/^import .*$/gm, '');
    const imported = new Set(); for (const m of app.matchAll(/^import \{([^}]*)\} from '[^']+';[ \t]*$/gm)) m[1].split(',').forEach(n => imported.add(n.trim()));
    const files = fs.readdirSync(path.join(SRC, 'tod')).filter(f => /\.jsx?$/.test(f)).map(f => 'tod/' + f).concat(fs.readdirSync(path.join(SRC, 'content')).filter(f => /^tod-.*\.js$/.test(f)).map(f => 'content/' + f));
    const exported = []; files.forEach(f => { for (const m of fs.readFileSync(path.join(SRC, f), 'utf8').matchAll(/^export (?:const|let|function|class) (\w+)/gm)) exported.push(m[1]); });
    const usedNotImported = exported.filter(n => new RegExp('(?<![\\w$])' + n + '(?![\\w$])').test(body) && !imported.has(n));
    const importedUnknown = [...imported].filter(n => /^(tod|Tod|TOD_)/.test(n) && !exported.includes(n));
    T('app.jsx: каждое имя из модулей режима, которое он использует, есть в его импортах' + (usedNotImported.length ? ' — не хватает: ' + usedNotImported.join(', ') : ''), usedNotImported.length === 0);
    T('app.jsx: все импортированные имена tod/Tod/TOD_ существуют в модулях' + (importedUnknown.length ? ' — нет в модулях: ' + importedUnknown.join(', ') : ''), importedUnknown.length === 0);
    T('app.jsx: из cards.js импортированы все шесть имён для следующих задач (todLoadCards, todSaveCard, todSeedStarter, todActive, todReadCache, todWriteCache)', ['todLoadCards', 'todSaveCard', 'todSeedStarter', 'todActive', 'todReadCache', 'todWriteCache'].every(n => imported.has(n)));
  }

  finish();
})().catch(e => { res.push('FAIL тест упал: ' + (e && e.stack || e)); finish(); });
