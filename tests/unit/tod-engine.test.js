// Режим «Правда или действие»: движок игры (src/tod/engine.js) — фазы, пропуски, события подколок, seq, конец игры, санитизация состояния.
const { loadTod } = require('../tod-load.js');
const res = []; const T = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
const finish = () => { console.log(res.join('\n')); console.log('--- captured runtime errors: 0'); process.exit(res.some(l => l.startsWith('FAIL')) ? 1 : 0); };
const NAMES = ['todBuildDeck', 'todStart', 'todApply', 'todSanitize', 'todStStr', 'todTruthLocked', 'todTruthRun', 'TOD_TRUTH_LIMIT'];
let M = null;
try { M = loadTod(['tod/model.js', 'tod/deck.js', 'tod/engine.js'], NAMES); } catch (e) { T('модуль src/tod/engine.js загружается: ' + (e && e.message), false); finish(); }
const { todBuildDeck, todStart, todApply, todSanitize, todStStr, todTruthLocked, todTruthRun, TOD_TRUTH_LIMIT } = M;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 30 карточек: по 5 на «правду» каждого уровня и на каждый уровень «действия»
const cards = []; ['truth', 'dare'].forEach(type => ['easy', 'medium', 'hard'].forEach(d => { for (let i = 0; i < 5; i++) cards.push({ id: `td_${type[0]}${d[0]}${i}`, type, difficulty: d, text: 'x', isActive: true }); }));
const level = (id) => { const c = cards.find(x => x.id === id); return c ? c.difficulty : null; };
const deckHard = todBuildDeck(cards, { hard: true, seed: 'e1' }); const deckSoft = todBuildDeck(cards, { hard: false, seed: 'e1' });
const ctxH = { deck: deckHard, level }; const ctxS = { deck: deckSoft, level };
const P2 = [{ id: 'p1', name: 'Макс', gender: 'guy' }, { id: 'p2', name: 'Аня', gender: 'girl' }];
const start = (opts = { hard: true, tone: 1 }, players = P2) => todStart({ players, opts, gid: 'g1' });
// цепочка действий; каждое берёт seq текущего состояния
const run = (st, acts, ctx = ctxH) => { const evs = []; for (const a of acts) { const r = todApply(st, { ...a, seq: st.seq }, ctx); if (!r.ok) return { st, evs, fail: r }; st = r.state; evs.push(st.ev.k); } return { st, evs }; };
// карточка «правды» нужного уровня: перебираем выдачи, пока не попадётся жёсткая (с пропуском, чтобы ход не уходил)
const zero = { d: [0, 0, 0, 0], s: [0, 0, 0, 0], dh: 0, sh: 0, c: [0, 0], l: [0, 0, 0], ms: 0, rd: 0, rt: [-1, 0], re: 0 };

const s0 = start();
T('старт: phase choose, turn 0, seq 0, у каждого игрока нулевая статистика', s0.phase === 'choose' && s0.turn === 0 && s0.seq === 0 && s0.v === 1 && s0.stat.length === 2 && s0.stat.every(s => same(s, zero)) && same(s0.ev, { k: 'turn_start', seq: 0, p: 0 }) && same(s0.opts, { hard: true, tone: 1 }));

const r1 = todApply(s0, { t: 'choose', type: 'truth', seq: 0 }, ctxH);
T('choose truth -> phase card, card.pool truth, seq 1', r1.ok && r1.state.phase === 'card' && r1.state.card.pool === 'truth' && r1.state.seq === 1 && r1.state.ev.k === 'chose_truth' && r1.state.card.lv === level(r1.state.card.id));
const r2 = todApply(s0, { t: 'choose', type: 'dare', seq: 0 }, ctxH);
T('choose dare -> phase level, карточки ещё нет', r2.ok && r2.state.phase === 'level' && r2.state.card === null && r2.state.ev.k === 'chose_dare');
const soft = run(start({ hard: false, tone: 1 }), [{ t: 'choose', type: 'dare' }], ctxS).st;
const rEmpty = todApply(soft, { t: 'level', diff: 'hard', seq: soft.seq }, ctxS);
T('level hard при пустом пуле -> ok:false reason empty, состояние то же', !rEmpty.ok && rEmpty.reason === 'empty' && rEmpty.state === soft);
T('исходное состояние не мутируется', same(s0, start()));

const dn = run(s0, [{ t: 'choose', type: 'dare' }, { t: 'level', diff: 'medium' }, { t: 'done' }]);
T('done: ход переходит, streak 0, d[...] +1', !dn.fail && dn.st.turn === 1 && dn.st.streak === 0 && dn.st.stat[0].d[2] === 1 && dn.st.phase === 'choose' && dn.st.card === null && dn.st.type === '' && dn.st.diff === '' && dn.st.ev.p === 0 && dn.evs[2] === 'done');
const sk = run(s0, [{ t: 'choose', type: 'dare' }, { t: 'level', diff: 'easy' }, { t: 'skip' }]);
T('skip: turn прежний, phase choose, streak 1, s[...] +1, запись в log', sk.st.turn === 0 && sk.st.phase === 'choose' && sk.st.streak === 1 && sk.st.stat[0].s[1] === 1 && sk.st.log.length === 1 && sk.st.log[0][0] === 0 && sk.st.log[0][1] === 'dare.easy' && sk.st.card === null);
const easySkip = [{ t: 'choose', type: 'dare' }, { t: 'level', diff: 'medium' }, { t: 'skip' }];
const sk3 = run(s0, [...easySkip, ...easySkip, ...easySkip]);
T('три skip подряд: ms===3, события skip_1, skip_2, skip_3', sk3.st.stat[0].ms === 3 && same([sk3.evs[2], sk3.evs[5], sk3.evs[8]], ['skip_1', 'skip_2', 'skip_3']));
const sk4 = run(sk3.st, easySkip);
T('четвёртый пропуск подряд — снова skip_3', sk4.evs[2] === 'skip_3' && sk4.st.stat[0].ms === 4);
const skh = run(s0, [{ t: 'choose', type: 'dare' }, { t: 'level', diff: 'hard' }, { t: 'skip' }]);
T('skip жёсткой карточки -> skip_hard и sh+1', skh.evs[2] === 'skip_hard' && skh.st.stat[0].sh === 1 && skh.st.stat[0].s[3] === 1);
const dh = run(s0, [{ t: 'choose', type: 'dare' }, { t: 'level', diff: 'hard' }, { t: 'done' }]);
T('done жёсткой -> done_hard и dh+1', dh.evs[2] === 'done_hard' && dh.st.stat[0].dh === 1);

const red2 = run(s0, [...easySkip, ...easySkip, { t: 'choose', type: 'dare' }, { t: 'level', diff: 'medium' }, { t: 'done' }]);
const red1 = run(s0, [...easySkip, { t: 'choose', type: 'dare' }, { t: 'level', diff: 'medium' }, { t: 'done' }]);
T('done после 2 пропусков: rd===1, событие redeem; после 1 пропуска rd===0, но событие redeem', red2.st.stat[0].rd === 1 && red2.evs[8] === 'redeem' && red1.st.stat[0].rd === 0 && red1.evs[5] === 'redeem');

const c1 = todApply(s0, { t: 'choose', type: 'truth', seq: 0 }, ctxH).state;
const stale = todApply(c1, { t: 'done', seq: 0 }, ctxH);
const d1 = todApply(c1, { t: 'done', seq: 1 }, ctxH); const d2 = todApply(d1.state, { t: 'done', seq: 1 }, ctxH);
T('seq: действие с устаревшим seq отклонено; два подряд одинаковых done с одним seq — применится одно', !stale.ok && stale.reason === 'seq' && d1.ok && !d2.ok && d2.state.turn === 1 && d2.state.stat[0].d[0] === 1);
T('неверная фаза (done в phase choose) отклонена', !todApply(s0, { t: 'done', seq: 0 }, ctxH).ok && !todApply(s0, { t: 'level', diff: 'easy', seq: 0 }, ctxH).ok && !todApply(s0, { t: 'choose', type: 'x', seq: 0 }, ctxH).ok);
T('неизвестное действие и мусор отклонены без исключения', !todApply(s0, { t: 'boom', seq: 0 }, ctxH).ok && !todApply(s0, null, ctxH).ok && !todApply(null, { t: 'done', seq: 0 }, ctxH).ok);

// круг: в dare.easy 5 карточек — шестая выдача начинает новый круг
const lvlEasy = [{ t: 'choose', type: 'dare' }, { t: 'level', diff: 'easy' }, { t: 'done' }];
const cyc = run(s0, [...lvlEasy, ...lvlEasy, ...lvlEasy, ...lvlEasy, ...lvlEasy, ...lvlEasy]);
T('круг колоды: после исчерпания пула событие deck_cycle', !cyc.fail && cyc.evs[16] === 'deck_cycle' && !cyc.evs.slice(0, 16).includes('deck_cycle') && cyc.st.cur['dare.easy'].round === 1);
const tr3 = run(start(), [{ t: 'choose', type: 'truth' }, { t: 'skip' }, { t: 'choose', type: 'truth' }, { t: 'skip' }, { t: 'choose', type: 'truth' }]);
T('3 выбора «правда» подряд одним игроком -> same_type_streak на третьем', tr3.evs[0] === 'chose_truth' && tr3.evs[2] === 'chose_truth' && tr3.evs[4] === 'same_type_streak');
// «Правда» не больше трёх раз подряд: четвёртая отклоняется, «Действие» сбрасывает серию
const truthSkip = [{ t: 'choose', type: 'truth' }, { t: 'skip' }];
const tl = run(start(), [...truthSkip, ...truthSkip, ...truthSkip]);
const tl4 = todApply(tl.st, { t: 'choose', type: 'truth', seq: tl.st.seq }, ctxH);
T('лимит правды: после 3 правд подряд todTruthLocked, 4-я правда отклонена с причиной locked, состояние не меняется', TOD_TRUTH_LIMIT === 3 && todTruthRun(tl.st) === 3 && todTruthLocked(tl.st) && !tl4.ok && tl4.reason === 'locked' && same(tl4.state, tl.st));
const tlDare = run(tl.st, [{ t: 'choose', type: 'dare' }, { t: 'level', diff: 'easy' }, { t: 'skip' }]);
T('после «Действия» серия правды сброшена: todTruthRun 0, правда снова доступна', !tlDare.fail && todTruthRun(tlDare.st) === 0 && !todTruthLocked(tlDare.st) && todApply(tlDare.st, { t: 'choose', type: 'truth', seq: tlDare.st.seq }, ctxH).ok);
const lvlOnly = todApply(run(start(), [{ t: 'choose', type: 'truth' }]).st, { t: 'choose', type: 'truth', seq: 1 }, ctxH);
T('lock считается только в фазе выбора: повторный choose в фазе card отклонён как phase, а не locked', !lvlOnly.ok && lvlOnly.reason === 'phase');
const pass3 = [{ t: 'choose', type: 'truth' }, { t: 'done' }, { t: 'choose', type: 'dare' }, { t: 'level', diff: 'easy' }, { t: 'done' }];
const tp = run(start(), [...pass3, ...pass3, ...pass3]);
T('лимит у каждого игрока свой: у Макса 3 правды подряд -> заперто, у Ани (выбирает действия) нет', !tp.fail && tp.st.turn === 0 && todTruthLocked(tp.st) && todTruthRun(tp.st) === 3 && !todTruthLocked({ ...tp.st, turn: 1 }));
T('todSanitize сохраняет серию: после круглой передачи через строку lock тот же', (() => { const back = todSanitize(JSON.parse(todStStr(tp.st)), deckHard); return !!back && todTruthLocked(back); })());
const ez3 = run(start(), [{ t: 'choose', type: 'dare' }, { t: 'level', diff: 'easy' }, { t: 'skip' }, { t: 'choose', type: 'dare' }, { t: 'level', diff: 'easy' }, { t: 'skip' }, { t: 'choose', type: 'truth' }, { t: 'skip' }, { t: 'choose', type: 'dare' }, { t: 'level', diff: 'easy' }]);
T('3 уровня easy подряд -> easy_only', ez3.evs[9] === 'easy_only' && ez3.st.stat[0].re === 3);

const en = run(r2.state, [{ t: 'end' }]);
T('end: phase ended, событие game_end, дальше любые действия отклонены', en.st.phase === 'ended' && en.evs[0] === 'game_end' && ['choose', 'level', 'done', 'skip', 'end'].every(t => !todApply(en.st, { t, type: 'truth', diff: 'easy', seq: en.st.seq }, ctxH).ok));

const P10 = Array.from({ length: 10 }, (_, i) => ({ id: 'player_' + i, name: 'Игрок с длинным именем ' + i, gender: i % 2 ? 'girl' : 'guy' }));
let big = start({ hard: true, tone: 2 }, P10); for (let i = 0; i < 30; i++) big = run(big, easySkip).st;
T('todStStr для 10 игроков и 30 пропусков < 4000 знаков', big.log.length === 30 && todStStr(big).length < 4000);
const huge = { ...big, log: Array.from({ length: 3000 }, () => [0, 'truth', 'td_xxxxxxxxxxxxx']) };
T('todStStr укорачивает log, если строка длиннее 20000', todStStr(huge).length <= 20000);

const valid = red2.st;
T('todSanitize: валидное состояние проходит без изменений (глубокое равенство)', same(todSanitize(JSON.parse(JSON.stringify(valid)), deckHard), valid) && same(todSanitize(c1, deckHard), c1) && same(todSanitize(s0, deckHard), s0));
const mut = (f) => { const x = JSON.parse(JSON.stringify(c1)); f(x); return todSanitize(x, deckHard); };
const fixedName = mut(x => { x.pl[0].name = 'Я'.repeat(500); });
T('todSanitize: turn=99, i=1e9, pl из 1 игрока, phase "x", строки вместо чисел, имя 500 знаков -> null или исправлено в допустимое',
  mut(x => { x.turn = 99; }) === null && mut(x => { x.cur.truth.i = 1e9; }) === null && mut(x => { x.pl = x.pl.slice(0, 1); x.stat = x.stat.slice(0, 1); }) === null
  && mut(x => { x.phase = 'x'; }) === null && mut(x => { x.seq = '1'; }) === null && mut(x => { x.stat[0].d[0] = '3'; }) === null && mut(x => { x.ev.k = 'hack'; }) === null
  && fixedName && fixedName.pl[0].name.length === 25 && mut(x => { x.pl[0].name = '<b>{name}</b>'; }).pl[0].name === 'b{name}/b');
T('todSanitize: phase card без карточки и карточка не из пулов -> null', mut(x => { x.card = null; }) === null && mut(x => { x.card.pool = 'other'; }) === null);
const cyc1 = {}; cyc1.self = cyc1;
T('todSanitize не падает на null, числах, массивах, циклах JSON', [null, undefined, 5, 'str', [], [1, 2], cyc1, { v: 1, pl: cyc1 }].every(x => todSanitize(x, deckHard) === null));

finish();
