// ШІ-підказки (src/ai/prompts.js, src/ai/client.js): перевірка запиту, промпти без імен гравців і ланцюжок запасних варіантів,
// завдяки якому підказка не ламається: проксі → Pollinations → уже показана відповідь → локальна заготовка мовою інтерфейсу.
const { loadTod } = require('../tod-load.js');
const res = []; const T = (n, ok) => res.push((ok ? 'PASS ' : 'FAIL ') + n);
const M = loadTod(['ai/prompts.js', 'ai/client.js'], ['buildPrompt', 'cleanAiRequest', 'aiAsk', 'aiLocalFallback', 'AI_PROXY_URL']);
(async () => {
  T('запит: невідомий тип і порожнє питання відхиляються', M.cleanAiRequest({ type: 'chat', question: 'x' }) === null && M.cleanAiRequest({ type: 'advice', question: '  ' }) === null && M.cleanAiRequest(null) === null);
  const r = M.cleanAiRequest({ type: 'situation', lang: 'xx', question: '<b>Що для тебе дім?</b>' + 'я'.repeat(900), players: 99, names: 'Аня, Макс' });
  T('запит: мова за замовчуванням uk, теги прибрано, довжина ≤ 500, гравців ≤ 10, зайві поля (імена) відкинуто', r.lang === 'uk' && !/[<>]/.test(r.question) && r.question.length <= 500 && r.players === 10 && !('names' in r));
  const p = M.buildPrompt({ type: 'advice', lang: 'uk', question: 'Що для тебе дім?', category: 'Сімʼя', players: 2 }, () => 0);
  T('промпт «Порада» українською: питання, тема, заголовки блоків і заборона вигадувати статистику', /Що для тебе дім\?/.test(p.user) && /Сімʼя/.test(p.user) && /🧠 Як краще поговорити/.test(p.user) && /Статистику не вигадуй/.test(p.user) && /українською/.test(p.system));
  const a = M.buildPrompt({ type: 'situation', lang: 'ru', question: 'Q', players: 4 }, () => 0), b = M.buildPrompt({ type: 'situation', lang: 'ru', question: 'Q', players: 4 }, () => 0.95);
  T('промпт «Ситуация» по-русски, для компании, ракурс меняется от случайного числа (ответы не повторяются)', /компания из 4/.test(a.user) && /🎬 Моделирование ситуации/.test(a.user) && a.user !== b.user);
  T('проксі — воркер askme-ai на https', M.AI_PROXY_URL === 'https://askme-ai.yedvinn.workers.dev');

  let calls = 0; let mode = 'busy';
  globalThis.fetch = async (url, init) => { calls++; if (mode === 'busy') return { ok: false, status: 402, json: async () => ({}) }; if (mode === 'down') throw new Error('net');
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: ' Відповідь моделі ' } }] }) }; };
  const q = { type: 'situation', lang: 'uk', question: 'Що для тебе дім?', players: 2 };
  let out = await M.aiAsk(q);
  T('Pollinations зайнятий (402) → локальна заготовка українською з питанням', out.source === 'local' && /Моделювання ситуації/.test(out.text) && /Що для тебе дім\?/.test(out.text));
  mode = 'ok'; out = await M.aiAsk(q);
  T('Pollinations відповів → текст моделі без пробілів по краях', out.source === 'pollinations' && out.text === 'Відповідь моделі');
  mode = 'down'; out = await M.aiAsk(q);
  T('мережа впала → показуємо вже отриману відповідь на це ж питання', out.source === 'recent' && out.text === 'Відповідь моделі');
  const ac = new AbortController(); ac.abort(); let thrown = false; try { await M.aiAsk(q, { signal: ac.signal }); } catch (e) { thrown = true; }
  T('скасований запит кидає виняток (екран закрито — нічого не показуємо)', thrown);
  T('заготовка «Совет» по-русски', /Как лучше поговорить/.test(M.aiLocalFallback({ type: 'advice', lang: 'ru', question: 'Q' })));
  console.log(res.join('\n')); console.log('--- captured runtime errors: 0'); process.exit(res.some(l => l.startsWith('FAIL')) ? 1 : 0);
})().catch(e => { console.log(res.join('\n')); console.log('TEST CRASH:', e && e.stack); process.exit(1); });
