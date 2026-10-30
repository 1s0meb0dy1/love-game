// Режим «Правда или действие»: свои карточки игроков. Хранятся только на этом устройстве (localStorage), в базу и в облако не уходят,
// поэтому на других устройствах сессии их текст неизвестен (там показывается заглушка). Чистый модуль: без React и без app.jsx.
import { todCleanCard, TOD_ID_MAX } from './model.js';

export const TOD_MINE_KEY = 'askme_tod_mine_v1';
export const TOD_MINE_MAX = 30; // сколько своих карточек можно держать на устройстве
export const TOD_MINE_PREFIX = 'my_'; // по префиксу отличаем свою карточку от карточки из базы (id в базе начинаются с td_)

export const todIsMine = (id) => typeof id === 'string' && id.startsWith(TOD_MINE_PREFIX);

// 'my_' + время (base36, 8 знаков) + 4 знака случайности: не длиннее TOD_ID_MAX (16)
export const todMineNewId = (now = Date.now(), rnd) => {
  const r = typeof rnd === 'function' ? rnd() : (() => { try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; } catch (e) { return (Number(now) % 997) / 997; } })();
  const time = Math.floor(Math.max(Number(now) || 0, 0)).toString(36).padStart(8, '0').slice(-8);
  const tail = Math.floor(Math.min(Math.max(r, 0), 1 - 1e-9) * 1679616).toString(36).padStart(4, '0').slice(-4); // 36^4
  return (TOD_MINE_PREFIX + time + tail).slice(0, TOD_ID_MAX);
};

// список из хранилища -> чистые карточки только со своими id (чужой мусор отбрасывается)
export const todMineRead = (storage) => {
  try {
    const raw = JSON.parse(storage.getItem(TOD_MINE_KEY) || '[]'); if (!Array.isArray(raw)) return [];
    const seen = new Set(); const out = [];
    raw.forEach(x => { const c = todCleanCard(x); if (c && todIsMine(c.id) && !seen.has(c.id) && out.length < TOD_MINE_MAX) { seen.add(c.id); out.push({ ...c, isActive: true }); } });
    return out;
  } catch (e) { return []; }
};

export const todMineWrite = (storage, list) => { try { storage.setItem(TOD_MINE_KEY, JSON.stringify(list)); return true; } catch (e) { return false; } };

// повтор считается без учёта регистра и пробелов
const todMineNorm = (s) => String(s).toLowerCase().replace(/\s+/g, '');

// добавить карточку { type, difficulty, text } -> { ok: true, list, card } или { ok: false, reason: 'empty' | 'dup' | 'full' }
export const todMineAdd = (list, draft, now, rnd) => {
  const cur = Array.isArray(list) ? list : [];
  if (cur.length >= TOD_MINE_MAX) return { ok: false, reason: 'full' };
  const card = todCleanCard({ id: todMineNewId(now, rnd), type: draft && draft.type, difficulty: draft && draft.difficulty, text: draft && draft.text, isActive: true });
  if (!card) return { ok: false, reason: 'empty' };
  if (cur.some(c => c.type === card.type && todMineNorm(c.text) === todMineNorm(card.text))) return { ok: false, reason: 'dup' };
  return { ok: true, card, list: [...cur, card] };
};

export const todMineRemove = (list, id) => (Array.isArray(list) ? list : []).filter(c => c.id !== id);
