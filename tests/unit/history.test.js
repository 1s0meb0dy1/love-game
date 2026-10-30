// История игр сессии (src/history/model.js): запись по ходу партии, чистка, слияние двух копий, снимок «Продолжить», отличие партии и сводка.
const { loadTod } = require('../tod-load.js');
const res = []; const T = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
const { HIST_MAX, histCleanItem, histClean, histMerge, histAdd, histMarkContinued, histBuild, histBadge, histTotals } = loadTod(['history/model.js'], ['HIST_MAX', 'histCleanItem', 'histClean', 'histMerge', 'histAdd', 'histMarkContinued', 'histBuild', 'histBadge', 'histTotals']);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const P = [{ id: 'p1', name: 'Макс', gender: 'guy' }, { id: 'p2', name: 'Аня', gender: 'girl' }];
const Q = [{ level: 'Простые', categoryId: 'family' }, { level: 'Средние', categoryId: 'romance' }, { level: 'Глубокие', categoryId: 'romance' }, { level: 'Простые', categoryId: 'fun' }];
const turn = (o) => ({ cur: null, answered: [], skippedBy: [], skippedAll: false, ...o });
const res0 = { questionIds: ['a', 'b', 'c', 'd'], currentIndex: 2, maxReachedIndex: 2, turnHistory: {} };
const cleanRes = (g) => (g && Array.isArray(g.questionIds) && g.questionIds.length ? g : null);

// histBuild: пройденные, пропущенные, уровни, темы, игроки
const entries = [turn({ answered: ['p1', 'p2'] }), turn({ skippedAll: true, skippedBy: ['p1', 'p2'] }), turn({ answered: ['p1'], skippedBy: ['p2'] }), turn({ cur: 'p1' })];
const r = histBuild({ now: 1000, players: P, questions: Q, entries, hard: false, reached: 4, allCleared: false, res: res0 });
T('histBuild: пройдено 2 (оба ответили и частично), пропущено 1 (все пропустили), 4-й вопрос с незаконченным ходом не считается', r && r.a === 2 && r.s === 1 && r.n === 4 && r.r === 4);
T('histBuild: уровни пройденных (1 лёгкий, 0 средних, 1 глубокий — 2-й вопрос пропущен целиком)', r.e === 1 && r.md === 0 && r.h === 1);
T('histBuild: игроки — у Макса 2 ответа, у Ани 1 ответ и 2 пропуска (пропуск «для всех» тоже её)', r.pl[0].a === 2 && r.pl[0].s === 1 && r.pl[1].a === 1 && r.pl[1].s === 2);
T('histBuild: темы по убыванию, не больше трёх; id и время; режим; снимок res у незавершённой', same(r.tc, [['family', 1], ['romance', 1]]) && r.id === 'g' + (1000).toString(36) && r.t === 1000 && r.m === 'normal' && !!r.res && r.all === false && r.cont === false);
T('histBuild: «вся колода» и режим hard; снимок у законченной не хранится', (() => { const x = histBuild({ now: 5, players: P, questions: Q.slice(0, 1), entries: [turn({ answered: ['p1', 'p2'] })], hard: true, reached: 1, allCleared: true, res: res0 }); return x.all === true && x.m === 'hard' && !x.res; })());
T('histBuild: без пройденных и пропущенных вопросов записи нет (null), мусор не роняет', histBuild({ now: 1, players: P, questions: Q, entries: [], reached: 1 }) === null && histBuild({}) === null && histBuild({ now: 1, questions: [{}], entries: [null] }) === null);

// чистка
T('histCleanItem: лишние поля отброшены, числа в границах, игроков не больше 10, пол только guy/girl', (() => {
  const c = histCleanItem({ id: 'g1', t: 5, m: 'x', n: -4, a: '7', s: 1e9, e: 1, md: 2, h: 3, all: 'yes', foo: 1, tc: [['a', 2], ['b', 1], ['c', 1], ['d', 1], 5], pl: Array.from({ length: 12 }, (_, i) => ({ id: 'p' + i, name: 'x'.repeat(40), gender: 'zz', a: 1, s: 2, extra: 1 })) }, cleanRes);
  return c && c.m === 'normal' && c.n === 0 && c.a === 7 && c.s === 9999 && c.all === false && !('foo' in c) && c.tc.length === 3 && c.pl.length === 10 && c.pl[0].name.length === 25 && c.pl[0].gender === 'guy' && !('extra' in c.pl[0]);
})());
T('histCleanItem: без id или времени — null; снимок чистится вызывающим и отбрасывается у законченной или продолженной', histCleanItem({ t: 5 }) === null && histCleanItem({ id: 'a' }) === null && histCleanItem(null) === null && histCleanItem([]) === null
  && !histCleanItem({ id: 'a', t: 1, all: true, res: res0 }, cleanRes).res && !histCleanItem({ id: 'a', t: 1, cont: true, res: res0 }, cleanRes).res && !!histCleanItem({ id: 'a', t: 1, res: res0 }, cleanRes).res && !histCleanItem({ id: 'a', t: 1, res: res0 }).res);
T('histClean: повторы id убраны, новые первыми, не больше HIST_MAX, не массив -> []', (() => {
  const many = Array.from({ length: 30 }, (_, i) => ({ id: 'g' + i, t: i + 1 })); const c = histClean([...many, { id: 'g3', t: 99 }]);
  return c.length === HIST_MAX && c[0].t === 30 && new Set(c.map(x => x.id)).size === c.length && same(histClean('x'), []) && same(histClean(null), []);
})());

// добавление, слияние, продолжение
T('histAdd: новая запись первой, у прежних снимок «Продолжить» убран, список не длиннее HIST_MAX', (() => {
  const old = [{ id: 'g1', t: 1, res: res0 }, { id: 'g2', t: 0 }]; const out = histAdd(old, { id: 'g3', t: 2, res: res0 });
  const long = histAdd(Array.from({ length: HIST_MAX }, (_, i) => ({ id: 'x' + i, t: i })), { id: 'new', t: 99 });
  return out[0].id === 'g3' && !!out[0].res && !out[1].res && out.length === 3 && long.length === HIST_MAX && long[0].id === 'new' && same(histAdd(null, { id: 'a', t: 1 }).map(x => x.id), ['a']);
})());
T('histMarkContinued: запись помечается cont и теряет снимок, остальные не меняются', (() => { const out = histMarkContinued([{ id: 'a', t: 2, res: res0 }, { id: 'b', t: 1 }], 'a'); return out[0].cont === true && !out[0].res && out[1].id === 'b' && !('cont' in out[1]); })());
T('histMerge: объединение по id, новые первыми; снимок только у самой свежей; «продолжена» с другого устройства побеждает', (() => {
  const A = [{ id: 'g1', t: 1 }, { id: 'g2', t: 2, res: res0 }]; const B = [{ id: 'g3', t: 3 }, { id: 'g2', t: 2, cont: true }];
  const m = histMerge(A, B, cleanRes); const m2 = histMerge([{ id: 'a', t: 5, res: res0 }, { id: 'b', t: 4, res: res0 }], [], cleanRes);
  return same(m.map(x => x.id), ['g3', 'g2', 'g1']) && m[1].cont === true && !m[1].res && !!m2[0].res && !m2[1].res && same(histMerge(null, null), []);
})());

// отличие и сводка
T('histBadge: вся колода, без пропусков, любители глубины, осторожные, разговорчивые, хорошее начало', histBadge({ all: true, a: 1, s: 0, h: 0 }) === '🏆 Прошли всю колоду' && histBadge({ a: 6, s: 0, h: 0 }) === '💪 Без пропусков' && histBadge({ a: 4, s: 1, h: 3 }) === '🌊 Любители глубины' && histBadge({ a: 2, s: 5, h: 0 }) === '🛡️ Осторожные' && histBadge({ a: 16, s: 2, h: 1 }) === '🔥 Разговорчивые' && histBadge({ a: 3, s: 1, h: 0 }) === '✨ Хорошее начало' && histBadge(null) === '');
T('histTotals: игры, пройдено, пропущено и самая частая тема по всем играм', (() => { const t = histTotals([{ a: 3, s: 1, tc: [['romance', 2], ['fun', 1]] }, { a: 2, s: 0, tc: [['fun', 4]] }]); return t.games === 2 && t.answered === 5 && t.skipped === 1 && t.topCat === 'fun'; })() && histTotals(null).games === 0 && histTotals([]).topCat === '');

console.log(res.join('\n')); console.log('--- captured runtime errors: 0'); process.exit(res.some(l => l.startsWith('FAIL')) ? 1 : 0);
