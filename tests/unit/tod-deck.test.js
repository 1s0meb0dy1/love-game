// Режим «Правда или действие»: колода без повторов (src/tod/deck.js).
// Проверяет детерминированное перемешивание, сборку пулов, выдачу по кругу, ограничения размера и разбор колоды из строки.
const { loadTod } = require('../tod-load.js');
const res = []; const T = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
const finish = () => { console.log(res.join('\n')); console.log('--- captured runtime errors: 0'); process.exit(res.some(l => l.startsWith('FAIL')) ? 1 : 0); };
const NAMES = ['TOD_POOLS', 'TOD_POOL_CAP', 'todHash', 'todShuffle', 'todBuildDeck', 'todDeckStr', 'todParseDeck', 'todNext'];
let M = null;
try { M = loadTod(['tod/model.js', 'tod/deck.js'], NAMES); } catch (e) { T('модуль src/tod/deck.js загружается: ' + (e && e.message), false); finish(); }
const { TOD_POOLS, TOD_POOL_CAP, todHash, todShuffle, todBuildDeck, todDeckStr, todParseDeck, todNext } = M;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// набор карточек: n штук на каждый тип и уровень
const make = (n, o = {}) => { const out = []; ['truth', 'dare'].forEach(type => ['easy', 'medium', 'hard'].forEach(d => { for (let i = 0; i < n; i++) out.push({ id: `td_${type[0]}${d[0]}${i}`, type, difficulty: d, text: 'Карточка ' + i, isActive: true, ...o }); })); return out; };
// выдать k карточек из пула подряд
const draw = (deck, pool, k) => { let cur = {}; const out = []; for (let i = 0; i < k; i++) { const r = todNext(deck, cur, pool); out.push(r); if (!r) break; cur = r.cur; } return out; };

T('TOD_POOLS по порядку', same(TOD_POOLS, ['truth', 'dare.easy', 'dare.medium', 'dare.hard']));
T('TOD_POOL_CAP = 120', TOD_POOL_CAP === 120);
T('todHash: FNV-1a, uint32, одинаков для одной строки', todHash('') === 2166136261 && todHash('a') === 0xe40c292c && todHash('abc') === todHash('abc') && todHash('x') >= 0);

const fifty = Array.from({ length: 50 }, (_, i) => 'id' + i);
const a1 = todShuffle(fifty, 's1'); const a2 = todShuffle(fifty, 's1'); const b = todShuffle(fifty, 's2');
T('порядок одинаков при одном seed и различается при другом (пул из 50)', same(a1, a2) && !same(a1, b) && same([...a1].sort(), [...fifty].sort()));

const deck = todBuildDeck(make(5), { hard: true, seed: 'seed-1' });
const five = draw(deck, 'dare.easy', 6);
T('круг: N выдач из пула N дают N разных id, N+1-я — cycled:true и round 1',
  new Set(five.slice(0, 5).map(r => r.id)).size === 5 && five.slice(0, 5).every(r => !r.cycled) && five[5].cycled === true && five[5].cur['dare.easy'].round === 1);
T('колода одинакова при одном seed', same(deck, todBuildDeck(make(5), { hard: true, seed: 'seed-1' })) && deck.seed === 'seed-1');

const soft = todBuildDeck(make(5), { hard: false, seed: 's' });
T('при hard:false жёстких нет в truth и dare.hard', soft.pools['dare.hard'].length === 0 && soft.pools.truth.length === 10 && !soft.pools.truth.some(id => id.startsWith('td_th')));
T('при hard:true жёсткие «правды» попадают в truth', deck.pools.truth.length === 15 && deck.pools.truth.some(id => id.startsWith('td_th')));
const mixed = make(2).map((c, i) => (i % 2 ? { ...c, isActive: false } : c));
const md = todBuildDeck(mixed, { hard: true, seed: 's' });
T('isActive:false в колоду не попадают', Object.values(md.pools).every(p => p.every(id => mixed.find(c => c.id === id).isActive)) && Object.values(md.pools).reduce((n, p) => n + p.length, 0) === 6);
T('неверные карточки пропускаются', todBuildDeck([null, 5, { id: 'x' }, ...make(1)], { hard: true, seed: 's' }).pools.truth.length === 3);

const big = []; ['truth', 'dare'].forEach(type => ['easy', 'medium', 'hard'].forEach(d => { for (let i = 0; i < 84; i++) big.push({ id: ('td_' + type[0] + d[0] + i).padEnd(16, 'z'), type, difficulty: d, text: 'x', isActive: true }); }));
const bd = todBuildDeck(big, { hard: true, seed: 'big' }); const bs = todDeckStr(bd);
T('500 карточек: каждый пул <= 120, todDeckStr < 12000 при id по 16 знаков', big.length >= 500 && TOD_POOLS.every(p => bd.pools[p].length <= 120) && bd.pools.truth.length === 120 && bs.length < 12000);
T('выборка из большого пула детерминирована по seed', same(bd, todBuildDeck(big, { hard: true, seed: 'big' })) && !same(bd.pools.truth, todBuildDeck(big, { hard: true, seed: 'other' }).pools.truth));
let threw = false; try { todDeckStr({ seed: 's', pools: { truth: Array.from({ length: 1000 }, (_, i) => 'td_' + i.toString().padStart(13, '0')) } }); } catch (e) { threw = /deck too large/.test(e.message); }
T('todDeckStr бросает «deck too large» при длине больше 12000', threw);
T('todParseDeck(todDeckStr(deck)) — та же колода', same(todParseDeck(todDeckStr(deck)), deck) && same(todParseDeck(bs), bd));

const one = todBuildDeck([{ id: 'td_one', type: 'dare', difficulty: 'hard', text: 'x', isActive: true }], { hard: true, seed: 's' });
const ones = draw(one, 'dare.hard', 5);
T('пул из одной карточки: 5 выдач подряд не падают, каждая cycled', ones.length === 5 && ones.every(r => r && r.id === 'td_one') && ones.slice(1).every(r => r.cycled));
T('пустой пул -> null', todNext(soft, {}, 'dare.hard') === null);
T('неизвестный пул и мусор вместо колоды -> null', todNext(deck, {}, 'nope') === null && todNext(null, {}, 'truth') === null);

const bad = ['', 'null', '{', '[]', '5', JSON.stringify({ seed: 5, pools: {} }), JSON.stringify({ seed: 'x'.repeat(41), pools: {} }), JSON.stringify({ seed: 's', pools: { other: [] } }),
  JSON.stringify({ seed: 's', pools: { truth: ['x'.repeat(17)] } }), JSON.stringify({ seed: 's', pools: { truth: [5] } }), JSON.stringify({ seed: 's', pools: { truth: Array.from({ length: 121 }, (_, i) => 'a' + i) } }), JSON.stringify({ seed: 's', pools: { truth: 'abc' } })];
T('todParseDeck: мусор, чужие пулы, длинные строки -> null', bad.every(s => todParseDeck(s) === null) && todParseDeck(null) === null);
const pd = todParseDeck(JSON.stringify({ seed: 's', pools: { truth: ['a'] } }));
T('todParseDeck: недостающие пулы становятся пустыми', pd && same(pd.pools, { truth: ['a'], 'dare.easy': [], 'dare.medium': [], 'dare.hard': [] }));

const src = make(3); const srcCopy = JSON.stringify(src); const d2 = todBuildDeck(src, { hard: true, seed: 'm' });
const arr = ['a', 'b', 'c']; todShuffle(arr, 'q');
const cur = { truth: { round: 0, i: 1 } }; const curCopy = JSON.stringify(cur); const r = todNext(d2, cur, 'truth');
T('входные массивы и cur не мутируются', JSON.stringify(src) === srcCopy && same(arr, ['a', 'b', 'c']) && JSON.stringify(cur) === curCopy && r.cur.truth.i === 2);
T('todNext: следующая карточка — order(pool, round)[i]', r.id === todShuffle(d2.pools.truth, 'm:truth:0')[1]);
T('todNext: испорченный cur (i за пределами, отрицательный round) не ломает выдачу', !!todNext(d2, { truth: { round: -3, i: 1e9 } }, 'truth') && !!todNext(d2, { truth: 'x' }, 'truth'));

finish();
