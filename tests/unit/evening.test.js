// «Вечір»: розминка без важких тем, глави без повторів, поріг згоди перед глибокою главою
const fs = require('fs'); const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../src/ui/evening.js'), 'utf8').replace(/^export /gm, '');
const M = new Function(src + '; return { EVENING_MOODS, pickWarmup, buildEvening, softenTail, chapterAt, rescueDeck, limitsSave, limitsLoad, applyLimits };')();
const db = Object.values(JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/questions.json'), 'utf8')));
let pass = 0, fail = 0; const T = (n, ok) => { if (ok) pass++; else { fail++; console.log('FAIL ' + n); } };
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
const key = q => q.id;
for (const mood of ['easy', 'close', 'deep']) for (const audience of ['couple', 'group']) {
  for (let r = 0; r < 20; r++) {
    const ev = M.buildEvening(db, mood, { audience, rnd });
    const ids = ev.deck.map(key);
    T(`${mood}/${audience}: без повторів`, new Set(ids).size === ids.length);
    T(`${mood}/${audience}: перша глава — розминка з легких`, ev.chapters[0].key === 'warm' && ev.deck.slice(0, ev.chapters[0].to + 1).every(q => q.level === 'Простые' && q.categoryId !== 'intimacy' && q.categoryId !== 'values'));
    T(`${mood}/${audience}: розминка без важких слів`, ev.deck.slice(0, ev.chapters[0].to + 1).every(q => !/секс|наркот|измен|войн|2022|проститу|дет[еяи]/i.test(q.text)));
    T(`${mood}/${audience}: інтим лише в глибокій главі пари`, ev.deck.every((q, i) => q.categoryId !== 'intimacy' || (audience === 'couple' && i >= ev.gate && ev.gate > 0)));
    const deepIdx = ev.deck.findIndex(q => q.level === 'Глубокие');
    T(`${mood}/${audience}: глибокі питання лише після порогу`, deepIdx < 0 || (ev.gate > 0 && deepIdx >= ev.gate));
    T(`${mood}/${audience}: глави покривають колоду`, ev.chapters.length && ev.chapters[ev.chapters.length - 1].to === ev.deck.length - 1);
    if (ev.gate > 0) { const soft = M.softenTail(db, ev.deck, ev.gate, { rnd, audience }); T(`${mood}/${audience}: «лишимось тут» прибирає глибокі`, soft.slice(ev.gate).every(q => q.level === 'Средние') && soft.slice(0, ev.gate).every((q, i) => q === ev.deck[i])); }
  }
}
const ev = M.buildEvening(db, 'close', { rnd });
T('chapterAt: індекс і кількість глав', M.chapterAt(ev.chapters, 0).index === 0 && M.chapterAt(ev.chapters, ev.deck.length - 1).index === ev.chapters.length - 1);
T('easy без порогу', M.buildEvening(db, 'easy', { rnd }).gate === -1);

// «Врятувати вечір»: легкі картки, без повторів, глави й поріг зсуваються, колода не губиться
for (let r = 0; r < 30; r++) {
  const e = M.buildEvening(db, 'close', { rnd }); const cur = Math.min(e.deck.length - 2, 2 + (r % 12)); const replace = r % 2 === 0;
  const res = M.rescueDeck(db, e.deck, cur, { rnd, chapters: e.chapters, gate: e.gate, replace });
  if (!res) { T('rescue: є легкі картки', false); continue; }
  const ids = res.deck.map(key); const start = replace ? cur : cur + 1;
  T('rescue: без повторів', new Set(ids).size === ids.length);
  T('rescue: вставлені картки легкі', res.deck.slice(start, start + res.added).every(q => q.level === 'Простые'));
  T('rescue: довжина колоди', res.deck.length === e.deck.length + res.added - (replace ? 1 : 0));
  T('rescue: хвіст колоди не змінився', ids.slice(start + res.added).join() === e.deck.slice(cur + 1).map(key).join());
  T('rescue: поточна картка ' + (replace ? 'замінена' : 'лишилась'), replace ? ids[cur] !== key(e.deck[cur]) : ids[cur] === key(e.deck[cur]));
  T('rescue: глави покривають колоду', res.chapters[res.chapters.length - 1].to === res.deck.length - 1 && res.chapters.every((c, i) => i === 0 || c.from === res.chapters[i - 1].to + 1));
  T('rescue: поріг указує на ту саму картку', e.gate < 0 || e.gate <= cur || key(res.deck[res.gate]) === key(e.deck[e.gate]));
}
T('rescue: порожній пул → null', M.rescueDeck([], ev.deck, 1) === null);
// «Тихі межі»: зберігається лише об'єднання тем, з терміном дії; фільтр прибирає теми
const store = {}; globalThis.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
M.limitsSave(['money', 'fears', 'money'], 1000);
T('limits: об\'єднання без повторів і без імен', JSON.stringify(M.limitsLoad(2000)) === '["fears","money"]' && !/player|name/.test(store.askme_limits_v1));
T('limits: зникають через 12 годин', M.limitsLoad(1000 + 12 * 3600 * 1000 + 1).length === 0);
T('limits: фільтр пулу', M.applyLimits(db, ['money']).every(q => q.categoryId !== 'money') && M.applyLimits(db, []).length === db.length);
M.limitsSave([], 3000); T('limits: порожній вибір очищає', !('askme_limits_v1' in store));
const lim = M.buildEvening(M.applyLimits(db, ['family', 'future']), 'easy', { rnd });
T('limits: вечір без обраних тем', lim.deck.length > 0 && lim.deck.every(q => q.categoryId !== 'family' && q.categoryId !== 'future'));
console.log(`PASS evening: ${pass} перевірок без помилок`); if (fail) process.exit(1);
