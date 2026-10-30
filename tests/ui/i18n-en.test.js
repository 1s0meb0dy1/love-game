// Англійська мова інтерфейсу: обходить екрани (гравець і власник) і шукає кирилицю, яка не пройшла через переклад,
// у видимому тексті й підписах (aria-label, title, placeholder) та в заголовку вкладки.
// Тексти питань із тестової бази та імена гравців не перевіряються: у фікстурі питань немає text_en, а імена вводить гравець.
Object.assign(globalThis, require('../harness.js')({ lang: 'en' }));
const ADMIN = process.env.FLOW === 'admin';
if (ADMIN) w.localStorage.setItem('askme_auth_v2', JSON.stringify({ owner: { idToken: 't', refreshToken: 'r', expiresAt: Date.now() + 3.6e6 } }));
const CYR = /[А-Яа-яЁёІіЇїЄєҐґ]/;
// назви кнопок для обходу беремо зі словника EN (ключ — російський оригінал), тож тест не залежить від формулювань перекладу
const enSrc = fs.readFileSync(require('path').join(__dirname, '../../src/i18n-en.js'), 'utf8');
const EN = new Function(enSrc.replace(/^export /gm, '') + '\nreturn EN;')();
const en = (ru) => { if (typeof EN[ru] !== 'string') throw new Error('немає EN-перекладу для «' + ru + '»'); return EN[ru]; };
const isRu = (s) => CYR.test(s);
const skipTexts = new Set(Object.values(exp).map(q => String(q.text).replace(/^№\s*\d+\.\s*/, '').trim()));
const go = async (hash, ms = 600) => { w.location.hash = hash; w.dispatchEvent(new w.HashChangeEvent('hashchange')); await sleep(ms); };
const leaks = new Map();
const scan = (where) => {
  const walker = D.createTreeWalker(D.body, w.NodeFilter.SHOW_TEXT); let n;
  while ((n = walker.nextNode())) {
    const s = n.nodeValue.replace(/\s+/g, ' ').trim(); if (!s || !isRu(s)) continue;
    const el = n.parentElement; const block = el && el.closest('p,div,li,h1,h2,h3,span,button'); const full = (block ? block.textContent : s).replace(/\s+/g, ' ').trim();
    if ([...skipTexts].some(q => full.includes(q) || q.includes(s))) continue;
    leaks.set(s.slice(0, 90), where);
  }
  D.querySelectorAll('[aria-label],[title],[placeholder]').forEach(el => ['aria-label', 'title', 'placeholder'].forEach(a => { const v = el.getAttribute(a); if (v && isRu(v.trim()) && ![...skipTexts].some(q => v.includes(q))) leaks.set(a + ': ' + v.slice(0, 80), where); }));
  if (isRu(D.title)) leaks.set('title: ' + D.title, where);
};
(async () => { try {
  w.eval(code); await sleep(1800);
  scan('#/welcome');
  const inputs = [...D.querySelectorAll('input[type="text"]')]; setVal(inputs[0], 'Max'); setVal(inputs[1], 'Anna'); await sleep(200);
  await click(en('Создать сессию'), 1200); scan('#/session-ready'); await click(en('Перейти к игре'), 900);
  const pages = ['#/', '#/more', '#/profile', '#/mode', '#/setup', '#/topics', '#/questions', '#/archive', '#/invite', '#/about', '#/tod', '#/questions/hidden', '#/punishments/manage', '#/analytics', '#/privacy', '#/terms', '#/cookies', '#/age', '#/copyright'];
  if (ADMIN) pages.push('#/topics/manage', '#/tod/manage', '#/add', '#/admin', '#/analytics/sessions');
  for (const h of pages) { await go(h); scan(h); }
  await go('#/mode'); await click(en('Обычный режим'), 1500); scan('#/play');
  await go('#/tod', 800); await click(en('Начать игру'), 1200); if (has(en('Нам есть 18, начать'))) await click(en('Нам есть 18, начать'), 1200); scan('#/tod/play');
  await click(en('Правда'), 900); scan('#/tod/play (картка)'); await click(en('Меню'), 600); scan('#/tod/play (завершення)');
  await click(en('Завершить для всех'), 1200); scan('#/tod/results'); T('обхід дійшов до підсумків «Правди чи дії»', /^Results/.test(D.title) && D.title.includes(en('Правда или действие')));
  T('мова інтерфейсу — англійська (html lang)', D.documentElement.lang === 'en');
  T('на екранах немає кирилиці' + (leaks.size ? ': ' + [...leaks].slice(0, 40).map(([s, h]) => `${h} «${s}»`).join('; ') : ''), leaks.size === 0);
  console.log(res.join('\n')); console.log('--- captured runtime errors:', errors.length); errors.slice(0, 6).forEach(e => console.log(' ', e)); process.exit(0);
 } catch (err) { console.log(res.join('\n')); console.log('TEST CRASH:', err.message.split('\n')[0], '| title:', D.title, '| body:', D.body.textContent.replace(/\s+/g, ' ').slice(0, 200)); process.exit(1); } })();
