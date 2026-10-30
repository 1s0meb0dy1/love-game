// ШІ-підказки в браузері: «Ситуація», «Порада», переклад і нове питання для адмінки.
// Ланцюжок, щоб підказка не ламалась ніколи: власний проксі (AI_PROXY_URL, потоком) → безкоштовний Pollinations →
// відповідь, яку вже показували на цьому пристрої для цього ж питання → локальна заготовка мовою інтерфейсу.
// Імена гравців у ШІ не передаються — лише їхня кількість.
import { buildPrompt, cleanAiRequest } from './prompts.js';

// адреса воркера worker/ai-proxy після `wrangler deploy` (порожньо — проксі ще не розгорнутий, працює запасний шлях)
export const AI_PROXY_URL = 'https://askme-ai.yedvinn.workers.dev';
const AI_PROXY_FIRST_MS = 12000, AI_PROXY_TOTAL_MS = 35000, AI_POLL_MS = 25000;
const aiRecent = new Map(); // ключ запиту -> останні відповіді (до 3), живе до перезавантаження сторінки

const aiTimeout = (ms, outer) => {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), ms);
  const stop = () => ac.abort(); if (outer) { if (outer.aborted) ac.abort(); else outer.addEventListener('abort', stop, { once: true }); }
  return { signal: ac.signal, done: () => { clearTimeout(t); if (outer) outer.removeEventListener('abort', stop); } };
};

// потокове читання відповіді проксі: onChunk отримує весь текст, накопичений на цей момент
const aiReadStream = async (res, onChunk, signal) => {
  if (!res.body || !res.body.getReader) { const t = await res.text(); if (onChunk) onChunk(t); return t; }
  const reader = res.body.getReader(); const dec = new TextDecoder(); let text = '';
  for (;;) { if (signal && signal.aborted) { reader.cancel().catch(() => {}); throw new Error('aborted'); } const r = await reader.read(); if (r.done) break; text += dec.decode(r.value, { stream: true }); if (onChunk) onChunk(text); }
  return text;
};

const aiViaProxy = async (req, onChunk, outer) => {
  if (!AI_PROXY_URL) return '';
  const tm = aiTimeout(AI_PROXY_TOTAL_MS, outer);
  try {
    const first = aiTimeout(AI_PROXY_FIRST_MS, tm.signal);
    const res = await fetch(AI_PROXY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req), signal: first.signal }).finally(first.done);
    if (!res.ok) return '';
    return (await aiReadStream(res, onChunk, tm.signal)).trim();
  } catch (e) { return ''; } finally { tm.done(); }
};

const aiViaPollinations = async (req, outer) => {
  const p = buildPrompt(req); const tm = aiTimeout(AI_POLL_MS, outer);
  try {
    // ліміт безкоштовного рівня — 1 відповідь на 30 с з IP; 402/429 означає «зайнято», одразу йдемо далі
    const res = await fetch('https://text.pollinations.ai/openai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: tm.signal,
      body: JSON.stringify({ model: 'openai', max_tokens: p.maxTokens + 900, seed: Math.floor(Math.random() * 1e7), messages: [{ role: 'system', content: p.system }, { role: 'user', content: p.user }] }) });
    if (!res.ok) return '';
    const data = await res.json(); const c = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    return typeof c === 'string' ? c.trim() : '';
  } catch (e) { return ''; } finally { tm.done(); }
};

const aiKey = (r) => [r.type, r.lang, r.question, r.text, r.to].join('|');
const aiRemember = (r, text) => { const k = aiKey(r); const list = (aiRecent.get(k) || []).filter(x => x !== text); list.unshift(text); aiRecent.set(k, list.slice(0, 3)); };

// локальна заготовка, коли мережа й усі сервіси недоступні: корисна сама по собі, мовою інтерфейсу
export const aiLocalFallback = (r) => {
  const q = r.question; const uk = r.lang !== 'ru';
  if (r.type === 'situation') return uk
    ? `🎬 Моделювання ситуації:\nВечір, ми нікуди не поспішаємо, телефони відкладені. Я ловлю твій погляд, роблю паузу й з цікавістю питаю: «${q}»\n\n👩👨 Як зазвичай відповідають:\n• Хтось відповідає одразу й жартома — так легше почати.\n• Хтось бере паузу й згадує конкретну історію — з неї розмова стає глибшою.\n\n(Підказка без мережі: розкажіть свою історію замість загальної відповіді.)`
    : `🎬 Моделирование ситуации:\nВечер, мы никуда не спешим, телефоны отложены. Я ловлю твой взгляд, делаю паузу и с интересом спрашиваю: «${q}»\n\n👩👨 Как обычно отвечают:\n• Кто-то отвечает сразу и в шутку — так легче начать.\n• Кто-то берёт паузу и вспоминает конкретную историю — с неё разговор становится глубже.\n\n(Подсказка без сети: расскажите свою историю вместо общего ответа.)`;
  return uk
    ? `🧠 Як краще поговорити про це:\nПочни з прикладу з власного життя, а не з оцінки. Питання «${q}» легше обговорювати, коли кожен говорить про себе.\n\n🔗 Як це впливає на стосунки:\nЧесна відповідь без осуду додає довіри, навіть якщо думки різні.\n\n🛠️ Порада на сьогодні:\nПісля відповіді постав одне уточнювальне питання й просто вислухай.\n\n(Підказка без мережі.)`
    : `🧠 Как лучше поговорить об этом:\nНачни с примера из своей жизни, а не с оценки. Вопрос «${q}» легче обсуждать, когда каждый говорит о себе.\n\n🔗 Как это влияет на отношения:\nЧестный ответ без осуждения добавляет доверия, даже если мнения разные.\n\n🛠️ Совет на сегодня:\nПосле ответа задай один уточняющий вопрос и просто выслушай.\n\n(Подсказка без сети.)`;
};

// головний виклик. Результат: { text, source: 'proxy' | 'pollinations' | 'recent' | 'local' }; виняток лише при скасуванні.
export const aiAsk = async (input, { onChunk, signal } = {}) => {
  const req = cleanAiRequest(input); if (!req) return { text: '', source: 'local' };
  let text = await aiViaProxy(req, onChunk, signal); let source = 'proxy';
  if (signal && signal.aborted) throw new Error('aborted');
  if (!text) { text = await aiViaPollinations(req, signal); source = 'pollinations'; }
  if (signal && signal.aborted) throw new Error('aborted');
  if (text) { aiRemember(req, text); return { text, source }; }
  // уже показані відповіді віддаємо по колу: без повторів поспіль і без Math.random
  const recent = aiRecent.get(aiKey(req)); if (recent && recent.length) { const t = recent.shift(); recent.push(t); return { text: t, source: 'recent' }; }
  return { text: req.type === 'situation' || req.type === 'advice' ? aiLocalFallback(req) : '', source: 'local' };
};
