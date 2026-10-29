// ASK ME — проксі ШІ-підказок на Cloudflare Workers.
// Ключ Gemini зберігається тут як секрет (wrangler secret put GEMINI_API_KEY) і ніколи не потрапляє в браузер.
// Відповідь іде потоком (text/plain), тож гравець бачить текст за ~1 с. Порядок: моделі з GEMINI_MODELS по черзі → Pollinations
// (якщо задано POLLINATIONS_KEY) → кеш попередніх відповідей на це ж питання. Вміст запитів не логуються.
import { buildPrompt, cleanAiRequest } from '../../../src/ai/prompts.js';

const DEFAULT_MODELS = 'gemini-3.6-flash,gemini-3.5-flash-lite,gemini-flash-latest';
const FIRST_BYTE_MS = 9000;   // скільки чекати першого шматка від моделі, перш ніж іти до наступної
const TOTAL_MS = 30000;       // стеля на одну модель
const CACHE_SLOTS = 4;        // скільки різних відповідей на одне питання тримаємо про запас

const corsHeaders = (origin, env) => {
  const allowed = String(env.ALLOWED_ORIGINS || 'https://1s0meb0dy1.github.io').split(',').map(s => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
  return ok ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } : null;
};

const sha = async (s) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
const cacheUrl = (key, slot) => `https://askme-ai-cache.invalid/${key}/${slot}`;

// один виклик Gemini у потоковому режимі -> ReadableStream чистого тексту (або виняток, якщо модель не відповіла вчасно)
const geminiStream = async (env, model, p, signal) => {
  const body = { systemInstruction: { parts: [{ text: p.system }] }, contents: [{ role: 'user', parts: [{ text: p.user }] }], generationConfig: { maxOutputTokens: p.maxTokens, thinkingConfig: { thinkingLevel: 'low' } },
    safetySettings: ['HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH', 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_DANGEROUS_CONTENT'].map(category => ({ category, threshold: 'BLOCK_ONLY_HIGH' })) };
  const call = (b) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': String(env.GEMINI_API_KEY).trim() }, body: JSON.stringify(b), signal });
  let res = await call(body);
  if (res.status === 400) { delete body.generationConfig.thinkingConfig; res = await call(body); } // модель без thinkingLevel
  if (!res.ok || !res.body) { let why = ''; try { const t = await res.text(); const m = t.match(/"message"\s*:\s*"([^"]{0,120})/); why = ' ' + (m ? m[1] : t.slice(0, 80)); } catch (e) {} if (!why.trim()) { const k = String(env.GEMINI_API_KEY || '').trim(); why = ' empty body; key ' + (/^AIza[0-9A-Za-z_-]{35}$/.test(k) ? 'format ok' : 'format bad len ' + k.length); } throw new Error('gemini ' + res.status + why.slice(0, 90)); }
  return sseToText(res.body, (j) => (j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts || []).filter(x => !x.thought).map(x => x.text || '').join(''));
};

const pollinationsStream = async (env, p, signal) => {
  if (!env.POLLINATIONS_KEY) throw new Error('no pollinations key');
  const res = await fetch('https://gen.pollinations.ai/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + env.POLLINATIONS_KEY }, signal,
    body: JSON.stringify({ model: 'openai', stream: true, max_tokens: p.maxTokens + 600, messages: [{ role: 'system', content: p.system }, { role: 'user', content: p.user }] }) });
  if (!res.ok || !res.body) throw new Error('pollinations ' + res.status);
  return sseToText(res.body, (j) => (j && j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content) || '');
};

// SSE (data: {...}) -> потік тексту
const sseToText = (body, pickText) => {
  const dec = new TextDecoder(); const enc = new TextEncoder(); let buf = '';
  return body.pipeThrough(new TransformStream({
    transform(chunk, ctl) {
      buf += dec.decode(chunk, { stream: true }); const lines = buf.split('\n'); buf = lines.pop();
      for (const l of lines) { const m = l.match(/^data:\s*(.*)$/); if (!m || m[1] === '[DONE]') continue; try { const t = pickText(JSON.parse(m[1])); if (t) ctl.enqueue(enc.encode(t)); } catch (e) {} }
    },
  }));
};

// чекаємо перший непорожній шматок: якщо модель мовчить — виняток, і беремо наступну
const withFirstChunk = async (stream, ms) => {
  const reader = stream.getReader(); let timer;
  const first = await Promise.race([reader.read(), new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('first-byte timeout')), ms); })]).finally(() => clearTimeout(timer));
  if (first.done || !first.value || !first.value.length) throw new Error('empty');
  return new ReadableStream({ start(ctl) { ctl.enqueue(first.value); }, async pull(ctl) { const r = await reader.read(); if (r.done) ctl.close(); else ctl.enqueue(r.value); }, cancel() { reader.cancel(); } });
};

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const cors = corsHeaders(origin, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: cors ? 204 : 403, headers: cors || {} });
    if (!cors) return new Response('forbidden', { status: 403 });
    if (request.method !== 'POST') return new Response('method', { status: 405, headers: cors });
    if (env.RATE_LIMITER) { const { success } = await env.RATE_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') || 'x' }); if (!success) return new Response('rate', { status: 429, headers: { ...cors, 'Retry-After': '10' } }); }
    let req; try { req = cleanAiRequest(await request.json()); } catch (e) { req = null; }
    if (!req) return new Response('bad request', { status: 400, headers: cors });
    const p = buildPrompt(req);
    const key = await sha([req.type, req.lang, req.question, req.text, req.to].join('|'));
    const headers = { ...cors, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };

    const models = String(env.GEMINI_MODELS || DEFAULT_MODELS).split(',').map(s => s.trim()).filter(Boolean);
    const attempts = [...(env.GEMINI_API_KEY ? models.map(m => (signal) => geminiStream(env, m, p, signal)) : []), (signal) => pollinationsStream(env, p, signal)];
    const labels = [...(env.GEMINI_API_KEY ? models : []), 'pollinations'];
    const fails = []; // коди помилок без вмісту запиту — для заголовка X-AI-Fail (діагностика)
    for (const [i, attempt] of attempts.entries()) {
      const ac = new AbortController(); const kill = setTimeout(() => ac.abort(), TOTAL_MS);
      try {
        const stream = await withFirstChunk(await attempt(ac.signal), FIRST_BYTE_MS);
        const [toClient, toCache] = stream.tee();
        // повну відповідь кладемо в кеш (випадковий слот) — запас на випадок, коли всі моделі недоступні
        ctx.waitUntil(new Response(toCache).text().then(t => { clearTimeout(kill); if (t.trim().length > 20) return caches.default.put(cacheUrl(key, Math.floor(Math.random() * CACHE_SLOTS)), new Response(t, { headers: { 'Cache-Control': 'max-age=2592000' } })); }).catch(() => {}));
        return new Response(toClient, { headers: { ...headers, 'X-AI-Source': 'live' } });
      } catch (e) { clearTimeout(kill); ac.abort(); fails.push(labels[i] + ':' + String(e && e.message || e).replace(/[^\w .:-]/g, '').slice(0, 110)); }
    }
    for (let i = 0; i < CACHE_SLOTS; i++) { const hit = await caches.default.match(cacheUrl(key, (i + Math.floor(Math.random() * CACHE_SLOTS)) % CACHE_SLOTS)); if (hit) return new Response(hit.body, { headers: { ...headers, 'X-AI-Source': 'cache' } }); }
    return new Response('unavailable', { status: 503, headers: { ...cors, 'X-AI-Fail': fails.join('; ').slice(0, 700), 'Access-Control-Expose-Headers': 'X-AI-Fail' } });
  },
};
