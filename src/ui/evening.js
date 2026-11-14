// «Вечір»: сценарій із трьох глав за настроєм компанії (стратегія 2026: перша картка < 60 с,
// перші картки короткі й легкі, глибока глава — лише після спільної згоди).
// Модуль чистий: отримує вже відфільтрований пул питань і функцію побудови колоди з app.jsx.

// «Ценности» сюди не входять: там навіть «легкі» питання бувають про політику, релігію, секс-роботу
const WARM_CATS = ['fun', 'future', 'life', 'past', 'family'];
// Розминка не має зачіпати болючі теми, навіть якщо в базі питання позначене «Простые»
const WARM_BLOCK = /секс|интим|постел|оргазм|голы|наркот|измен|бывш|смерт|умер|умр|войн|деньг|зарплат|долг|брос|развод|ревн|алкогол|пьян|насили|аборт|болезн|похорон|кредит|проститу|религ|бог|политик|оружи|тюрьм|преступ|полици|рас[аы]|национальн|ориентац|гей|лгбт|вес[аеу]? |похуд|диет|травм|депресс|самоуб|обид|разозл|дет[еяи]|ребен|2022|феврал|две мамы|два папы|тяжел|трудно|принять|стыд|сожале|жалеешь|ненавид|боишь|страх|ошибк/i;
const WARM_MAX_LEN = 90;

export const EVENING_MOODS = {
    easy: {
        icon: '😄',
        chapters: [
            { key: 'warm', n: 5 },
            { key: 'talk', n: 14, cats: ['fun', 'future', 'life', 'past', 'family', 'values', 'money', 'body'], levels: ['Простые', 'Средние'] },
            { key: 'close', n: 8, cats: ['romance', 'trust', 'talk', 'fears', 'values', 'future'], levels: ['Средние'] }
        ]
    },
    close: {
        icon: '🫶',
        chapters: [
            { key: 'warm', n: 5 },
            { key: 'talk', n: 12, cats: ['romance', 'trust', 'talk', 'future', 'values', 'past', 'body', 'family'], levels: ['Простые', 'Средние'] },
            { key: 'deep', n: 10, cats: ['romance', 'trust', 'talk', 'fears', 'secrets', 'values', 'intimacy'], levels: ['Глубокие'], gate: true }
        ]
    },
    deep: {
        icon: '🌙',
        chapters: [
            { key: 'warm', n: 4 },
            { key: 'talk', n: 8, cats: ['values', 'fears', 'trust', 'talk', 'past', 'secrets', 'family'], levels: ['Средние'] },
            { key: 'deep', n: 14, cats: ['values', 'fears', 'trust', 'talk', 'past', 'secrets', 'romance', 'intimacy', 'money'], levels: ['Глубокие'], gate: true }
        ]
    }
};
export const EVENING_MOOD_IDS = ['easy', 'close', 'deep'];

const shuffle = (arr, rnd) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const keyOf = (q) => String(q.id || q.dbKey);
const textOf = (q) => String(q.text || '') + ' ' + String(q.text_uk || '');

// Розминка: короткі легкі питання з «безпечних» тем, без слів зі стоп-списку
export function pickWarmup(pool, n, rnd = Math.random, used = new Set()) {
    const ok = (q) => !used.has(keyOf(q)) && q.level === 'Простые' && WARM_CATS.includes(q.categoryId) && String(q.text || '').length <= WARM_MAX_LEN && !WARM_BLOCK.test(textOf(q));
    let picked = shuffle(pool.filter(ok), rnd).sort((a, b) => String(a.text || '').length - String(b.text || '').length).slice(0, n * 3);
    picked = shuffle(picked, rnd);
    // дві картки поспіль з однієї теми — нудно: розводимо
    const out = [];
    while (picked.length && out.length < n) {
        const last = out[out.length - 1];
        const i = picked.findIndex(q => !last || q.categoryId !== last.categoryId);
        out.push(picked.splice(i < 0 ? 0 : i, 1)[0]);
    }
    return out;
}

// Будує колоду вечора. audience: 'couple' | 'group' (у компанії глава без «Интима»).
// Повертає { deck, chapters: [{ key, from, to }], gate } — gate: індекс першої картки глави,
// перед якою треба спитати згоди (або -1).
export function buildEvening(pool, moodId, { audience = 'couple', rnd = Math.random, buildDeck } = {}) {
    const mood = EVENING_MOODS[moodId] || EVENING_MOODS.easy;
    const used = new Set(), deck = [], chapters = []; let gate = -1;
    mood.chapters.forEach(ch => {
        let part;
        if (ch.key === 'warm') part = pickWarmup(pool, ch.n, rnd, used);
        else {
            const cats = ch.cats.filter(c => audience !== 'group' || c !== 'intimacy');
            const sub = pool.filter(q => !used.has(keyOf(q)) && cats.includes(q.categoryId) && ch.levels.includes(q.level));
            part = (buildDeck ? buildDeck(sub, rnd) : shuffle(sub, rnd)).slice(0, ch.n);
        }
        if (!part.length) return;
        part.forEach(q => used.add(keyOf(q)));
        if (ch.gate && gate < 0 && deck.length > 0) gate = deck.length;
        chapters.push({ key: ch.key, from: deck.length, to: deck.length + part.length - 1, gate: !!ch.gate });
        deck.push(...part);
    });
    return { deck, chapters, gate, mood: moodId };
}

// Заміна глибокої глави на спокійнішу, якщо компанія сказала «лишимось тут»
export function softenTail(pool, deck, gate, { rnd = Math.random, buildDeck, audience = 'couple' } = {}) {
    if (gate < 0 || gate >= deck.length) return deck;
    const head = deck.slice(0, gate), used = new Set(head.map(keyOf)), need = deck.length - gate;
    const cats = ['romance', 'trust', 'talk', 'future', 'values', 'past', 'fun', 'life', 'family'].filter(c => audience !== 'group' || c !== 'intimacy');
    const sub = pool.filter(q => !used.has(keyOf(q)) && cats.includes(q.categoryId) && q.level === 'Средние');
    return head.concat((buildDeck ? buildDeck(sub, rnd) : shuffle(sub, rnd)).slice(0, need));
}

export function chapterAt(chapters, idx) {
    if (!chapters || !chapters.length) return null;
    const i = chapters.findIndex(c => idx >= c.from && idx <= c.to);
    return i < 0 ? null : { ...chapters[i], index: i, count: chapters.length };
}

// Мета вечора живе лише на пристрої: прив'язана до колоди за першими id
export const EVENING_KEY = 'askme_evening_v1';
export const eveningDeckKey = (deck) => deck.slice(0, 6).map(keyOf).join(',') + '#' + deck.length;
export function eveningSave(meta) { try { if (meta) localStorage.setItem(EVENING_KEY, JSON.stringify(meta)); else localStorage.removeItem(EVENING_KEY); } catch (e) { /* приватний режим */ } }
export function eveningLoad(deck) {
    try { const m = JSON.parse(localStorage.getItem(EVENING_KEY) || 'null'); return m && deck && m.deckKey === eveningDeckKey(deck) ? m : null; } catch (e) { return null; }
}

// «Врятувати вечір»: три легкі картки замість важкої. Якщо поточну картку ще ніхто не відповів (replace),
// вона виходить із колоди, інакше легкі картки стають одразу після неї. Глави й поріг згоди зсуваються.
export function rescueDeck(pool, deck, cur, { n = 3, rnd = Math.random, chapters = [], gate = -1, replace = false } = {}) {
    if (cur < 0 || cur >= deck.length) return null;
    const used = new Set(deck.map(keyOf));
    const warm = pickWarmup(pool, n, rnd, used);
    if (!warm.length) return null;
    const delta = replace ? warm.length - 1 : warm.length;
    const out = [...deck.slice(0, replace ? cur : cur + 1), ...warm, ...deck.slice(cur + 1)];
    const ch = chapters.map(c => ({ ...c, from: c.from > cur ? c.from + delta : c.from, to: c.to >= cur ? c.to + delta : c.to }));
    return { deck: out, chapters: ch, gate: gate > cur ? gate + delta : gate, added: warm.length };
}

// «Тихі межі»: теми, яких сьогодні не торкаємось. Зберігається лише об'єднання, без того, хто що обрав,
// і лише на пристрої; через 12 годин межі зникають самі (новий вечір — нові межі).
export const LIMITS_KEY = 'askme_limits_v1';
const LIMITS_TTL = 12 * 3600 * 1000;
export function limitsSave(cats, now = Date.now()) {
    try { const list = [...new Set(cats || [])].sort(); if (list.length) localStorage.setItem(LIMITS_KEY, JSON.stringify({ cats: list, at: now })); else localStorage.removeItem(LIMITS_KEY); } catch (e) { /* приватний режим */ }
}
export function limitsLoad(now = Date.now()) {
    try { const m = JSON.parse(localStorage.getItem(LIMITS_KEY) || 'null'); return m && Array.isArray(m.cats) && now - (m.at || 0) < LIMITS_TTL ? m.cats : []; } catch (e) { return []; }
}
export const applyLimits = (pool, cats) => (cats && cats.length ? pool.filter(q => !cats.includes(q.categoryId)) : pool);
