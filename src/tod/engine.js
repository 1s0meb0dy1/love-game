// Режим «Правда или действие»: движок игры. Всё состояние партии — один объект st (раздел 8 спеки), его меняет только todApply.
// Функции чистые (входное состояние не меняется), поэтому одно и то же действие на любом устройстве даёт одно и то же состояние.
// Код события (st.ev) выбирается здесь, а текст подколки — в talk.js: реплики по сети не передаются.
import { TOD_POOLS, todNext } from './deck.js';

const TOD_ST_MAX = 20000; const TOD_LOG_MAX = 30; const TOD_NAME_MAX = 25; const TOD_NUM_MAX = 9999;
const TOD_PHASES = ['choose', 'level', 'card', 'ended'];
const todEvKeys = ['turn_start', 'chose_truth', 'chose_dare', 'level_easy', 'level_medium', 'level_hard', 'done', 'done_hard', 'skip_1', 'skip_2', 'skip_3', 'skip_hard', 'redeem', 'same_type_streak', 'easy_only', 'deck_cycle', 'game_end'];
const todLv = ['easy', 'medium', 'hard'];

// нулевая статистика игрока: d/s — выполнено/пропущено по TOD_POOLS, dh/sh — жёстких, c — выборы [правда, действие], l — выборы уровня,
// ms — максимум пропусков подряд, rd — выполнено после 2+ пропусков, rt — серия одинаковых выборов [тип|-1, n], re — серия «Легко» подряд
const todZeroStat = () => ({ d: [0, 0, 0, 0], s: [0, 0, 0, 0], dh: 0, sh: 0, c: [0, 0], l: [0, 0, 0], ms: 0, rd: 0, rt: [-1, 0], re: 0 });
const todCleanName = (s) => String(s).replace(/[<>\u0000-\u001F\u007F]/g, '').trim().slice(0, TOD_NAME_MAX).replace(/[\uD800-\uDBFF]$/, '');

export const todStart = ({ players, opts, gid }) => {
  const pl = (Array.isArray(players) ? players : []).slice(0, 10).map(p => ({ id: String((p && p.id) || ''), name: todCleanName((p && p.name) || ''), gender: p && p.gender === 'girl' ? 'girl' : 'guy' }));
  return {
    v: 1, gid: String(gid || ''), phase: 'choose', turn: 0, pl, type: '', diff: '', card: null, streak: 0, seq: 0,
    ev: { k: 'turn_start', seq: 0, p: 0 }, cur: {},
    opts: { hard: !!(opts && opts.hard), tone: opts && [0, 1, 2].includes(opts.tone) ? opts.tone : 1 },
    stat: pl.map(todZeroStat), log: [],
  };
};

const todClone = (st) => JSON.parse(JSON.stringify(st));
const todNo = (state, reason) => ({ ok: false, state, reason });

// действие -> { ok, state, reason? }. action: { t: 'choose'|'level'|'done'|'skip'|'end', type?, diff?, seq }; ctx = { deck, level(id) }
export const todApply = (state, action, ctx) => {
  if (!state || typeof state !== 'object' || !action || typeof action !== 'object') return todNo(state, 'bad');
  if (action.seq !== state.seq) return todNo(state, 'seq');
  if (state.phase === 'ended') return todNo(state, 'phase');
  const deck = ctx && ctx.deck; const levelOf = ctx && typeof ctx.level === 'function' ? ctx.level : () => null;
  const st = todClone(state); const me = st.stat[st.turn]; const n = st.pl.length;
  let ev = null;
  if (action.t === 'choose') {
    if (st.phase !== 'choose' || !['truth', 'dare'].includes(action.type)) return todNo(state, 'phase');
    const ti = action.type === 'truth' ? 0 : 1;
    let cycled = false;
    if (ti === 0) {
      const r = todNext(deck, st.cur, 'truth'); if (!r) return todNo(state, 'empty');
      const lv = levelOf(r.id); st.cur = r.cur; cycled = r.cycled;
      st.card = { pool: 'truth', id: r.id, lv: todLv.includes(lv) ? lv : 'easy' }; st.phase = 'card';
    } else {
      if (!['dare.easy', 'dare.medium', 'dare.hard'].some(p => todNext(deck, st.cur, p))) return todNo(state, 'empty');
      st.phase = 'level';
    }
    st.type = action.type; me.c[ti] += 1;
    me.rt = me.rt[0] === ti ? [ti, me.rt[1] + 1] : [ti, 1];
    ev = cycled ? 'deck_cycle' : me.rt[1] === 3 ? 'same_type_streak' : ti === 0 ? 'chose_truth' : 'chose_dare';
  } else if (action.t === 'level') {
    const li = todLv.indexOf(action.diff);
    if (st.phase !== 'level' || li < 0) return todNo(state, 'phase');
    const pool = 'dare.' + action.diff; const r = todNext(deck, st.cur, pool); if (!r) return todNo(state, 'empty');
    st.cur = r.cur; st.diff = action.diff; st.card = { pool, id: r.id, lv: action.diff }; st.phase = 'card';
    me.l[li] += 1; me.re = li === 0 ? me.re + 1 : 0;
    ev = r.cycled ? 'deck_cycle' : me.re === 3 ? 'easy_only' : 'level_' + action.diff;
  } else if (action.t === 'done' || action.t === 'skip') {
    if (st.phase !== 'card' || !st.card) return todNo(state, 'phase');
    const pi = TOD_POOLS.indexOf(st.card.pool); const hard = st.card.lv === 'hard';
    if (action.t === 'done') {
      me.d[pi] += 1; if (hard) me.dh += 1; if (st.streak >= 2) me.rd += 1;
      ev = st.streak >= 1 ? 'redeem' : hard ? 'done_hard' : 'done';
      st.ev = { k: ev, seq: st.seq + 1, p: st.turn };
      st.turn = (st.turn + 1) % n; st.streak = 0;
    } else {
      st.streak += 1; me.s[pi] += 1; if (hard) me.sh += 1; me.ms = Math.max(me.ms, st.streak);
      st.log.push([st.turn, st.card.pool, st.card.id]); if (st.log.length > TOD_LOG_MAX) st.log = st.log.slice(-TOD_LOG_MAX);
      ev = hard ? 'skip_hard' : 'skip_' + Math.min(st.streak, 3);
    }
    st.phase = 'choose'; st.type = ''; st.diff = ''; st.card = null;
  } else if (action.t === 'end') {
    st.phase = 'ended'; ev = 'game_end';
  } else return todNo(state, 'bad');
  st.seq += 1;
  if (!(action.t === 'done')) st.ev = { k: ev, seq: st.seq, p: st.turn };
  return { ok: true, state: st };
};

// --- проверка состояния из канала: чужие или испорченные данные -> исправленное состояние или null ---
const todInt = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
const todIsObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const todIntArr = (a, len) => Array.isArray(a) && a.length === len && a.every(x => todInt(x, 0, TOD_NUM_MAX));

const todCleanStat = (s) => {
  if (!todIsObj(s) || !todIntArr(s.d, 4) || !todIntArr(s.s, 4) || !todIntArr(s.c, 2) || !todIntArr(s.l, 3)) return null;
  if (![s.dh, s.sh, s.ms, s.rd, s.re].every(x => todInt(x, 0, TOD_NUM_MAX))) return null;
  if (!Array.isArray(s.rt) || s.rt.length !== 2 || !todInt(s.rt[0], -1, 1) || !todInt(s.rt[1], 0, TOD_NUM_MAX)) return null;
  return { d: s.d.slice(), s: s.s.slice(), dh: s.dh, sh: s.sh, c: s.c.slice(), l: s.l.slice(), ms: s.ms, rd: s.rd, rt: s.rt.slice(), re: s.re };
};

export const todSanitize = (raw, deck) => {
  try {
    if (!todIsObj(raw) || raw.v !== 1 || typeof raw.gid !== 'string' || raw.gid.length > 40) return null;
    if (!Array.isArray(raw.pl) || raw.pl.length < 2 || raw.pl.length > 10) return null;
    const pl = []; for (const p of raw.pl) { if (!todIsObj(p) || typeof p.id !== 'string' || p.id.length > 40 || typeof p.name !== 'string') return null; pl.push({ id: p.id, name: todCleanName(p.name), gender: p.gender === 'girl' ? 'girl' : 'guy' }); }
    const n = pl.length;
    if (!TOD_PHASES.includes(raw.phase) || !todInt(raw.turn, 0, n - 1)) return null;
    if (!['', 'truth', 'dare'].includes(raw.type) || !['', ...todLv].includes(raw.diff)) return null;
    let card = null;
    if (raw.card !== null) {
      const c = raw.card; if (!todIsObj(c) || !TOD_POOLS.includes(c.pool) || typeof c.id !== 'string' || c.id.length < 1 || c.id.length > 16 || !todLv.includes(c.lv)) return null;
      card = { pool: c.pool, id: c.id, lv: c.lv };
    }
    if ((raw.phase === 'card') !== !!card) return null;
    if (!todInt(raw.streak, 0, TOD_NUM_MAX) || !todInt(raw.seq, 0, 1e9)) return null;
    const e = raw.ev; if (!todIsObj(e) || !todEvKeys.includes(e.k) || !todInt(e.seq, 0, 1e9) || !todInt(e.p, 0, n - 1)) return null;
    if (!todIsObj(raw.cur)) return null;
    const cur = {};
    for (const [pool, pos] of Object.entries(raw.cur)) {
      if (!TOD_POOLS.includes(pool) || !todIsObj(pos)) return null;
      const len = deck && deck.pools && Array.isArray(deck.pools[pool]) ? deck.pools[pool].length : 120;
      if (!todInt(pos.round, 0, TOD_NUM_MAX) || !todInt(pos.i, 0, len)) return null;
      cur[pool] = { round: pos.round, i: pos.i };
    }
    const o = raw.opts; if (!todIsObj(o) || typeof o.hard !== 'boolean' || ![0, 1, 2].includes(o.tone)) return null;
    if (!Array.isArray(raw.stat) || raw.stat.length !== n) return null;
    const stat = raw.stat.map(todCleanStat); if (stat.some(s => !s)) return null;
    if (!Array.isArray(raw.log)) return null;
    const log = raw.log.slice(-TOD_LOG_MAX).filter(x => Array.isArray(x) && x.length === 3 && todInt(x[0], 0, n - 1) && TOD_POOLS.includes(x[1]) && typeof x[2] === 'string' && x[2].length <= 16).map(x => x.slice());
    return { v: 1, gid: raw.gid, phase: raw.phase, turn: raw.turn, pl, type: raw.type, diff: raw.diff, card, streak: raw.streak, seq: raw.seq,
      ev: { k: e.k, seq: e.seq, p: e.p }, cur, opts: { hard: o.hard, tone: o.tone }, stat, log };
  } catch (err) { return null; }
};

// состояние -> строка для канала: длиннее 20000 — укорачиваем log с начала; всё равно длиннее — ошибка
export const todStStr = (state) => {
  let st = state; let s = JSON.stringify(st);
  while (s.length > TOD_ST_MAX && st.log && st.log.length) { st = { ...st, log: st.log.slice(1) }; s = JSON.stringify(st); }
  if (s.length > TOD_ST_MAX) throw new Error('state too large');
  return s;
};
