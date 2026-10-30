// Знімки екранів для довідника «ASK ME Heat» (розділи «Екрани» і «Комп'ютер»).
// Запуск: npm run build && npx vite preview --port 4173 &  →  node docs/design-system/shots.cjs [адреса]
// Потрібен Playwright (у хмарному середовищі вже встановлений). Знімки — docs/design-system/shots/*.jpg (не в git), build.mjs вбудовує їх у сторінку.
const { chromium } = require('playwright');
const fs = require('node:fs'); const path = require('node:path');
const BASE = process.argv[2] || 'http://localhost:4173/love-game/';
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const wait = (p, ms) => p.waitForTimeout(ms);
const click = async (p, re) => { const b = p.getByRole('button', { name: re }).first(); if (await b.count()) { await b.click({ timeout: 4000 }).catch(() => {}); await wait(p, 900); return true; } return false; };
const snap = async (p, name) => { await wait(p, 1100); await p.screenshot({ path: path.join(OUT, name + '.jpg'), type: 'jpeg', quality: 72 }); console.log('знімок', name); };

// нова сесія з двома гравцями; intro — чи показати спершу «сторіс»
const start = async (b, w, h, intro) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'uk-UA', reducedMotion: 'reduce' });
  if (!intro) await ctx.addInitScript(() => { try { localStorage.setItem('askme_intro_seen_v1', '1'); } catch (e) {} });
  const p = await ctx.newPage();
  await p.goto(BASE, { waitUntil: 'networkidle' });
  return p;
};
const session = async (p) => {
  const inputs = p.locator('input[type=text]');
  await inputs.nth(0).fill('Аня'); await inputs.nth(1).fill('Макс');
  await click(p, /Створити сесію/); await wait(p, 1200); await click(p, /Перейти до гри/); await wait(p, 900);
};
const go = async (p, hash) => { await p.evaluate((h) => { location.hash = h; }, hash); await wait(p, 900); };

(async () => {
  const b = await chromium.launch();
  // телефон: знайомство й вхід
  let p = await start(b, 390, 844, true);
  await snap(p, 'm-intro');
  await p.keyboard.press('Escape'); await wait(p, 600);
  if (await p.locator('.intro').count()) await p.locator('.intro-top button[aria-label]').last().click();
  await snap(p, 'm-welcome');
  await p.context().close();

  // телефон: головна, меню, режими, лобі, партія
  p = await start(b, 390, 844, false);
  await session(p);
  await snap(p, 'm-home');
  await go(p, '#/more'); await snap(p, 'm-more');
  await go(p, '#/mode'); await snap(p, 'm-mode');
  await go(p, '#/tod'); await snap(p, 'm-tod-lobby');
  await click(p, /Почати гру/); await snap(p, 'm-tod-choose');
  await click(p, /Правда/); await snap(p, 'm-tod-card');
  await go(p, '#/'); await click(p, /Почати гру/); await click(p, /Звичайний режим/); await wait(p, 5000);
  await click(p, /До питання/);
  // у довідник не беремо питання про війну: це зразок вигляду, а не змісту
  for (let k = 0; k < 4 && /війн/i.test(await p.locator('main').innerText()); k++) { await click(p, /^Далі/); await wait(p, 4500); await click(p, /До питання/); }
  await snap(p, 'm-game');
  await p.context().close();

  // комп'ютер
  p = await start(b, 1440, 900, false);
  await session(p);
  await snap(p, 'd-home');
  await go(p, '#/mode'); await snap(p, 'd-mode');
  await go(p, '#/tod'); await click(p, /Почати гру/); await click(p, /Правда/); await snap(p, 'd-tod');
  await go(p, '#/about'); await snap(p, 'd-about');
  await b.close();
})();
