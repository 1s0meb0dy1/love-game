// История партий сессии: компактные записи о завершённых играх (когда играли, кто участвовал, чем закончилось).
// Чистый модуль без React и без app.jsx; все верхнеуровневые имена начинаются с hist/Hist/HIST_ (в тестах модуль подставляется в общий код app.jsx).
// Запись хранится в профиле сессии (profile.history, новые первыми, не больше HIST_MAX) и уходит в зашифрованную облачную копию вместе с профилем.
//   { id, t (время завершения, мс), m: 'normal' | 'hard', n (вопросов в колоде), r (дошли до вопроса №), a (пройдено вопросов), s (пропущено целиком),
//     e / md / h (пройдено лёгких / средних / глубоких), all (прошли всю колоду), cont (игру потом продолжили), tc: [[тема, число]] (до трёх),
//     pl: [{ id, name, gender, a (ответил), s (пропустил) }], res? (снимок партии для «Продолжить»: только у последней незавершённой записи) }

export const HIST_MAX = 20;
const histNum = (x, max = 9999) => Math.max(0, Math.min(max, Math.floor(Number(x) || 0)));
const histStr = (s, n) => String(s === null || s === undefined ? '' : s).slice(0, n);

// запись из хранилища или облака -> чистая запись или null. cleanRes — чистка снимка партии (её задаёт приложение: те же правила, что у savedGame)
export const histCleanItem = (g, cleanRes) => {
  if (!g || typeof g !== 'object' || Array.isArray(g)) return null;
  const id = histStr(g.id, 24); const t = Number(g.t);
  if (!id || !Number.isFinite(t) || t <= 0) return null;
  const pl = (Array.isArray(g.pl) ? g.pl : []).slice(0, 10).filter(p => p && typeof p === 'object')
    .map(p => ({ id: histStr(p.id, 40), name: histStr(p.name, 25), gender: p.gender === 'girl' ? 'girl' : 'guy', a: histNum(p.a), s: histNum(p.s) }));
  const tc = (Array.isArray(g.tc) ? g.tc : []).slice(0, 3).filter(x => Array.isArray(x) && typeof x[0] === 'string').map(x => [histStr(x[0], 30), histNum(x[1])]);
  const item = { id, t, m: g.m === 'hard' ? 'hard' : 'normal', n: histNum(g.n), r: histNum(g.r), a: histNum(g.a), s: histNum(g.s), e: histNum(g.e), md: histNum(g.md), h: histNum(g.h), all: g.all === true, cont: g.cont === true, tc, pl };
  const res = g.res && typeof cleanRes === 'function' ? cleanRes(g.res) : null;
  if (res && !item.all && !item.cont) item.res = res;
  return item;
};

// список -> чистый список: новые первыми, без повторов id, не больше HIST_MAX
export const histClean = (list, cleanRes) => {
  const seen = new Set(); const out = [];
  (Array.isArray(list) ? list : []).forEach(g => { const c = histCleanItem(g, cleanRes); if (c && !seen.has(c.id)) { seen.add(c.id); out.push(c); } });
  return out.sort((a, b) => b.t - a.t).slice(0, HIST_MAX);
};

// слияние локальной и облачной истории (две копии сессии на разных устройствах): объединение по id; «продолжена» и снимок «Продолжить» не конфликтуют — у продолженной снимка нет
export const histMerge = (a, b, cleanRes) => {
  const byId = new Map();
  [...histClean(a, cleanRes), ...histClean(b, cleanRes)].forEach(g => {
    const prev = byId.get(g.id);
    if (!prev) { byId.set(g.id, g); return; }
    const cont = prev.cont || g.cont; const base = { ...(prev.t >= g.t ? prev : g), cont };
    if (cont) delete base.res; else if (!base.res) { const r = prev.res || g.res; if (r) base.res = r; }
    byId.set(g.id, base);
  });
  // снимок «Продолжить» оставляем только у самой свежей записи
  const out = [...byId.values()].sort((x, y) => y.t - x.t).slice(0, HIST_MAX);
  return out.map((g, i) => { if (i === 0 || !g.res) return g; const { res, ...rest } = g; return rest; });
};

// новая запись первой; у прежних снимок «Продолжить» убирается (продолжить можно только последнюю игру)
export const histAdd = (list, rec) => {
  const rest = (Array.isArray(list) ? list : []).filter(g => g && g.id !== rec.id).map(g => { if (!g.res) return g; const { res, ...r } = g; return r; });
  return [rec, ...rest].slice(0, HIST_MAX);
};

// игру продолжили из записи: снимок убирается, запись помечается «продолжена»
export const histMarkContinued = (list, id) => (Array.isArray(list) ? list : []).map(g => { if (g.id !== id) return g; const { res, ...r } = g; return { ...r, cont: true }; });

// итог партии для записи. entries — разобранные ходы по вопросам колоды ({ cur, answered, skippedBy, skippedAll }), questions — вопросы колоды ({ level, categoryId }),
// reached — до какого вопроса дошли (номер, с единицы), res — снимок партии для «Продолжить». Без пройденных и пропущенных вопросов записи нет (null)
export const histBuild = ({ now, players, questions, entries, hard, reached, allCleared, res }) => {
  const qs = Array.isArray(questions) ? questions : []; const en = Array.isArray(entries) ? entries : [];
  const pl = (Array.isArray(players) ? players : []).map(p => ({ id: histStr(p.id, 40), name: histStr(p.name, 25), gender: p.gender === 'girl' ? 'girl' : 'guy', a: 0, s: 0 }));
  const limit = Math.min(qs.length, Math.max(1, Number(reached) || 1));
  let a = 0, s = 0, e = 0, md = 0, h = 0; const cats = {};
  for (let i = 0; i < limit; i++) {
    const t = en[i]; if (!t || t.cur) continue; // ход не закончен — не считаем
    const answered = Array.isArray(t.answered) ? t.answered : []; const skippedBy = Array.isArray(t.skippedBy) ? t.skippedBy : [];
    pl.forEach(p => { if (answered.includes(p.id)) p.a += 1; else if (t.skippedAll || skippedBy.includes(p.id)) p.s += 1; });
    const allSkipped = !!t.skippedAll || (pl.length > 0 && pl.every(p => skippedBy.includes(p.id)));
    if (allSkipped) { s += 1; continue; }
    if (!answered.length) continue;
    a += 1; const q = qs[i] || {};
    if (q.level === 'Простые') e += 1; else if (q.level === 'Средние') md += 1; else if (q.level === 'Глубокие') h += 1;
    if (q.categoryId) cats[q.categoryId] = (cats[q.categoryId] || 0) + 1;
  }
  if (a + s === 0) return null;
  const tc = Object.entries(cats).sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1)).slice(0, 3);
  const rec = { id: 'g' + Math.floor(Number(now)).toString(36), t: Number(now), m: hard ? 'hard' : 'normal', n: qs.length, r: limit, a, s, e, md, h, all: !!allCleared, cont: false, tc, pl };
  if (!rec.all && res) rec.res = res;
  return rec;
};

// заголовок-отличие партии (то же правило, что на экране «Игра завершена»): ключ русской фразы; перевод делает экран
export const histBadge = (g) => {
  if (!g) return '';
  if (g.all) return '🏆 Прошли всю колоду';
  if (g.s === 0 && g.a >= 5) return '💪 Без пропусков';
  if (g.h >= Math.max(3, g.a * 0.5)) return '🌊 Любители глубины';
  if (g.s > g.a) return '🛡️ Осторожные';
  if (g.a >= 15) return '🔥 Разговорчивые';
  return '✨ Хорошее начало';
};

// сводка по всей истории для шапки списка
export const histTotals = (list) => {
  const l = Array.isArray(list) ? list : [];
  const cats = {}; l.forEach(g => (g.tc || []).forEach(([id, n]) => { cats[id] = (cats[id] || 0) + n; }));
  const top = Object.entries(cats).sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))[0];
  return { games: l.length, answered: l.reduce((n, g) => n + g.a, 0), skipped: l.reduce((n, g) => n + g.s, 0), topCat: top ? top[0] : '' };
};
