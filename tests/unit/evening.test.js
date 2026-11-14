// «Вечір»: розминка без важких тем, глави без повторів, поріг згоди перед глибокою главою
const fs = require('fs'); const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../../src/ui/evening.js'), 'utf8').replace(/^export /gm, '');
const M = new Function(src + '; return { EVENING_MOODS, pickWarmup, buildEvening, softenTail, chapterAt };')();
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
console.log(`PASS evening: ${pass} перевірок без помилок`); if (fail) process.exit(1);
