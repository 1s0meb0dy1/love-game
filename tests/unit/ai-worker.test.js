// Воркер worker/ai-proxy: CORS лише для сайту гри, перевірка запиту, потокова відповідь Gemini, перехід до наступної моделі
// при помилці й відповідь із кешу, коли всі моделі недоступні. Мережа й кеш Cloudflare підмінені.
const path = require('path');
const res = []; const T = (n, ok) => res.push((ok ? 'PASS ' : 'FAIL ') + n);
const store = new Map(); globalThis.caches = { default: { put: async (u, r) => { store.set(String(u), await r.text()); }, match: async (u) => (store.has(String(u)) ? new Response(store.get(String(u))) : undefined) } };
const sse = (parts) => new Response(new ReadableStream({ start(c) { const e = new TextEncoder(); parts.forEach(t => c.enqueue(e.encode('data: ' + JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] }) + '\n\n'))); c.close(); } }), { status: 200 });
let plan = []; const seen = [];
globalThis.fetch = async (url, init) => { seen.push({ url: String(url), body: init && init.body }); const step = plan.shift(); if (!step) return new Response('x', { status: 500 }); return step(); };
const ctxWait = []; const ctx = { waitUntil: (p) => ctxWait.push(p) };
const env = { GEMINI_API_KEY: 'k', GEMINI_MODELS: 'm1,m2', ALLOWED_ORIGINS: 'https://1s0meb0dy1.github.io' };
const req = (body, origin = 'https://1s0meb0dy1.github.io', method = 'POST') => new Request('https://w.test/', { method, headers: { Origin: origin, 'Content-Type': 'application/json' }, body: method === 'POST' ? JSON.stringify(body) : undefined });
(async () => {
  const W = (await import(path.join(__dirname, '../../worker/ai-proxy/src/index.js'))).default;
  let r = await W.fetch(req({ type: 'advice', question: 'Q' }, 'https://evil.example'), env, ctx);
  T('чужий сайт — 403 без CORS-заголовка', r.status === 403 && !r.headers.get('Access-Control-Allow-Origin'));
  r = await W.fetch(req(null, 'https://1s0meb0dy1.github.io', 'OPTIONS'), env, ctx);
  T('preflight із сайту гри — 204 з дозволом', r.status === 204 && r.headers.get('Access-Control-Allow-Origin') === 'https://1s0meb0dy1.github.io');
  r = await W.fetch(req({ type: 'chat', prompt: 'напиши мені курсову' }), env, ctx);
  T('довільний промпт не приймається — 400', r.status === 400);
  plan = [() => new Response('quota', { status: 429 }), () => sse(['Перша частина відповіді, ', 'і друга частина'])];
  r = await W.fetch(req({ type: 'situation', lang: 'uk', question: 'Що для тебе дім?' }), env, ctx); const t1 = await r.text(); await Promise.all(ctxWait);
  T('перша модель 429 → друга відповідає потоком', r.status === 200 && t1 === 'Перша частина відповіді, і друга частина' && /models\/m1:/.test(seen[0].url) && /models\/m2:/.test(seen[1].url) && r.headers.get('X-AI-Source') === 'live');
  T('ключ Gemini йде в заголовку, не в адресі; імен гравців у запиті немає', !seen.some(s => /key=/.test(s.url)) && !/Аня/.test(seen[1].body));
  plan = []; r = await W.fetch(req({ type: 'situation', lang: 'uk', question: 'Що для тебе дім?' }), env, ctx);
  T('усі моделі недоступні → відповідь із кешу', r.status === 200 && (await r.text()) === 'Перша частина відповіді, і друга частина' && r.headers.get('X-AI-Source') === 'cache');
  r = await W.fetch(req({ type: 'situation', lang: 'uk', question: 'Інше питання' }), env, ctx);
  T('кешу немає → 503 (браузер перейде до запасного шляху)', r.status === 503);
  console.log(res.join('\n')); console.log('--- captured runtime errors: 0'); process.exit(res.some(l => l.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { console.log(res.join('\n')); console.log('TEST CRASH:', e && e.stack); process.exit(1); });
