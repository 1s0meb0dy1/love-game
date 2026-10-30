// Режим «Правда или действие»: модель карточки (src/tod/model.js).
// Проверяет константы, todCleanCard (те же ограничения, что в правилах tests/fixtures/tod-rules.json, плюс очистка текста), todCleanList,
// todPoolOf, todGroupCards и todNewId. Каждый результат todCleanCard дополнительно проверяется правилами tod: такую карточку Firebase примет.
const fs = require('fs'); const path = require('path');
const { loadTod } = require('../tod-load.js'); const { makeRules } = require('../rules-eval.js');
const res = []; const T = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
const finish = () => { console.log(res.join('\n')); console.log('--- captured runtime errors: 0'); process.exit(res.some(l => l.startsWith('FAIL')) ? 1 : 0); };
const NAMES = ['TOD_TYPES', 'TOD_LEVELS', 'TOD_LEVEL_LABEL', 'TOD_TEXT_MAX', 'todCleanCard', 'todCleanList', 'todPoolOf', 'todGroupCards', 'todNewId', 'todCardText'];
let M = null;
try { M = loadTod(['tod/model.js'], NAMES); } catch (e) { T('модуль src/tod/model.js загружается: ' + (e && e.message), false); finish(); }
const { TOD_TYPES, TOD_LEVELS, TOD_LEVEL_LABEL, TOD_TEXT_MAX, todCleanCard, todCleanList, todPoolOf, todGroupCards, todNewId, todCardText } = M;

const rules = makeRules(JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/tod-rules.json'), 'utf8')));
const OWNER = { uid: 'OWNER_UID' };
const passesRules = (c) => rules.check('PUT', ['tod', c.id], OWNER, c) === null;
const card = (o) => ({ id: 'td_a1', type: 'truth', difficulty: 'easy', text: 'Вопрос?', isActive: true, ...o });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// --- константы ---
T('TOD_TYPES = truth, dare', same(TOD_TYPES, ['truth', 'dare']));
T('TOD_LEVELS = easy, medium, hard', same(TOD_LEVELS, ['easy', 'medium', 'hard']));
T('TOD_LEVEL_LABEL: Легко / Средне / Жёстко', same(TOD_LEVEL_LABEL, { easy: 'Легко', medium: 'Средне', hard: 'Жёстко' }));
T('TOD_TEXT_MAX = 300 (как в правилах tod)', TOD_TEXT_MAX === 300);

// --- todCleanCard: принимает корректную ---
T('корректная карточка принимается без изменений', same(todCleanCard(card()), card()));
T('updatedAt (число) сохраняется', same(todCleanCard(card({ updatedAt: 1761300000000 })), card({ updatedAt: 1761300000000 })));
T('все сочетания типа и уровня принимаются', TOD_TYPES.every(t => TOD_LEVELS.every(d => { const c = todCleanCard(card({ type: t, difficulty: d })); return c && c.type === t && c.difficulty === d; })));
T('isActive false принимается (скрытая карточка)', todCleanCard(card({ isActive: false })).isActive === false);
T('id ровно 16 знаков принят', todCleanCard(card({ id: 'td_1234567890123' })).id === 'td_1234567890123');
T('лишние поля отбрасываются, остаются только поля карточки', same(Object.keys(todCleanCard({ ...card(), extra: 1, num: 5, updatedAt: 3 })), ['id', 'type', 'difficulty', 'text', 'isActive', 'updatedAt']));
T('без updatedAt поля updatedAt в результате нет', !('updatedAt' in todCleanCard(card())));

// --- todCleanCard: отбрасывает неверное ---
T('неверный type отброшен (question, пусто, число, Truth)', ['question', '', 1, 'Truth', null, undefined].every(v => todCleanCard(card({ type: v })) === null));
T('неверный difficulty отброшен (extreme, пусто, число, Easy)', ['extreme', '', 2, 'Easy', null, undefined].every(v => todCleanCard(card({ difficulty: v })) === null));
T('пустой текст отброшен (пусто, пробелы, только скобки и управляющие символы)', ['', '   ', '<>', '<<>>\u0001\u0007', '\n\t '].every(v => todCleanCard(card({ text: v })) === null));
T('текст не строка отброшен (число, объект, null)', [5, { a: 1 }, null, undefined, ['x']].every(v => todCleanCard(card({ text: v })) === null));
T('нестроковый id отброшен (число, null, объект)', [1, null, undefined, { a: 1 }, ['td_a1']].every(v => todCleanCard(card({ id: v })) === null));
T('id длиннее 16 знаков отброшен', todCleanCard(card({ id: 'td_12345678901234' })) === null && todCleanCard(card({ id: 'x'.repeat(50) })) === null);
T('пустой id отброшен', todCleanCard(card({ id: '' })) === null);
T('id с символами, запрещёнными в ключах Firebase (/ . $ # [ ]), отброшен', ['td/a', 'td.a', 'td$a', 'td#a', 'td[a', 'td]a', 'td\u0001'].every(v => todCleanCard(card({ id: v })) === null));
T('isActive не boolean отброшен (строка, число, null, нет поля)', ['true', 1, 0, null, undefined].every(v => todCleanCard(card({ isActive: v })) === null));
T('updatedAt не число отброшен (строка, NaN, Infinity, объект)', ['5', NaN, Infinity, { a: 1 }, true].every(v => todCleanCard(card({ updatedAt: v })) === null));
T('updatedAt null или отсутствует — карточка принимается без поля', !('updatedAt' in todCleanCard(card({ updatedAt: null }))) && !('updatedAt' in todCleanCard(card({ updatedAt: undefined }))));
T('не объект отброшен (null, строка, число, массив)', [null, undefined, 'td_a1', 5, [], [card()]].every(v => todCleanCard(v) === null));

// --- todCleanCard: очистка текста ---
T('текст обрезается до 300 знаков', todCleanCard(card({ text: 'я'.repeat(500) })).text.length === 300);
T('текст ровно 300 знаков не меняется', todCleanCard(card({ text: 'я'.repeat(300) })).text === 'я'.repeat(300));
T('скобки <script> вычищаются, текст остаётся', todCleanCard(card({ text: '<script>alert(1)</script> Привет?' })).text === 'scriptalert(1)/script Привет?');
T('угловые скобки удаляются везде (<b>жирный</b>)', !/[<>]/.test(todCleanCard(card({ text: 'а <b>жирный</b> > б < в' })).text));
T('управляющие символы удаляются, пробелы по краям обрезаются', todCleanCard(card({ text: '  \u0000При\u0007вет\u001F?\u007F  ' })).text === 'Привет?');
T('после обрезки до 300 нет пробела в конце', (() => { const t = todCleanCard(card({ text: 'я'.repeat(299) + ' ' + 'я'.repeat(10) })).text; return t === 'я'.repeat(299); })());
T('обрезка не оставляет половину эмодзи (суррогатную пару)', (() => { const t = todCleanCard(card({ text: 'я'.repeat(299) + '😀😀' })).text; return t === 'я'.repeat(299) && !/[\uD800-\uDBFF]$/.test(t); })());
T('очистка не меняет переданный объект', (() => { const raw = card({ text: '  <i>x</i>  ' }); todCleanCard(raw); return raw.text === '  <i>x</i>  '; })());

// --- результат todCleanCard проходит правила tod (сверка с tests/fixtures/tod-rules.json) ---
{
  const raws = [card(), card({ updatedAt: 7 }), card({ type: 'dare', difficulty: 'hard', isActive: false }), card({ text: 'я'.repeat(400) }), card({ text: '<b>x</b>' + '\u0001' }),
    { ...card(), extra: 'лишнее', n: 1 }, card({ id: 'td_1234567890123' }), card({ text: '😀'.repeat(200) })];
  const outs = raws.map(todCleanCard);
  T('каждая очищенная карточка проходит правила tod (' + outs.length + ' случаев)', outs.every(c => c && passesRules(c)));
  const bad = [card({ type: 'x' }), card({ difficulty: 'x' }), card({ text: '' }), card({ id: 5 }), card({ id: 'td_12345678901234' }), card({ isActive: 'true' }), card({ updatedAt: '5' })];
  T('всё, что правила tod отклонили бы по значениям, todCleanCard тоже отбрасывает', bad.every(c => !passesRules(c) && todCleanCard(c) === null));
}

// --- todCleanList ---
{
  const db = { td_b: card({ id: 'td_b', text: 'Б?' }), td_a: card({ id: 'td_a', text: 'А?' }), junk: { foo: 1 }, td_x: card({ id: 'td_x', type: 'nope' }), nul: null, str: 'td_c' };
  const l = todCleanList(db);
  T('из объекта БД: мусор отброшен, карточки отсортированы по id', same(l.map(c => c.id), ['td_a', 'td_b']));
  T('из массива: дубли id убраны (остаётся первая), сортировка по id', same(todCleanList([card({ id: 'td_z', text: 'первая?' }), card({ id: 'td_m' }), card({ id: 'td_z', text: 'вторая?' }), 5, null]).map(c => c.id + ':' + c.text), ['td_m:Вопрос?', 'td_z:первая?']));
  T('сортировка по кодам символов, а не по локали (td_B раньше td_a, td_s010 после td_s009)', same(todCleanList([card({ id: 'td_a' }), card({ id: 'td_B' }), card({ id: 'td_s010' }), card({ id: 'td_s009' })]).map(c => c.id), ['td_B', 'td_a', 'td_s009', 'td_s010']));
  T('null, undefined, строка, число — пустой список', [null, undefined, 'x', 5, true].every(v => Array.isArray(todCleanList(v)) && todCleanList(v).length === 0));
  T('элементы списка очищены (текст без <>, обрезан)', (() => { const x = todCleanList([card({ text: '<i>' + 'я'.repeat(400) })])[0]; return x.text.length === 300 && !/[<>]/.test(x.text); })());
  T('исходный массив не меняется (не сортируется на месте)', (() => { const arr = [card({ id: 'td_b' }), card({ id: 'td_a' })]; todCleanList(arr); return arr[0].id === 'td_b'; })());
}

// --- todPoolOf ---
T('todPoolOf: truth любого уровня -> truth', TOD_LEVELS.every(d => todPoolOf(card({ type: 'truth', difficulty: d })) === 'truth'));
T('todPoolOf: dare easy -> dare.easy', todPoolOf(card({ type: 'dare', difficulty: 'easy' })) === 'dare.easy');
T('todPoolOf: dare medium -> dare.medium', todPoolOf(card({ type: 'dare', difficulty: 'medium' })) === 'dare.medium');
T('todPoolOf: dare hard -> dare.hard', todPoolOf(card({ type: 'dare', difficulty: 'hard' })) === 'dare.hard');
T('todPoolOf: неверная карточка -> null', [null, undefined, {}, card({ type: 'x' }), card({ type: 'dare', difficulty: 'x' })].every(c => todPoolOf(c) === null));

// --- todGroupCards ---
{
  const cards = [card({ id: 'td_1' }), card({ id: 'td_2', isActive: false }), card({ id: 'td_3', type: 'dare', difficulty: 'hard' }), card({ id: 'td_4', type: 'dare', difficulty: 'hard', isActive: false }), card({ id: 'td_5', difficulty: 'medium' })];
  const ids = (g) => ['truth', 'dare'].map(t => t + ':' + TOD_LEVELS.map(d => d + '=' + g[t][d].map(c => c.id).join(',')).join(';')).join(' | ');
  const g = todGroupCards(cards);
  T('todGroupCards: структура truth/dare × easy/medium/hard, все списки — массивы', ['truth', 'dare'].every(t => g[t] && TOD_LEVELS.every(d => Array.isArray(g[t][d]))) && same(Object.keys(g), ['truth', 'dare']));
  T('todGroupCards: скрытые (isActive:false) не показываются без showHidden', ids(g) === 'truth:easy=td_1;medium=td_5;hard= | dare:easy=;medium=;hard=td_3');
  T('todGroupCards: { showHidden: false } — то же самое', ids(todGroupCards(cards, { showHidden: false })) === ids(g));
  T('todGroupCards: { showHidden: true } — скрытые показаны, порядок сохранён', ids(todGroupCards(cards, { showHidden: true })) === 'truth:easy=td_1,td_2;medium=td_5;hard= | dare:easy=;medium=;hard=td_3,td_4');
  T('todGroupCards: мусор и неверные карточки пропускаются, не падает на null', ids(todGroupCards([null, 5, card({ type: 'x' }), card({ id: 'td_9' })], null)) === 'truth:easy=td_9;medium=;hard= | dare:easy=;medium=;hard=');
  T('todGroupCards: не массив — пустые группы', ids(todGroupCards(null)) === 'truth:easy=;medium=;hard= | dare:easy=;medium=;hard=');
}

// --- todNewId ---
{
  const NOW = 1761300000000;
  const a = todNewId(NOW, () => 0.1), b = todNewId(NOW, () => 0.2);
  T('todNewId: формат td_ + base36 (' + a + ')', /^td_[0-9a-z]+$/.test(a));
  T('todNewId: не длиннее 16 знаков', a.length <= 16 && b.length <= 16);
  T('todNewId: разные при разных rnd', a !== b);
  T('todNewId: одинаковые при одинаковых now и rnd (детерминирован)', todNewId(NOW, () => 0.5) === todNewId(NOW, () => 0.5));
  T('todNewId: разные при разных now', todNewId(NOW, () => 0.5) !== todNewId(NOW + 1, () => 0.5));
  T('todNewId: ≤16 и формат при крайних значениях (now 0, 1e15, -5, NaN; rnd 0, 1, 0.999999, NaN)', [0, 1e15, -5, NaN].every(n => [0, 1, 0.999999, NaN].every(r => { const id = todNewId(n, () => r); return id.length <= 16 && /^td_[0-9a-z]+$/.test(id); })));
  T('todNewId: по умолчанию (без аргументов) — валидный id, 20 вызовов без повторов', (() => { const s = new Set(); for (let i = 0; i < 20; i++) s.add(todNewId()); return s.size === 20 && [...s].every(id => id.length <= 16 && /^td_[0-9a-z]+$/.test(id)); })());
  T('todNewId: карточка с новым id проходит todCleanCard и правила tod', (() => { const c = todCleanCard(card({ id: todNewId() })); return !!c && passesRules(c); })());
  T('todNewId: id позже по времени сортируется после раннего (ровная длина)', todNewId(NOW, () => 0.9) < todNewId(NOW + 1000, () => 0.1));
}

T('text_uk: сохраняется очищенным, пустой или не строка — отбрасывается', todCleanCard(card({ text_uk: '  <Питання?> ' })).text_uk === 'Питання?' && !('text_uk' in todCleanCard(card({ text_uk: '   ' }))) && !('text_uk' in todCleanCard(card({ text_uk: 7 }))));
T('todCardText: uk берёт text_uk, без него и для ru — text', todCardText(card({ text_uk: 'Питання?' }), 'uk') === 'Питання?' && todCardText(card({ text_uk: 'Питання?' }), 'ru') === 'Вопрос?' && todCardText(card(), 'uk') === 'Вопрос?' && todCardText(null, 'uk') === '');
T('text_en: сохраняется очищенным, пустой — отбрасывается; todCardText(en) берёт text_en, без него — text', todCleanCard(card({ text_en: ' <Question?> ' })).text_en === 'Question?' && !('text_en' in todCleanCard(card({ text_en: ' ' }))) && todCardText(card({ text_en: 'Question?' }), 'en') === 'Question?' && todCardText(card({ text_uk: 'Питання?' }), 'en') === 'Вопрос?' && todCardText(card({ text_en: 'Question?' }), 'uk') === 'Вопрос?');
finish();
