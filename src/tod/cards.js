// Режим «Правда или действие»: карточки в базе — загрузка с запасными вариантами, локальный кэш, запись одной карточки, разовая загрузка стартового набора.
// Модуль не знает ни про React, ни про app.jsx: всё нужное приходит в объекте env (так его одинаково проверяют тесты и использует приложение):
//   env = { baseUrl, fetch(url, opts, ms), storage, starter }
//   baseUrl — адрес базы без слеша на конце; fetch — функция как fetchWithTimeout в app.jsx (сама добавляет токен входа);
//   storage — объект как localStorage (или null); starter — стартовый набор TOD_STARTER (запасной вариант и источник для разовой загрузки).
// Ошибок игроку здесь не показывается: загрузка при любом сбое молча откатывается на кэш, а затем на стартовый набор.
import { todCleanCard, todCleanList } from './model.js';

export const TOD_CACHE_KEY = 'askme_tod_cards_v1';
const TOD_FETCH_MS = 10000; // ожидание ответа базы на одну операцию

// кэш на устройстве -> список чистых карточек; пустое, битое или недоступное хранилище -> []
export const todReadCache = (storage) => {
  try { return todCleanList(JSON.parse(storage.getItem(TOD_CACHE_KEY) || 'null')); } catch (e) { return []; }
};

// список -> кэш (в кэш идут только чистые карточки); ошибка хранилища (переполнено, приватный режим) молча игнорируется
export const todWriteCache = (storage, list) => {
  try { storage.setItem(TOD_CACHE_KEY, JSON.stringify(todCleanList(list))); } catch (e) {}
};

// украинский текст из стартового набора для карточек, у которых его нет (в базу набор загрузили раньше, чем в нём появился text_uk).
// Берётся, только если id совпадает и русский текст не менялся владельцем: переписанная карточка без перевода остаётся на русском.
export const todFillUk = (list, starter) => {
  const src = new Map(todCleanList(starter).filter(c => c.text_uk).map(c => [c.id, c]));
  return (Array.isArray(list) ? list : []).map(c => {
    const s = !c.text_uk && src.get(c.id);
    return s && s.text === c.text ? todCleanCard({ ...c, text_uk: s.text_uk }) : c;
  });
};

// загрузка карточек: база -> кэш -> стартовый набор. Результат { list, source: 'db' | 'cache' | 'starter' }, исключений не бывает.
// Из базы берётся всё, что в ней лежит (и скрытые карточки: они нужны админке); при непустом результате он же пишется в кэш.
// Пустая база, ошибка сети, отказ и мусор вместо данных считаются одинаково: кэш, а если его нет — стартовый набор (в кэш он не пишется).
export const todLoadCards = async (env) => {
  try {
    const res = await env.fetch(`${env.baseUrl}/tod.json?t=${Date.now()}`, {}, TOD_FETCH_MS);
    if (res && res.ok) {
      const list = todFillUk(todCleanList(await res.json()), env.starter);
      if (list.length) { todWriteCache(env.storage, list); return { list, source: 'db' }; }
    }
  } catch (e) {}
  const cached = todFillUk(todReadCache(env.storage), env.starter);
  if (cached.length) return { list: cached, source: 'cache' };
  return { list: todCleanList(env.starter), source: 'starter' };
};

// запись одной карточки (новой или изменённой): PUT /tod/<id>.json. В базу уходит очищенная карточка с updatedAt = сейчас.
// Неверная карточка -> ошибка до запроса; ответ !ok -> Error('HTTP <код>'), сетевой сбой пробрасывается как есть. Возвращает записанную карточку.
export const todSaveCard = async (env, card) => {
  const clean = todCleanCard({ ...card, updatedAt: Date.now() });
  if (!clean) throw new Error('Некорректная карточка');
  const res = await env.fetch(`${env.baseUrl}/tod/${encodeURIComponent(clean.id)}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(clean) }, TOD_FETCH_MS);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return clean;
};

// разовая загрузка стартового набора в базу: карточки с id из existingIds пропускаются, остальные пишутся по одной (каждая проверяется правилами отдельно).
// Результат { added, skipped }. При сбое запись останавливается, а в ошибке поле added говорит, сколько карточек успело записаться
// (повторный запуск с обновлёнными existingIds дозапишет остальные).
export const todSeedStarter = async (env, existingIds) => {
  const have = new Set(Array.isArray(existingIds) ? existingIds : []);
  let added = 0, skipped = 0;
  for (const card of todCleanList(env.starter)) {
    if (have.has(card.id)) { skipped++; continue; }
    try { await todSaveCard(env, card); } catch (e) {
      const err = e && typeof e === 'object' ? e : new Error(String(e));
      err.added = added; throw err;
    }
    added++;
  }
  return { added, skipped };
};

// только включённые карточки (скрытые владельцем — isActive: false — в игру и в архив игрока не идут)
export const todActive = (list) => (Array.isArray(list) ? list : []).filter(c => c && c.isActive === true);
