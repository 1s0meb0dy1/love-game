// Режим «Правда или действие»: канал синхронизации live/<комната>_t (src/tod/channel.js) поверх базы в памяти с правилами live.
const { loadTod } = require('../tod-load.js'); const makeDb = require('../fake-rtdb.js');
const src = require('../src-loader.js')(); const g = (re) => { const m = src.match(re); if (!m) throw new Error('не найдено: ' + re); return m[0]; };
const L = new Function(g(/const MAX_PLAYERS = [^\n]*\n/) + g(/const LIVE_POLL_MS = [^\n]*\n/) + g(/const liveFrac = [^\n]*\n/) + g(/const liveVerNext = [^\n]*\n/) + g(/const liveVerStart = [^\n]*\n/) + g(/const liveAlive = [\s\S]*?\n        \};\n/) + 'return { liveVerNext, liveVerStart, liveAlive };')();
const res = []; const T = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
const finish = () => { console.log(res.join('\n')); console.log('--- captured runtime errors: 0'); process.exit(res.some(l => l.startsWith('FAIL')) ? 1 : 0); };
let M = null;
try { M = loadTod(['tod/model.js', 'tod/deck.js', 'tod/engine.js', 'tod/channel.js'], ['todBuildDeck', 'todStart', 'todApply', 'todStStr', 'todRoomOf', 'todChannel']); } catch (e) { T('модуль src/tod/channel.js загружается: ' + (e && e.message), false); finish(); }
const { todBuildDeck, todStart, todApply, todRoomOf, todChannel } = M;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  const db = makeDb(); let clock = 1761750000000;
  const req = async (url, opts) => { const r = await db.handle(url, opts); return r || { ok: false, status: 404, json: async () => null }; };
  const mk = (deviceId) => todChannel({ baseUrl: 'https://db.test', fetch: req, deviceId, now: () => clock, verNext: L.liveVerNext, verStart: L.liveVerStart, alive: L.liveAlive });
  const A = mk('devA'), B = mk('devB'); const ROOM = 'l_room1';
  const cards = []; ['truth', 'dare'].forEach(type => ['easy', 'medium', 'hard'].forEach(d => { for (let i = 0; i < 4; i++) cards.push({ id: `td_${type[0]}${d[0]}${i}`, type, difficulty: d, text: 'x', isActive: true }); }));
  const deck = todBuildDeck(cards, { hard: true, seed: 'chan' });
  const st0 = todStart({ players: [{ id: 'p1', name: 'Макс', gender: 'guy' }, { id: 'p2', name: 'Аня', gender: 'girl' }], opts: { hard: true, tone: 1 }, gid: 'g1' });

  T('todRoomOf добавляет _t', todRoomOf('l_abc') === 'l_abc_t');
  const s = await A.start(ROOM, { deck, state: st0 });
  const node = db.todRoom();
  T('start пишет узел <room>_t, правила live не отклонили (stats.denied===0)', db.stats.denied === 0 && node && node.status === 'active' && node.by === 'devA' && typeof node.ids === 'string' && typeof node.st === 'string' && node.p.devA === clock && node.ver === s.ver);
  T('db.room() не возвращает узел _t, db.todRoom() возвращает', db.room() === null && !!db.todRoom());

  const bigCards = []; ['truth', 'dare'].forEach(type => ['easy', 'medium', 'hard'].forEach(d => { for (let i = 0; i < 120; i++) bigCards.push({ id: ('td_' + type[0] + d[0] + i).padEnd(16, 'z'), type, difficulty: d, text: 'x', isActive: true }); }));
  const bigDeck = todBuildDeck(bigCards, { hard: true, seed: 'big' });
  await A.start('l_big', { deck: bigDeck, state: st0 });
  T('колода максимального размера (480 id по 16 знаков) проходит правило ids <= 12000', db.stats.denied === 0 && Object.values(bigDeck.pools).reduce((n, p) => n + p.length, 0) === 480);
  const writes = db.stats.writes; let threw = false;
  try { await A.start('l_huge', { deck: { seed: 's', pools: { truth: Array.from({ length: 1000 }, (_, i) => 'td_' + String(i).padStart(13, '0')) } }, state: st0 }); } catch (e) { threw = true; }
  T('слишком большая колода -> ошибка до отправки, запись не произошла', threw && db.stats.writes === writes);

  const before = db.stats.gets['(игра tod)'] || 0;
  const full = await B.read(ROOM, { deck: true });
  T('read(room,{deck:true}) возвращает разобранные deck и state, p', full && same(full.deck, deck) && same(full.state, st0) && full.status === 'active' && full.p.devA === clock && full.ver === s.ver);
  const idsRead = JSON.stringify(db.log.slice(-0));
  const lite = await B.read(ROOM, { knownDeck: deck });
  T('без deck поле deck пусто, состояние разобрано, узел целиком не запрашивался', lite && lite.deck === null && same(lite.state, st0) && (db.stats.gets['(игра tod)'] || 0) === before + 1 + 4);
  T('readVer возвращает число ver и null для пустой комнаты', (await B.readVer(ROOM)) === s.ver && (await B.readVer('l_empty')) === null);

  const r1 = todApply(st0, { t: 'choose', type: 'truth', seq: 0 }, { deck, level: () => 'easy' }).state;
  clock += 1000; const sa = await A.send(ROOM, r1, s.ver);
  clock += 1000; const sb = await B.send(ROOM, r1, sa.ver);
  T('send увеличивает ver монотонно; у двух устройств версии не совпадают', sa.ok && sb.ok && sa.ver > s.ver && sb.ver > sa.ver && Math.floor(sb.ver) === Math.floor(sa.ver) + 1 && sb.ver !== sa.ver);
  const afterSend = await A.read(ROOM, { knownDeck: deck });
  T('после send другое устройство читает то же состояние', afterSend && same(afterSend.state, r1));

  db.seed(todRoomOf('l_bad'), [], { ver: 5, by: 'x', t: 1, status: 'active', ids: '{not json', st: '[1,2' });
  const bad1 = await A.read('l_bad', { deck: true });
  db.seed(todRoomOf('l_bad2'), [], { ver: 5, by: 'x', t: 1, status: 'weird', ids: JSON.stringify({ seed: 5 }), st: JSON.stringify({ ...st0, turn: 99 }) });
  const bad2 = await A.read('l_bad2', { deck: true });
  db.seed(todRoomOf('l_bad3'), [], { ver: 5, by: 'x', t: 1, status: 'active', ids: 7, st: { a: 1 } });
  const bad3 = await A.read('l_bad3', { deck: true });
  T('испорченные ids/st (не JSON, неверные типы, индексы за пределами) -> read даёт null для испорченной части, не бросает', bad1 && bad1.deck === null && bad1.state === null && bad2.deck === null && bad2.state === null && bad2.status === '' && bad3.deck === null && bad3.state === null);
  T('read пустой комнаты -> null', (await A.read('l_nothing', { deck: true })) === null && (await A.read('l_nothing', {})) === null);

  clock += 500; await B.beat(ROOM);
  const p1 = db.todRoom().p;
  await B.leave(ROOM);
  const p2 = db.todRoom().p;
  T('beat/leave меняют только свою отметку', p1.devB === clock && p1.devA === 1761750000000 && p2.devB === undefined && p2.devA === 1761750000000 && db.stats.denied === 0);
  await B.beat(ROOM);
  db.seed(todRoomOf(ROOM), ['p', 'devOld'], clock - 60000);
  const pk = await A.peek(ROOM);
  T('peek: others считает живые устройства кроме своего, мёртвые (старше 30 с) не считает', pk.status === 'active' && pk.others === 1 && pk.alive === 2);
  T('peek пустой комнаты: статус пустой, others 0, без исключения', same(await A.peek('l_none'), { status: '', others: 0, alive: 0, p: {} }));

  const fin = todApply(r1, { t: 'end', seq: r1.seq }, { deck }).state;
  const e = await A.end(ROOM, fin, sb.ver);
  const after = await B.read(ROOM, { knownDeck: deck });
  T('end ставит status ended', e.ok && db.todRoom().status === 'ended' && after.status === 'ended' && after.state.phase === 'ended');
  T('за всё время правила не отклонили ни одной записи', db.stats.denied === 0);
  finish();
})().catch(e => { T('сценарий без исключений: ' + e.stack, false); finish(); });
