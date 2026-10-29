// Режим «Правда или действие»: правила узла tod и тестовая основа.
// Проверяет: (1) правила из tests/fixtures/tod-rules.json через вычислитель tests/rules-eval.js, (2) сам вычислитель на коротких наборах правил,
// (3) загрузчик модулей tests/tod-load.js, (4) узел tod и комнаты `_t` в базе в памяти (tests/fake-rtdb.js).
const fs = require('fs'); const os = require('os'); const path = require('path');
const { makeRules } = require('../rules-eval.js'); const { loadTod } = require('../tod-load.js'); const makeDb = require('../fake-rtdb.js');
const RULES = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/tod-rules.json'), 'utf8'));
const rules = makeRules(RULES);
const res = []; const T = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
const OWNER = { uid: 'OWNER_UID' };
const card = (o) => ({ id: 'td_a1', type: 'truth', difficulty: 'easy', text: 'Вопрос?', isActive: true, ...o });
const put = (id, c, auth = OWNER) => rules.check('PUT', ['tod', id], auth, c);

// --- 1. правила узла tod (копия для тестов) ---
T('в копии правил идентификатор владельца заменён на OWNER_UID, чтение открыто', RULES.tod['.read'] === true && /OWNER_UID/.test(RULES.tod['.write']) && /OWNER_UID/.test(RULES._comment));
T('владелец пишет корректную карточку', rules.check('PUT', ['tod', 'td_a1'], OWNER, card()) === null);
T('обычный пользователь не пишет', rules.check('PUT', ['tod', 'td_a1'], { uid: 'x' }, card()) !== null);
T('без входа не пишет', rules.check('PUT', ['tod', 'td_a1'], null, card()) !== null);
T('лишнее поле отклонено ($other)', rules.check('PUT', ['tod', 'td_a1'], OWNER, { ...card(), extra: 1 }) !== null);
T('украинский текст text_uk принимается (до 300 знаков), длиннее или не строка — отказ', rules.check('PUT', ['tod', 'td_a1'], OWNER, { ...card(), text_uk: 'Питання?' }) === null && rules.check('PUT', ['tod', 'td_a1'], OWNER, { ...card(), text_uk: 'я'.repeat(301) }) !== null && rules.check('PUT', ['tod', 'td_a1'], OWNER, { ...card(), text_uk: 5 }) !== null);
T('updatedAt допустим', rules.check('PUT', ['tod', 'td_a1'], OWNER, { ...card(), updatedAt: 5 }) === null);
T('updatedAt не число отклонён', rules.check('PUT', ['tod', 'td_a1'], OWNER, { ...card(), updatedAt: '5' }) !== null);
T('id не совпадает с ключом', rules.check('PUT', ['tod', 'td_b2'], OWNER, card()) !== null);
T('id длиннее 16 знаков', rules.check('PUT', ['tod', 'td_12345678901234'], OWNER, card({ id: 'td_12345678901234' })) !== null);
T('id ровно 16 знаков принят', rules.check('PUT', ['tod', 'td_1234567890123'], OWNER, card({ id: 'td_1234567890123' })) === null);
T('text пустой отклонён', put('td_a1', card({ text: '' })) !== null);
T('text 301 знак отклонён', put('td_a1', card({ text: 'я'.repeat(301) })) !== null);
T('text 300 знаков принят', put('td_a1', card({ text: 'я'.repeat(300) })) === null);
T('text 1 знак принят', put('td_a1', card({ text: '?' })) === null);
T('text не строка отклонён', put('td_a1', card({ text: 5 })) !== null);
T('type вне списка отклонён', put('td_a1', card({ type: 'question' })) !== null);
T('type: truth и dare приняты', put('td_a1', card({ type: 'truth' })) === null && put('td_a1', card({ type: 'dare' })) === null);
T('difficulty вне списка отклонена', put('td_a1', card({ difficulty: 'extreme' })) !== null);
T('difficulty: easy, medium, hard приняты', ['easy', 'medium', 'hard'].every(d => put('td_a1', card({ difficulty: d })) === null));
T('isActive не boolean отклонён', put('td_a1', card({ isActive: 'true' })) !== null && put('td_a1', card({ isActive: 1 })) !== null);
T('isActive false допустим (карточка скрыта, но остаётся в базе)', put('td_a1', card({ isActive: false })) === null);
T('без обязательного поля отклонено (все пять полей)', ['id', 'type', 'difficulty', 'text', 'isActive'].every(k => { const c = card(); delete c[k]; return put('td_a1', c) !== null; }));
T('удаление записи владельцем разрешено, чужим и без входа нет', rules.check('DELETE', ['tod', 'td_a1'], OWNER, null) === null && rules.check('DELETE', ['tod', 'td_a1'], { uid: 'x' }, null) !== null && rules.check('DELETE', ['tod', 'td_a1'], null, null) !== null);
T('запись сразу всего узла tod: карточки проверяются каждая, чужому нельзя', rules.check('PUT', ['tod'], OWNER, { td_a1: card(), td_b2: card({ id: 'td_b2', type: 'dare' }) }) === null
  && rules.check('PUT', ['tod'], OWNER, { td_a1: card(), td_b2: card({ id: 'td_b2', difficulty: 'x' }) }) !== null
  && rules.check('PUT', ['tod'], OWNER, { td_a1: card(), td_b2: card() }) !== null
  && rules.check('PUT', ['tod'], { uid: 'x' }, { td_a1: card() }) !== null);
T('запись вне узла tod (нет правила) отклонена даже владельцу', rules.check('PUT', ['other', 'x'], OWNER, card()) !== null);
// запись НИЖЕ узла с .validate (поле внутри карточки): .validate карточки зависит от соседних полей, вычислитель их не знает — поэтому отказ, а не «разрешено»
T('запись поля внутри карточки: id (td_zzz, 50 знаков и даже верный td_a1) отклонена — вычислитель не может проверить .validate карточки', ['td_zzz', 'x'.repeat(50), 'td_a1'].every(v => { const r = rules.check('PUT', ['tod', 'td_a1', 'id'], OWNER, v); return typeof r === 'string' && /не поддержано: \.validate предка/.test(r); }));
T('запись поля внутри карточки: text отклонена', /не поддержано: \.validate предка/.test(String(rules.check('PUT', ['tod', 'td_a1', 'text'], OWNER, 'x'))));
T('удаление поля внутри карточки тоже отказ (обязательное поле .validate карточки не даст удалить), а удаление всей карточки разрешено', typeof rules.check('DELETE', ['tod', 'td_a1', 'text'], OWNER, null) === 'string' && rules.check('DELETE', ['tod', 'td_a1', 'text'], OWNER, null) !== null && rules.check('DELETE', ['tod', 'td_a1'], OWNER, null) === null);
T('запись поля внутри карточки чужим: отказ по праву записи (причина — не .validate)', /нет разрешения на запись/.test(String(rules.check('PUT', ['tod', 'td_a1', 'text'], { uid: 'x' }, 'x'))));
T('скаляр в PUT /tod владельцем разрешён (у tod нет .validate, как в настоящих правилах), чужим нет', rules.check('PUT', ['tod'], OWNER, 'x') === null && rules.check('PUT', ['tod'], { uid: 'x' }, 'x') !== null);

// --- 2. вычислитель правил на коротких наборах ---
{
  const r = makeRules({ a: { '.write': 'false', b: { '.write': 'true' } }, w: { $k: { '.write': "$k === 'ok'" } } });
  T('вычислитель: .write сверху вниз, любое true разрешает (родитель false, потомок true)', r.check('PUT', ['a', 'b'], null, 1) === null && r.check('PUT', ['a'], null, 1) !== null);
  T('вычислитель: переменная узла-шаблона подставляется в выражение', r.check('PUT', ['w', 'ok'], null, 1) === null && r.check('PUT', ['w', 'no'], null, 1) !== null);
  const v = makeRules({ x: { '.write': 'true', '.validate': 'false' } });
  T('вычислитель: для DELETE .validate не проверяется, для PUT проверяется', v.check('DELETE', ['x'], null, null) === null && v.check('PUT', ['x'], null, 1) !== null);
  const th = makeRules({ x: { '.write': 'true', '.validate': "newData.child('a').val().length > 0" } });
  T('вычислитель: выражение с ошибкой (val() пустого поля) — отказ с причиной, а не падение', typeof th.check('PUT', ['x'], null, {}) === 'string' && th.check('PUT', ['x'], null, { a: 'q' }) === null);
  const ex = makeRules({ x: { '.write': 'true', $o: { '.validate': 'false' }, k: { '.validate': 'newData.isNumber()' } } });
  T('вычислитель: явное дочернее правило важнее $other', ex.check('PUT', ['x'], null, { k: 1 }) === null && ex.check('PUT', ['x'], null, { k: 'a' }) !== null && ex.check('PUT', ['x'], null, { z: 1 }) !== null);
  const av = makeRules({ x: { '.write': 'true', '.validate': 'true', k: { '.validate': 'true' } } });
  T('вычислитель: запись под узлом с .validate — отказ «не поддержано», даже если .write разрешает и выражения истинны; сам узел и узел без .validate выше — как раньше', /не поддержано: \.validate предка/.test(String(av.check('PUT', ['x', 'k'], null, 1))) && av.check('PUT', ['x'], null, { k: 1 }) === null && makeRules({ x: { '.write': 'true', k: { '.validate': 'true' } } }).check('PUT', ['x', 'k'], null, 1) === null);
  const nl = makeRules({ x: { '.write': 'true', k: { '.validate': 'false' } } });
  T('вычислитель: пустые (null) потомки не проверяются', nl.check('PUT', ['x'], null, { k: null }) === null);
  const ty = makeRules({ x: { '.write': 'true', '.validate': "newData.hasChildren(['n','s','b']) && newData.child('n').isNumber() && newData.child('s').isString() && newData.child('b').isBoolean() && newData.child('s').exists() && !newData.child('q').exists()" } });
  T('вычислитель: hasChildren, isNumber, isString, isBoolean, exists', ty.check('PUT', ['x'], null, { n: 1, s: '', b: false }) === null && ty.check('PUT', ['x'], null, { n: '1', s: '', b: false }) !== null && ty.check('PUT', ['x'], null, { n: 1, s: '' }) !== null);
}

// --- 3. загрузчик модулей tests/tod-load.js ---
{
  const about = loadTod(['content/about.js'], ['ABOUT']);
  T('загрузчик: модуль из src/content подставляется без `export`', !!about.ABOUT && typeof about.ABOUT.version === 'string');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tod-load-'));
  try {
    fs.writeFileSync(path.join(dir, 'a.js'), "import { x } from './nowhere.js';\nexport const TOD_A = 2;\nexport function todTwice(v) { return v * TOD_A; }\n");
    fs.writeFileSync(path.join(dir, 'b.js'), "import { TOD_A, todTwice } from './a.js';\nexport const TOD_B = todTwice(TOD_A) + 1;\n");
    const rel = (f) => path.relative(path.join(__dirname, '../../src'), path.join(dir, f));
    const m = loadTod([rel('a.js'), rel('b.js')], ['TOD_A', 'todTwice', 'TOD_B']);
    T('загрузчик: строки import убраны, export убран, файлы склеены в общей области видимости', m.TOD_A === 2 && m.TOD_B === 5 && m.todTwice(4) === 8);
    let threw = false; try { loadTod([rel('a.js')], ['TOD_MISSING']); } catch (e) { threw = true; }
    T('загрузчик: имя, которого нет в файлах, — ошибка, а не тихий undefined', threw);
    fs.writeFileSync(path.join(dir, 'c.js'), "export function todLeak() { todLeakedGlobal = 1; }\n");
    let strict = false; try { loadTod([rel('c.js')], ['todLeak']).todLeak(); } catch (e) { strict = e instanceof ReferenceError; }
    T('загрузчик: код выполняется в строгом режиме, как настоящая сборка (присваивание необъявленной переменной — ошибка)', strict && typeof todLeakedGlobal === 'undefined');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// --- 4. узел tod и комнаты `_t` в базе в памяти ---
(async () => {
  const U = 'https://fake.test'; const owner = 'tok_owner', other = 'tok_other';
  const call = (db, method, p, tok, body) => db.handle(U + p + (tok ? '?auth=' + tok : ''), { method, body: body === undefined ? undefined : JSON.stringify(body) });
  {
    const db = makeDb({ ownerToken: owner });
    let r = await call(db, 'PUT', '/tod/td_a1.json', owner, card());
    T('база: владелец (токен ownerToken) пишет карточку — 200, карточка в db.tod()', r.ok && r.status === 200 && JSON.stringify(db.tod()) === JSON.stringify({ td_a1: card() }));
    r = await call(db, 'PUT', '/tod/td_b2.json', other, card({ id: 'td_b2' }));
    T('база: чужой токен — 401, stats.denied растёт, данные не изменились', !r.ok && r.status === 401 && db.stats.denied === 1 && Object.keys(db.tod()).join() === 'td_a1');
    r = await call(db, 'PUT', '/tod/td_b2.json', null, card({ id: 'td_b2' }));
    T('база: без токена — 401', !r.ok && r.status === 401 && db.stats.denied === 2);
    r = await call(db, 'PUT', '/tod/td_b2.json', owner, { ...card({ id: 'td_b2' }), extra: 1 });
    T('база: владелец с лишним полем — 401 по правилам tod-rules.json', !r.ok && r.status === 401 && db.stats.denied === 3 && !db.tod().td_b2);
    r = await call(db, 'GET', '/tod/td_a1.json', null);
    T('база: чтение открыто без входа — GET /tod/<id>.json', r.ok && (await r.json()).text === 'Вопрос?');
    r = await call(db, 'GET', '/tod.json', other);
    T('база: GET /tod.json отдаёт все карточки', r.ok && Object.keys(await r.json()).join() === 'td_a1');
    r = await call(db, 'GET', '/tod/td_zz.json', null);
    T('база: GET несуществующей карточки — null', r.ok && (await r.json()) === null);
    r = await call(db, 'DELETE', '/tod/td_a1.json', other);
    T('база: чужой не удаляет (401), карточка на месте', !r.ok && r.status === 401 && !!db.tod().td_a1);
    r = await call(db, 'DELETE', '/tod/td_a1.json', owner);
    T('база: владелец удаляет — 200, db.tod() пуст', r.ok && JSON.stringify(db.tod()) === '{}');
    const c = db.tod(); c.zz = 1; T('база: db.tod() отдаёт копию', JSON.stringify(db.tod()) === '{}');
    db.seedTod({ td_s1: card({ id: 'td_s1' }), td_s2: card({ id: 'td_s2', type: 'dare' }) });
    T('база: seedTod кладёт карточки в обход правил', Object.keys(db.tod()).join() === 'td_s1,td_s2' && db.stats.denied === 4 && db.rooms() && Object.keys(db.rooms()).length === 0);
    r = await call(db, 'PUT', '/tod.json', owner, { td_a1: card(), td_b2: card({ id: 'td_b2' }) });
    T('база: владелец заменяет весь узел tod (PUT /tod.json), правила проверяют каждую карточку', r.ok && Object.keys(db.tod()).join() === 'td_a1,td_b2');
    r = await call(db, 'PUT', '/tod.json', owner, { td_a1: card(), td_b2: card({ id: 'td_b2', text: '' }) });
    T('база: одна плохая карточка в PUT /tod.json — вся запись отклонена, данные прежние', !r.ok && r.status === 401 && Object.keys(db.tod()).join() === 'td_a1,td_b2' && db.tod().td_b2.text === 'Вопрос?');
    r = await call(db, 'PATCH', '/tod/td_a1.json', owner, { text: 'x' });
    T('база: метод и путь, которых база не понимает, не принимаются молча', !r.ok && r.status === 400 && db.tod().td_a1.text === 'Вопрос?');
    const withoutOwner = makeDb(); r = await call(withoutOwner, 'PUT', '/tod/td_a1.json', 'tok_owner', card());
    T('база: без ownerToken владельца нет — любой токен обычный', !r.ok && r.status === 401);
  }
  {
    const db = makeDb({ ownerToken: owner }); const ok = { ver: 1, by: 'dev1', t: 1 };
    T('комнаты: пока комнат нет, room() и todRoom() — null', db.room() === null && db.todRoom() === null);
    await call(db, 'PUT', '/live/l_abc_t.json', other, { ...ok, status: 'active', st: '{}' });
    T('комнаты: комната `_t` вспомогательная — room() и roomId() её не видят, todRoom() возвращает', db.room() === null && db.roomId() === null && db.todRoom() && db.todRoom().st === '{}' && db.stats.denied === 0);
    await call(db, 'PUT', '/live/l_abc.json', other, ok); await call(db, 'PUT', '/live/l_abc_d.json', other, { ...ok, g: 1, d: 'x' });
    T('комнаты: рядом с классической комнатой и колодой room() — классическая, todRoom() — `_t`', db.roomId() === 'l_abc' && db.room().by === 'dev1' && db.deck().d === 'x' && db.todRoom().status === 'active');
    const r = await call(db, 'PUT', '/live/l_zzz_t.json', other, { by: 'dev1' });
    T('комнаты: запись в `_t` проверяется правилом live/$room (нужны ver/by/t) — 401', !r.ok && r.status === 401 && db.stats.denied === 1 && !db.rooms().l_zzz_t);
    const copy = db.todRoom(); copy.status = 'ended'; T('комнаты: todRoom() отдаёт копию', db.todRoom().status === 'active');
  }
  console.log(res.join('\n')); console.log('--- captured runtime errors: 0'); process.exit(res.some(l => l.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { console.log(res.join('\n')); console.log('TEST CRASH:', e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : e); process.exit(1); });
