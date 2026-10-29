// «База» Firebase в памяти для проверок живой игры. Понимает пути /live/<комната>/…, методы GET/PUT/PATCH/DELETE,
// удаление через null и проверяет записи теми же правилами, что стоят в правилах Firebase для узла live (копия: fixtures/live-rules.json)
// (иначе тест мог бы пройти там, где настоящая база запись отклонит).
// Режим «Правда или действие»: ещё понимает /tod.json и /tod/<id>.json (GET/PUT/DELETE) и проверяет записи по fixtures/tod-rules.json через rules-eval.js.
// Кто пишет, определяется токеном в ?auth=: равный opts.ownerToken — владелец (uid = OWNER_UID), любой другой — обычный пользователь, без токена — не вошёл.
const fs = require('fs'); const path = require('path'); const { makeRules } = require('./rules-eval.js');

const RULES_FILE = path.join(__dirname, 'fixtures', 'live-rules.json'); // узел live из правил Firebase
const todRules = makeRules(JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'tod-rules.json'), 'utf8'))); // узел tod из правил Firebase
const OWNER_UID = 'OWNER_UID'; // так в копии правил обозначен владелец (боевой идентификатор в репозиторий не кладём)
// пределы берём из настоящего файла правил, чтобы тест не разошёлся с ним
const limits = (() => {
  try {
    const live = JSON.parse(fs.readFileSync(RULES_FILE, 'utf8')).live.$room;
    const n = (expr) => Number((String(expr).match(/length\s*(?:\(\))?\s*<=\s*(\d+)/) || [])[1]) || Infinity;
    return { ids: n(live.ids['.validate']), hist: n(live.hist['.validate']) };
  } catch (e) { return { ids: 12000, hist: 30000 }; }
})();

module.exports = function makeFakeRtdb(opts = {}) {
  const root = {}; const log = []; const stats = { reads: 0, writes: 0, denied: 0, gets: {}, patches: 0 };
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  const getAt = (p) => p.reduce((n, k) => (n !== null && typeof n === 'object' ? n[k] : undefined), root);
  const prune = (p) => { for (let i = p.length; i > 0; i--) { const parent = getAt(p.slice(0, i - 1)), k = p[i - 1]; const v = parent && parent[k]; if (v !== undefined && v !== null && typeof v === 'object' && Object.keys(v).length === 0) delete parent[k]; else break; } };
  const setAt = (p, val) => {
    if (val === null || val === undefined) { const parent = getAt(p.slice(0, -1)); if (parent && typeof parent === 'object') delete parent[p[p.length - 1]]; prune(p.slice(0, -1).concat([p[p.length - 1]])); return; }
    let n = root; for (let i = 0; i < p.length - 1; i++) { if (n[p[i]] === null || typeof n[p[i]] !== 'object') n[p[i]] = {}; n = n[p[i]]; } n[p[p.length - 1]] = clone(val);
  };
  if (opts.tod) Object.entries(opts.tod).forEach(([id, c]) => setAt(['tod', id], c)); // карточки узла tod с самого начала (как seedTod)
  const patchAt = (p, obj) => { Object.entries(obj).forEach(([k, v]) => setAt(p.concat(String(k).split('/').filter(Boolean)), v)); };
  // правила узла live/$room (копия правил Firebase: fixtures/live-rules.json)
  const check = (room) => {
    const d = getAt(['live', room]); if (d === undefined) return null;
    if (typeof d !== 'object' || !['ver', 'by', 't'].every(k => d[k] !== undefined && d[k] !== null)) return 'нет обязательных полей ver/by/t';
    if (typeof d.ver !== 'number') return 'ver не число';
    if (d.ids !== undefined && !(typeof d.ids === 'string' && d.ids.length <= limits.ids)) return 'ids слишком длинное';
    if (d.hist !== undefined && !(typeof d.hist === 'string' && d.hist.length <= limits.hist)) return 'hist слишком длинная';
    if (d.status !== undefined && d.status !== 'active' && d.status !== 'ended') return 'status не active/ended';
    return null;
  };
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  // колода партии лежит отдельным узлом рядом с комнатой: live/<комната>_d (см. protocol v3 в app.jsx);
  // канал режима «Правда или действие» — live/<комната>_t: тоже вспомогательный, «основной» комнатой не считается
  const isDeck = (k) => /_d$/.test(k);
  const isTodRoom = (k) => /_t$/.test(k);
  const mainRooms = () => Object.keys(root.live || {}).filter(k => !isDeck(k) && !isTodRoom(k));
  // узел tod: /tod.json и /tod/<id>.json; возвращает null, если адрес не про tod
  const handleTod = async (url, init) => {
    let u; try { u = new URL(String(url)); } catch (e) { return null; }
    const m = u.pathname.match(/^\/tod((?:\/[^/]+)*)\.json$/); if (!m) return null;
    const segs = m[1].split('/').map(decodeURIComponent).filter(Boolean); const method = ((init && init.method) || 'GET').toUpperCase();
    const reply = (status, o) => ({ ok: status >= 200 && status < 300, status, json: async () => o, text: async () => JSON.stringify(o) });
    if (segs.length > 1 || !/^(GET|PUT|DELETE)$/.test(method)) return reply(400, { error: 'fake-rtdb: для tod поддержаны GET/PUT/DELETE на /tod и /tod/<id>' }); // не принимаем молча то, чего не проверяем
    const p = ['tod'].concat(segs);
    if (method === 'GET') { stats.reads++; const key = segs.length ? 'tod/' + segs[0] : 'tod'; stats.gets[key] = (stats.gets[key] || 0) + 1; const v = getAt(p); return reply(200, v === undefined ? null : clone(v)); }
    const token = u.searchParams.get('auth'); const auth = token ? { uid: opts.ownerToken && token === opts.ownerToken ? OWNER_UID : 'user:' + token } : null;
    const body = method === 'DELETE' ? null : (init && init.body ? JSON.parse(init.body) : null);
    stats.writes++;
    const err = todRules.check(method, p, auth, body);
    if (err) { stats.denied++; log.push({ denied: err, method, path: p.join('/'), body }); return reply(401, { error: 'Permission denied' }); }
    setAt(p, body); log.push({ method, path: p.join('/'), body });
    return reply(200, clone(body));
  };
  const handle = async (url, init) => {
    const tod = await handleTod(url, init); if (tod) return tod;
    const m = String(url).match(/\/live\/([^?]*?)\.json/); if (!m) return null;
    const segs = m[1].split('/').map(decodeURIComponent).filter(Boolean); const method = ((init && init.method) || 'GET').toUpperCase();
    const body = init && init.body ? JSON.parse(init.body) : undefined; const ok = (o) => ({ ok: true, status: 200, json: async () => o, text: async () => JSON.stringify(o) });
    const delay = opts.latency ? opts.latency(method, segs) : 0; if (delay) await sleep(delay);
    const p = ['live'].concat(segs); const room = segs[0];
    if (method === 'GET') { stats.reads++; const key = isDeck(room) ? '(колода)' : isTodRoom(room) ? '(игра tod)' : (segs.slice(1).join('/') || '(комната)'); stats.gets[key] = (stats.gets[key] || 0) + 1; const v = getAt(p); return ok(v === undefined ? null : clone(v)); }
    stats.writes++; const before = clone(getAt(['live', room]));
    if (method === 'PUT') setAt(p, body); else if (method === 'PATCH') { stats.patches++; patchAt(p, body); } else if (method === 'DELETE') setAt(p, null);
    const err = check(room);
    if (err) { // как настоящая база: запись отклонена, данные не изменились
      stats.denied++; log.push({ denied: err, method, path: segs.join('/'), body });
      if (before === undefined) delete root.live[room]; else root.live[room] = before; if (root.live && Object.keys(root.live).length === 0) delete root.live;
      return { ok: false, status: 401, json: async () => ({ error: 'Permission denied' }), text: async () => 'Permission denied' };
    }
    log.push({ method, path: segs.join('/'), body }); return ok(method === 'DELETE' ? null : clone(body));
  };
  return {
    handle, stats, log, limits,
    rooms: () => clone((root.live) || {}),
    room: () => { const k = mainRooms()[0]; return k ? clone(root.live[k]) : null; },
    roomId: () => mainRooms()[0] || null,
    // колода текущей комнаты: { ver, by, t, g, d } или null
    deck: () => { const k = mainRooms()[0]; return k && root.live[k + '_d'] ? clone(root.live[k + '_d']) : null; },
    // канал режима «Правда или действие» (live/<комната>_t): { ver, by, t, status, p, ids, st } или null
    todRoom: () => { const k = Object.keys(root.live || {}).find(isTodRoom); return k ? clone(root.live[k]) : null; },
    todRoomKey: () => Object.keys(root.live || {}).find(isTodRoom) || null,
    // карточки узла tod: { <id>: карточка } (копия); seedTod кладёт карточки по id в обход правил, остальные не трогает
    tod: () => clone(root.tod || {}),
    seedTod: (map) => { Object.entries(map).forEach(([id, c]) => setAt(['tod', id], c)); },
    // прямая правка комнаты в обход приложения (например, подложить «чужие» устройства)
    seed: (room, sub, val) => { setAt(['live', room].concat(sub), val); },
    attach: (E) => { const base = E.w.fetch; E.w.fetch = async (url, init) => { const r = await handle(url, init); return r || base(url, init); }; },
  };
};
