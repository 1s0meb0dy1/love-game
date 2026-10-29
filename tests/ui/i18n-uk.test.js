// Українська мова інтерфейсу: обходить екрани (гравець і власник) і шукає російський текст, який не пройшов через переклад.
// Ознака — літери, яких немає в українській абетці (ы, э, ъ, ё), у видимому тексті й підписах (aria-label, title, placeholder).
// Тексти питань із тестової бази та імена гравців не перевіряються: у фікстурі питань немає text_uk, а імена вводить гравець.
Object.assign(globalThis, require('../harness.js')({ lang: 'uk' }));
const ADMIN = process.env.FLOW === 'admin';
if (ADMIN) w.localStorage.setItem('askme_auth_v2', JSON.stringify({ owner: { idToken: 't', refreshToken: 'r', expiresAt: Date.now() + 3.6e6 } }));
const RU_ONLY = /[ыэъёЫЭЪЁ]/;
// друга ознака: рядок дорівнює російському ключу словника (або містить довгий ключ), для якого є інший український переклад
const i18nSrc = fs.readFileSync(require('path').join(__dirname, '../../src/i18n.js'), 'utf8');
const UKD = new Function(i18nSrc.replace(/^export /gm, '') + '\nreturn UK;')();
const ruKeys = Object.keys(UKD).filter(k => UKD[k] !== k && /[А-Яа-яЁё]{3,}/.test(k));
const ruExact = new Set(ruKeys.map(k => k.trim())); const ruLong = ruKeys.filter(k => k.trim().length >= 14);
const isRu = (s) => RU_ONLY.test(s) || ruExact.has(s) || ruLong.some(k => s.includes(k.trim()));
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
  const inputs = [...D.querySelectorAll('input[type="text"]')]; setVal(inputs[0], 'Макс'); setVal(inputs[1], 'Аня'); await sleep(200);
  await click('Створити сесію', 1200); scan('#/session-ready'); await click('Перейти до гри', 900);
  const pages = ['#/', '#/more', '#/profile', '#/mode', '#/setup', '#/topics', '#/questions', '#/archive', '#/invite', '#/about', '#/tod', '#/questions/hidden', '#/punishments/manage', '#/analytics'];
  if (ADMIN) pages.push('#/topics/manage', '#/tod/manage', '#/add', '#/admin', '#/analytics/sessions');
  for (const h of pages) { await go(h); scan(h); }
  await go('#/mode'); await click('Звичайний режим', 1500); scan('#/play');
  await go('#/tod', 800); await click('Почати гру', 1200); if (has('Нам є 18')) await click('Нам є 18', 1200); scan('#/tod/play');
  await click('Правда', 900); scan('#/tod/play (картка)'); await click('Завершити', 600); scan('#/tod/play (завершення)');
  await click('Завершити для всіх', 1200); scan('#/tod/results'); T('обхід дійшов до підсумків «Правди чи дії»', /Підсумки/.test(D.title));
  T('мова інтерфейсу — українська (html lang)', D.documentElement.lang === 'uk');
  T('на екранах немає російського тексту' + (leaks.size ? ': ' + [...leaks].slice(0, 40).map(([s, h]) => `${h} «${s}»`).join('; ') : ''), leaks.size === 0);
  console.log(res.join('\n')); console.log('--- captured runtime errors:', errors.length); errors.slice(0, 6).forEach(e => console.log(' ', e)); process.exit(0);
 } catch (err) { console.log(res.join('\n')); console.log('TEST CRASH:', err.message.split('\n')[0], '| title:', D.title, '| body:', D.body.textContent.replace(/\s+/g, ' ').slice(0, 200)); process.exit(1); } })();
