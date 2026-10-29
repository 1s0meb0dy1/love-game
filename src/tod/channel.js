// Режим «Правда или действие»: канал синхронизации партии — узел live/<комната>_t (раздел 6.3 спеки).
// Узел: { ver, by, t, status: 'active'|'ended', ids: колода (строка JSON), st: состояние (строка JSON), p: { <устройство>: время } }.
// Колоду читаем только при входе и возврате, состояние — на каждой новой ver; испорченные строки становятся null, исключений наружу нет.
// Модуль ничего не знает об app.jsx: адрес базы, запрос (с токеном входа), id устройства, часы, версии и присутствие приходят в deps.
import { todDeckStr, todParseDeck } from './deck.js';
import { todSanitize, todStStr } from './engine.js';

export const todRoomOf = (roomId) => String(roomId || '') + '_t';

export const todChannel = (deps) => {
  const { baseUrl, fetch: req, deviceId, now, verNext, verStart, alive } = deps;
  const url = (room, sub = '') => `${baseUrl}/live/${todRoomOf(room)}${sub}.json`;
  const json = async (r) => { if (!r || !r.ok) throw new Error('HTTP ' + (r ? r.status : 0)); return r.json(); };
  const get = async (room, sub) => json(await req(url(room, sub), {}, 10000));
  const write = async (room, method, body, sub = '') => { const r = await req(url(room, sub), { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }, 10000); return !!(r && r.ok); };
  const parseSt = (s, deck) => { if (typeof s !== 'string' || s.length > 20000) return null; try { return todSanitize(JSON.parse(s), deck); } catch (e) { return null; } };
  return {
    // новая партия: весь узел перезаписывается (прошлая партия, если была, пропадает)
    start: async (room, { deck, state }) => {
      const ids = todDeckStr(deck); const st = todStStr(state); const t = now();
      const ver = verStart(deviceId, t);
      const ok = await write(room, 'PUT', { ver, by: deviceId, t, status: 'active', ids, st, p: { [deviceId]: t } });
      if (!ok) throw new Error('TOD_START');
      return { ver };
    },
    readVer: async (room) => { try { const v = await get(room, '/ver'); return typeof v === 'number' && isFinite(v) ? v : null; } catch (e) { return null; } },
    // deck: true — прочитать и колоду (при входе, возврате); иначе только состояние — оно проверяется по известной колоде (knownDeck)
    read: async (room, opts = {}) => {
      let node;
      if (opts.deck) node = await get(room, '');
      else { const [ver, status, st, p] = await Promise.all(['/ver', '/status', '/st', '/p'].map(s => get(room, s).catch(() => null))); node = ver === null && st === null ? null : { ver, status, st, p }; }
      if (!node || typeof node !== 'object') return null;
      const deck = opts.deck ? todParseDeck(node.ids) : null;
      const state = parseSt(node.st, deck || opts.knownDeck || null);
      return { ver: typeof node.ver === 'number' ? node.ver : null, status: node.status === 'ended' ? 'ended' : node.status === 'active' ? 'active' : '', deck, state, p: node.p && typeof node.p === 'object' ? node.p : {} };
    },
    send: async (room, state, prevVer) => { const ver = verNext(prevVer, deviceId); const ok = await write(room, 'PATCH', { ver, by: deviceId, t: now(), st: todStStr(state) }); return { ok, ver }; },
    end: async (room, state, prevVer) => { const ver = verNext(prevVer, deviceId); const ok = await write(room, 'PATCH', { ver, by: deviceId, t: now(), st: todStStr(state), status: 'ended' }); return { ok, ver }; },
    beat: (room) => write(room, 'PATCH', { [deviceId]: now() }, '/p'),
    leave: (room) => write(room, 'DELETE', undefined, '/p/' + encodeURIComponent(deviceId)),
    peek: async (room) => {
      try {
        const [status, p] = await Promise.all([get(room, '/status'), get(room, '/p')]);
        const a = alive(p, now(), deviceId);
        return { status: status === 'active' || status === 'ended' ? status : '', others: a.others.length, alive: a.alive.length, p: p && typeof p === 'object' ? p : {} };
      } catch (e) { return { status: '', others: 0, alive: 0, p: {} }; }
    },
  };
};
