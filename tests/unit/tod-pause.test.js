// Режим «Правда или действие»: партия на паузе (src/tod/pause.js) — запись снимка в хранилище устройства, чтение с проверками, очистка.
const { loadTod } = require('../tod-load.js');
const res = []; const T = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
const finish = () => { console.log(res.join('\n')); console.log('--- captured runtime errors: 0'); process.exit(res.some(l => l.startsWith('FAIL')) ? 1 : 0); };
const NAMES = ['todBuildDeck', 'todStart', 'todApply', 'TOD_PAUSE_KEY', 'TOD_PAUSE_TTL', 'todPauseRead', 'todPauseWrite', 'todPauseClear'];
let M = null;
try { M = loadTod(['tod/model.js', 'tod/deck.js', 'tod/engine.js', 'tod/pause.js'], NAMES); } catch (e) { T('модуль src/tod/pause.js загружается: ' + (e && e.message), false); finish(); }
const { todBuildDeck, todStart, todApply, TOD_PAUSE_KEY, TOD_PAUSE_TTL, todPauseRead, todPauseWrite, todPauseClear } = M;

const cards = []; ['truth', 'dare'].forEach(type => ['easy', 'medium', 'hard'].forEach(d => { for (let i = 0; i < 5; i++) cards.push({ id: `td_${type[0]}${d[0]}${i}`, type, difficulty: d, text: 'x', isActive: true }); }));
const level = (id) => { const c = cards.find(x => x.id === id); return c ? c.difficulty : null; };
const deck = todBuildDeck(cards, { hard: true, seed: 'p1' });
const P2 = [{ id: 'p1', name: 'Макс', gender: 'guy' }, { id: 'p2', name: 'Аня', gender: 'girl' }];
const s0 = todStart({ players: P2, opts: { hard: true, tone: 1 }, gid: 'g1' });
const s1 = todApply(s0, { t: 'choose', type: 'truth', seq: 0 }, { deck, level }).state; // на карточке «Правда»
const mem = () => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, m }; };

const st = mem();
T('ключ хранилища и срок давности', TOD_PAUSE_KEY === 'askme_tod_pause_v1' && TOD_PAUSE_TTL === 30 * 24 * 3600 * 1000);
T('пустое хранилище -> null', todPauseRead(st, 'SID1') === null);
T('запись паузы: true, ключ создан', todPauseWrite(st, { sid: 'SID1', t: 1000, deck, state: s1 }) === true && typeof st.m[TOD_PAUSE_KEY] === 'string');
const back = todPauseRead(st, 'SID1', 2000);
T('чтение: те же колода и состояние (карточка, фаза, игроки, seq), метка времени', !!back && JSON.stringify(back.deck) === JSON.stringify(deck) && back.state.phase === 'card' && back.state.card.id === s1.card.id && back.state.seq === s1.seq && back.state.pl.length === 2 && back.t === 1000 && back.sid === 'SID1');
T('чужая сессия -> null, без сессии в запросе — читается любая', todPauseRead(st, 'OTHER', 2000) === null && !!todPauseRead(st, undefined, 2000));
T('старше месяца -> null', todPauseRead(st, 'SID1', 1000 + TOD_PAUSE_TTL + 1) === null && !!todPauseRead(st, 'SID1', 1000 + TOD_PAUSE_TTL - 1));
T('законченная партия не ставится на паузу', todPauseWrite(mem(), { sid: 'SID1', t: 1, deck, state: { ...s1, phase: 'ended' } }) === false);
T('без сессии или состояния записи нет', todPauseWrite(mem(), { sid: 5, t: 1, deck, state: s1 }) === false && todPauseWrite(mem(), { sid: 'S', t: 1, deck, state: null }) === false);
const bad = mem(); bad.setItem(TOD_PAUSE_KEY, '{oops');
T('испорченная строка -> null без исключения', todPauseRead(bad, 'SID1') === null);
const bad2 = mem(); bad2.setItem(TOD_PAUSE_KEY, JSON.stringify({ v: 1, sid: 'SID1', t: 5, deck: todPauseWrite && JSON.stringify(deck), state: { v: 1, gid: 'x' } }));
T('состояние, не прошедшее проверку движка -> null', todPauseRead(bad2, 'SID1', 10) === null);
const bad3 = mem(); bad3.setItem(TOD_PAUSE_KEY, JSON.stringify({ v: 2, sid: 'SID1', t: 5, deck: JSON.stringify(deck), state: s1 }));
T('чужая версия формата -> null', todPauseRead(bad3, 'SID1', 10) === null);
T('хранилище без методов или выбрасывающее ошибку не роняет модуль', todPauseRead(null, 'S') === null && todPauseWrite(null, { sid: 'S', t: 1, deck, state: s1 }) === false && (todPauseClear(null), true) && todPauseWrite({ setItem() { throw new Error('quota'); } }, { sid: 'S', t: 1, deck, state: s1 }) === false);
todPauseClear(st);
T('очистка удаляет запись', todPauseRead(st, 'SID1', 2000) === null && !(TOD_PAUSE_KEY in st.m));
finish();
