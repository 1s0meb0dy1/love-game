// Режим «Правда или действие»: модель карточки — константы типов и уровней, проверка и очистка карточки, список, пулы, группировка, новый id.
// Чистый модуль: без React и без зависимостей от app.jsx (в тестах и в общей сборке все верхнеуровневые имена с префиксом tod/Tod/TOD_).
// Ограничения те же, что в правилах Firebase для узла tod (копия — tests/fixtures/tod-rules.json; меняете одно — меняйте и другое):
//   id — строка, не длиннее 16 знаков (и годится как ключ Firebase); type — truth | dare; difficulty — easy | medium | hard;
//   text — строка 1–300 знаков (русский текст); text_uk — строка до 300 знаков, необязательно (украинский текст);
//   isActive — boolean; updatedAt — число, необязательно; других полей нет.

export const TOD_TYPES = ['truth', 'dare'];
export const TOD_LEVELS = ['easy', 'medium', 'hard'];
export const TOD_LEVEL_LABEL = { easy: 'Легко', medium: 'Средне', hard: 'Жёстко' };
export const TOD_TEXT_MAX = 300;
export const TOD_ID_MAX = 16;

// ключ Firebase не может содержать . $ # [ ] / и управляющие символы; id карточки равен ключу (правило id === $id), поэтому проверяем так же
const TOD_ID_RE = /^[^.$#[\]\/\u0000-\u001F\u007F]+$/;

// очистка текста карточки (своя, как sanitizeInput в app.jsx): без угловых скобок и управляющих символов (переносы и табуляцию оставляем),
// пробелы по краям обрезаются, длина — не больше TOD_TEXT_MAX; половинка эмодзи (одиночный старший суррогат) на месте обрезки убирается
const todCleanText = (s) => String(s)
  .replace(/[<>]/g, '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  .trim()
  .slice(0, TOD_TEXT_MAX)
  .replace(/[\uD800-\uDBFF]$/, '')
  .trim();

// карточка из базы, кэша или формы -> чистая карточка { id, type, difficulty, text, text_uk?, isActive, updatedAt? } или null.
// Неверное значение любого поля — null (как отказ правил); текст чистится и обрезается; лишние поля отбрасываются; исходный объект не меняется.
export const todCleanCard = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const { id, type, difficulty, isActive, updatedAt } = raw;
  if (typeof id !== 'string' || id.length < 1 || id.length > TOD_ID_MAX || !TOD_ID_RE.test(id)) return null;
  if (!TOD_TYPES.includes(type) || !TOD_LEVELS.includes(difficulty)) return null;
  if (typeof raw.text !== 'string' || typeof isActive !== 'boolean') return null;
  const hasTime = updatedAt !== undefined && updatedAt !== null;
  if (hasTime && !(typeof updatedAt === 'number' && Number.isFinite(updatedAt))) return null;
  const text = todCleanText(raw.text);
  if (!text) return null;
  const card = { id, type, difficulty, text };
  const textUk = typeof raw.text_uk === 'string' ? todCleanText(raw.text_uk) : '';
  if (textUk) card.text_uk = textUk;
  card.isActive = isActive;
  if (hasTime) card.updatedAt = updatedAt;
  return card;
};

// данные узла tod (объект { <id>: карточка }) или массив (кэш, стартовый набор) -> список чистых карточек:
// мусор отброшен, при повторе id остаётся первая, порядок — по id (сравнение по кодам символов, одинаково на всех устройствах)
export const todCleanList = (data) => {
  const items = Array.isArray(data) ? data : (data && typeof data === 'object' ? Object.values(data) : []);
  const seen = new Set(); const out = [];
  items.forEach(raw => { const c = todCleanCard(raw); if (c && !seen.has(c.id)) { seen.add(c.id); out.push(c); } });
  return out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
};

// пул колоды для карточки: вся «Правда» в одном пуле (уровень у неё выбирается случайно), «Действие» — по уровням; неверная карточка -> null
export const todPoolOf = (card) => {
  if (!card || typeof card !== 'object') return null;
  if (card.type === 'truth') return 'truth';
  if (card.type === 'dare' && TOD_LEVELS.includes(card.difficulty)) return 'dare.' + card.difficulty;
  return null;
};

// группировка для архива и админки: { truth: { easy, medium, hard }, dare: { … } }; порядок внутри группы — как во входном списке.
// Скрытые карточки (isActive не true) попадают в группы только при { showHidden: true }; неверные записи пропускаются
export const todGroupCards = (cards, opts) => {
  const showHidden = !!(opts && opts.showHidden);
  const groups = {};
  TOD_TYPES.forEach(t => { groups[t] = {}; TOD_LEVELS.forEach(d => { groups[t][d] = []; }); });
  (Array.isArray(cards) ? cards : []).forEach(c => {
    if (!c || typeof c !== 'object' || !TOD_TYPES.includes(c.type) || !TOD_LEVELS.includes(c.difficulty)) return;
    if (c.isActive !== true && !showHidden) return;
    groups[c.type][c.difficulty].push(c);
  });
  return groups;
};

// новый id карточки: 'td_' + время (8 знаков base36, с нулями слева — новые id сортируются после старых) + 5 случайных знаков base36.
// Всего не длиннее 16 знаков при любых now и rnd (время после 2059 года берётся по последним 8 знакам)
export const todNewId = (now = Date.now(), rnd = Math.random) => {
  const n = Number(now); const ms = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0; // NaN, Infinity и отрицательное -> 0
  const time = ms.toString(36).padStart(8, '0').slice(-8);
  const r = Math.min(Math.max(Number(rnd()) || 0, 0), 1 - 1e-12);
  const tail = Math.floor(r * 60466176).toString(36).padStart(5, '0').slice(-5); // 60466176 = 36^5
  return 'td_' + time + tail;
};

// текст карточки на языке интерфейса: для 'uk' — text_uk, если он есть, иначе русский text
export const todCardText = (card, lang) => (card ? (lang === 'uk' && card.text_uk ? card.text_uk : card.text) : '');
