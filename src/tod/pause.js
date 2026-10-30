// Режим «Правда или действие»: партия на паузе. Снимок (колода и состояние) лежит в localStorage этого устройства: игрок вышел в меню, не завершая игру,
// а «Продолжить игру» на главной возвращает его в ту же партию. В базу и в облако снимок не уходит. Чистый модуль: без React и без app.jsx.
import { todDeckStr, todParseDeck } from './deck.js';
import { todSanitize } from './engine.js';

export const TOD_PAUSE_KEY = 'askme_tod_pause_v1';
export const TOD_PAUSE_TTL = 30 * 24 * 3600 * 1000; // пауза старше месяца считается забытой

// снимок из хранилища -> { sid, t, deck, state } или null (нет записи, чужая сессия, испорчено, устарело, партия уже закончена)
export const todPauseRead = (storage, sid, now = Date.now()) => {
  try {
    const raw = JSON.parse(storage.getItem(TOD_PAUSE_KEY) || 'null');
    if (!raw || typeof raw !== 'object' || raw.v !== 1) return null;
    if (typeof raw.sid !== 'string' || (sid !== undefined && raw.sid !== sid)) return null;
    const t = Number(raw.t); if (!Number.isFinite(t) || t <= 0 || now - t > TOD_PAUSE_TTL) return null;
    const deck = todParseDeck(typeof raw.deck === 'string' ? raw.deck : '');
    const state = deck ? todSanitize(raw.state, deck) : null;
    if (!deck || !state || state.phase === 'ended') return null;
    return { sid: raw.sid, t, deck, state };
  } catch (e) { return null; }
};

// записать снимок; true — записано
export const todPauseWrite = (storage, { sid, t, deck, state }) => {
  try {
    if (!state || state.phase === 'ended' || typeof sid !== 'string') return false;
    storage.setItem(TOD_PAUSE_KEY, JSON.stringify({ v: 1, sid, t: Number(t) || Date.now(), deck: todDeckStr(deck), state }));
    return true;
  } catch (e) { return false; }
};

export const todPauseClear = (storage) => { try { storage.removeItem(TOD_PAUSE_KEY); } catch (e) {} };
