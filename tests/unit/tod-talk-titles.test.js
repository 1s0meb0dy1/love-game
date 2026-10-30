// Режим «Правда или действие»: подстановка и выбор подколки (src/tod/talk.js), титулы и таблица итогов (src/tod/titles.js).
const { loadTod } = require('../tod-load.js');
const res = []; const T = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
const finish = () => { console.log(res.join('\n')); console.log('--- captured runtime errors: 0'); process.exit(res.some(l => l.startsWith('FAIL')) ? 1 : 0); };
const NAMES = ['TOD_BANTER', 'TOD_TITLES', 'todBuildDeck', 'todStart', 'todApply', 'todExpand', 'todPickBanter', 'todTitles'];
let M = null;
try { M = loadTod(['content/tod-banter.js', 'tod/model.js', 'tod/deck.js', 'tod/engine.js', 'tod/talk.js', 'tod/titles.js'], NAMES); } catch (e) { T('модули talk.js и titles.js загружаются: ' + (e && e.message), false); finish(); }
const { TOD_BANTER, TOD_TITLES, todBuildDeck, todStart, todApply, todExpand, todPickBanter, todTitles } = M;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const cards = []; ['truth', 'dare'].forEach(type => ['easy', 'medium', 'hard'].forEach(d => { for (let i = 0; i < 5; i++) cards.push({ id: `td_${type[0]}${d[0]}${i}`, type, difficulty: d, text: 'x', isActive: true }); }));
const ctx = { deck: todBuildDeck(cards, { hard: true, seed: 't1' }), level: id => (cards.find(c => c.id === id) || {}).difficulty || null };
const run = (st, acts) => { for (const a of acts) { const r = todApply(st, { ...a, seq: st.seq }, ctx); if (!r.ok) throw new Error('action ' + a.t + ' ' + r.reason); st = r.state; } return st; };
const P = (n) => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: ['Макс', 'Аня', 'Олег', 'Ира'][i], gender: i % 2 ? 'girl' : 'guy' }));
const start = (n = 3, opts = { hard: true, tone: 1 }) => todStart({ players: P(n), opts, gid: 'gid1' });
const SKIP = [{ t: 'choose', type: 'dare' }, { t: 'level', diff: 'medium' }, { t: 'skip' }];
const DONE = (diff = 'medium') => [{ t: 'choose', type: 'dare' }, { t: 'level', diff }, { t: 'done' }];
const TRUTH_DONE = [{ t: 'choose', type: 'truth' }, { t: 'done' }];
const idsOf = (list, p) => list.filter(x => x.p === p).map(x => x.id);

T('todExpand: {name} и {a|b} по полу guy/girl', todExpand('{name} {сам|сама} {виноват|виновата}', { name: 'Макс', gender: 'guy' }) === 'Макс сам виноват' && todExpand('{name} {сам|сама} виноват{|а}', { name: 'Аня', gender: 'girl' }) === 'Аня сама виновата');
T('имя с {a|b}, {name} и <b> не раскрывается повторно, выводится как есть', todExpand('{name} {ушёл|ушла}', { name: '{name}{x|y}<b>', gender: 'girl' }) === '{name}{x|y}<b> ушла');
T('todExpand без игрока и шаблона не падает', todExpand('{name}!', null) === '!' && todExpand(undefined, { name: 'A' }) === '');

const s = run(start(), [...SKIP]);
const a = todPickBanter(s, TOD_BANTER); const b = todPickBanter(JSON.parse(JSON.stringify(s)), TOD_BANTER.slice());
T('todPickBanter: одинаков при одинаковых gid/seq/ev, на любом «устройстве»', a && a === b && a.includes('Макс') && !/[{}]/.test(a));
const other = todPickBanter({ ...s, gid: 'gid2' }, TOD_BANTER); const many = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(g => todPickBanter({ ...s, gid: g }, TOD_BANTER)));
T('todPickBanter: другая партия — другой выбор хотя бы иногда', typeof other === 'string' && many.size > 1);
const lines = [{ id: 'x1', ev: 'skip_1', tone: 1, text: 'мягко {name}' }];
T('tone 0 -> пустая строка; tone 2 без строк тона 2 для события -> строка тона 1', todPickBanter({ ...s, opts: { hard: true, tone: 0 } }, TOD_BANTER) === '' && todPickBanter({ ...s, opts: { hard: true, tone: 2 } }, lines) === 'мягко Макс');
T('tone 1 не берёт строки тона 2 (и политические)', Array.from({ length: 40 }, (_, i) => todPickBanter({ ...s, gid: 'g' + i }, TOD_BANTER)).every(t => !TOD_BANTER.some(l => l.tone === 2 && todExpand(l.text, s.pl[0]) === t)));
T('нет строк для события -> пустая строка, без исключения', todPickBanter(s, []) === '' && todPickBanter(s, null) === '' && todPickBanter(null, TOD_BANTER) === '' && todPickBanter({ ...s, ev: { k: 'nope', seq: 1, p: 0 } }, TOD_BANTER) === '');

// трое игроков: у Макса три пропуска подряд, потом выполнение; Аня и Олег по разу выполняют
const sc = run(start(), [...SKIP, ...SKIP, ...SKIP, ...DONE(), ...DONE(), ...DONE()]);
const tt = todTitles(sc, TOD_TITLES);
T('todTitles: трое игроков, сценарий с тремя пропусками подряд у первого -> coward и deserter', same(idsOf(tt.shame, 0), ['coward', 'deserter']) && !tt.clean);
T('выполнение после 2 пропусков -> redeemed; при пропусках больше выполненного место занимает «давай потом» (порядок таблицы)', (() => { const x = todTitles(run(start(2, { hard: false, tone: 1 }), [...SKIP, ...SKIP, ...DONE(), ...DONE(), ...DONE()]), TOD_TITLES); const y = todTitles(run(start(2), [...SKIP, ...SKIP, ...DONE()]), TOD_TITLES); return same(idsOf(x.shame, 0), ['coward']) && idsOf(x.cheer, 0).includes('redeemed') && same(idsOf(y.shame, 0), ['coward', 'later']) && !idsOf(y.cheer, 0).length; })());
const tie = todTitles(run(start(2), [...SKIP, ...SKIP, ...DONE(), ...SKIP, ...SKIP, ...DONE()]), TOD_TITLES);
T('ничья по пропускам -> coward у игрока с меньшим индексом', idsOf(tie.shame, 0).includes('coward') && !idsOf(tie.shame, 1).includes('coward'));
const lots = todTitles(run(start(2), [...SKIP, ...SKIP, ...SKIP, { t: 'choose', type: 'dare' }, { t: 'level', diff: 'hard' }, { t: 'skip' }, ...DONE('hard'), ...TRUTH_DONE]), TOD_TITLES);
T('не более двух титулов на игрока', [0, 1].every(p => idsOf(lots.shame, p).length + idsOf(lots.cheer, p).length <= 2) && idsOf(lots.shame, 0).length === 2);
const empty = todTitles(start(), TOD_TITLES);
T('пустая статистика (конец сразу): clean:true, shame и cheer пусты, rank без NaN', empty.clean && empty.shame.length === 0 && empty.cheer.length === 0 && empty.rank.length === 3 && !/NaN|undefined|null/.test(JSON.stringify(empty.rank)));
const two = todTitles(run(start(2), [...DONE('easy'), ...TRUTH_DONE]), TOD_TITLES);
T('два игрока, по одному ходу: titles не падают, доли считаются без деления на 0', !/NaN/.test(JSON.stringify(two)) && idsOf(two.cheer, 0).includes('dare_master') && idsOf(two.cheer, 1).includes('honest') && two.clean);
const rk = todTitles(run(start(3), [...DONE(), ...SKIP, ...DONE(), ...DONE(), ...DONE(), ...DONE(), ...DONE()]), TOD_TITLES).rank;
T('rank упорядочен: больше выполнено выше, при равенстве меньше пропусков', same(rk.map(r => r.p), [0, 2, 1]) && rk[0].done === 2 && rk[1].skips === 0 && rk[2].skips === 1);
const easyLife = todTitles(run(start(2), [...DONE('easy'), ...DONE('easy'), ...DONE('easy'), ...DONE('easy'), ...DONE('easy'), ...DONE('easy'), ...DONE('easy'), ...DONE('easy')]), TOD_TITLES);
T('4 выбора «Легко» из 4 -> easy_life; при включённых жёстких — и careful (не больше двух)', same(idsOf(easyLife.shame, 0), ['easy_life', 'careful']));
// «Правда» не больше 3 раз подряд: по три правды у каждого (больше без «Действия» подряд не бывает) -> afraid_dare; по два + свободное «Действие» -> нет
const fear = todTitles(run(start(2), [...TRUTH_DONE, ...TRUTH_DONE, ...TRUTH_DONE, ...TRUTH_DONE, ...TRUTH_DONE, ...TRUTH_DONE]), TOD_TITLES);
T('3 «Правды» подряд у каждого без «Действий» -> afraid_dare (позор) у обоих', fear.clean && [0, 1].every(p => idsOf(fear.shame, p)[0] === 'afraid_dare'));
const brave = todTitles(run(start(2), [...TRUTH_DONE, ...TRUTH_DONE, ...DONE('easy'), ...DONE('easy'), ...TRUTH_DONE, ...TRUTH_DONE]), TOD_TITLES);
T('«Действие» выбрано по своей воле (2 правды, 1 действие) -> afraid_dare нет', [0, 1].every(p => !idsOf(brave.shame, p).includes('afraid_dare')));
const forced = todTitles(run(start(2), [...TRUTH_DONE, ...TRUTH_DONE, ...TRUTH_DONE, ...TRUTH_DONE, ...TRUTH_DONE, ...TRUTH_DONE, ...DONE('easy'), ...DONE('easy')]), TOD_TITLES);
T('«Действие» только после трёх правд подряд (принуждение) -> afraid_dare остаётся', [0, 1].every(p => idsOf(forced.shame, p).includes('afraid_dare')));

finish();
