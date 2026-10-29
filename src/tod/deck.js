// Режим «Правда или действие»: колода без повторов. Колода — это seed и списки id по пулам; порядок карточек в каждом круге
// все устройства считают одинаково (перемешивание от seed), поэтому по сети передаётся только колода и курсоры, а не порядок.
// Чистый модуль: без React; верхнеуровневые имена с префиксом tod/TOD_.
import { todPoolOf } from './model.js';

export const TOD_POOLS = ['truth', 'dare.easy', 'dare.medium', 'dare.hard'];
export const TOD_POOL_CAP = 120; // больше карточек в одном пуле колода не берёт (4 пула × 120 — строка колоды укладывается в 12000 знаков)
const TOD_DECK_MAX = 12000; const TOD_SEED_MAX = 40; const TOD_DECK_ID_MAX = 16;

// хеш строки FNV-1a (32 бита, без знака): одинаков на всех устройствах
export const todHash = (str) => {
  let h = 2166136261; const s = String(str);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

// генератор mulberry32: числа 0..1 из 32-битного зерна
const todRng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

// перемешивание Фишера–Йейтса от seed-строки; входной массив не меняется
export const todShuffle = (arr, seed) => {
  const out = Array.isArray(arr) ? arr.slice() : []; const rnd = todRng(todHash(seed));
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = out[i]; out[i] = out[j]; out[j] = t; }
  return out;
};

const todById = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// активные карточки -> колода { seed, pools }. Без hard:true жёсткие карточки не берутся ни в «Правду», ни в «Действие».
// id в пуле отсортированы (колода не зависит от порядка входа); пул больше TOD_POOL_CAP — детерминированная выборка по seed
export const todBuildDeck = (cards, opts) => {
  const hard = !!(opts && opts.hard); const seed = String((opts && opts.seed) || '').slice(0, TOD_SEED_MAX);
  const pools = {}; TOD_POOLS.forEach(p => { pools[p] = []; });
  (Array.isArray(cards) ? cards : []).forEach(c => {
    if (!c || typeof c !== 'object' || c.isActive !== true || typeof c.id !== 'string' || !c.id || c.id.length > TOD_DECK_ID_MAX) return;
    if (c.difficulty === 'hard' && !hard) return;
    const pool = todPoolOf(c); if (pool && !pools[pool].includes(c.id)) pools[pool].push(c.id);
  });
  TOD_POOLS.forEach(p => { pools[p].sort(todById); if (pools[p].length > TOD_POOL_CAP) pools[p] = todShuffle(pools[p], seed + ':cap:' + p).slice(0, TOD_POOL_CAP).sort(todById); });
  return { seed, pools };
};

// колода -> строка для канала; длиннее TOD_DECK_MAX — ошибка (такую колоду не отправляем)
export const todDeckStr = (deck) => {
  const s = JSON.stringify(deck);
  if (typeof s !== 'string' || s.length > TOD_DECK_MAX) throw new Error('deck too large');
  return s;
};

// строка из канала -> колода или null: проверяются типы, известные пулы, длины; недостающие пулы — пустые
export const todParseDeck = (str) => {
  if (typeof str !== 'string' || str.length > TOD_DECK_MAX) return null;
  let raw; try { raw = JSON.parse(str); } catch (e) { return null; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (typeof raw.seed !== 'string' || raw.seed.length > TOD_SEED_MAX) return null;
  const src = raw.pools; if (!src || typeof src !== 'object' || Array.isArray(src)) return null;
  if (Object.keys(src).some(k => !TOD_POOLS.includes(k))) return null;
  const pools = {};
  for (const p of TOD_POOLS) {
    const list = src[p] === undefined ? [] : src[p];
    if (!Array.isArray(list) || list.length > TOD_POOL_CAP || !list.every(id => typeof id === 'string' && id.length >= 1 && id.length <= TOD_DECK_ID_MAX)) return null;
    pools[p] = list.slice();
  }
  return { seed: raw.seed, pools };
};

// следующая карточка пула: cur = { [pool]: { round, i } } -> { id, cur', cycled } или null (пустой пул, неизвестный пул, нет колоды).
// В круге round карточки идут в порядке todShuffle(pool, seed:pool:round); конец круга — следующий круг с начала (cycled:true). cur не меняется
export const todNext = (deck, cur, pool) => {
  if (!deck || typeof deck !== 'object' || !deck.pools || !TOD_POOLS.includes(pool)) return null;
  const ids = deck.pools[pool]; if (!Array.isArray(ids) || !ids.length) return null;
  const pos = cur && typeof cur === 'object' && cur[pool] && typeof cur[pool] === 'object' ? cur[pool] : {};
  let round = Number.isInteger(pos.round) && pos.round >= 0 ? pos.round : 0;
  let i = Number.isInteger(pos.i) && pos.i >= 0 ? pos.i : 0;
  let cycled = false;
  if (i >= ids.length) { round += 1; i = 0; cycled = true; }
  const id = todShuffle(ids, deck.seed + ':' + pool + ':' + round)[i];
  return { id, cur: { ...(cur && typeof cur === 'object' ? cur : {}), [pool]: { round, i: i + 1 } }, cycled };
};
