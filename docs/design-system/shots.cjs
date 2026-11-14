// Знімки екранів для довідника «ASK ME Heat» (розділи «Знайомство», «Екрани телефона», «Комп'ютер»).
// Запуск: npm run build && npx vite preview --port 4173 &  →  node docs/design-system/shots.cjs [адреса]
// Потрібен Playwright (у хмарному середовищі вже встановлений). Знімки — docs/design-system/shots/*.jpg (не в git), build.mjs вбудовує їх у сторінку.
const { chromium } = require('playwright');
const fs = require('node:fs'); const path = require('node:path');
const BASE = process.argv[2] || 'http://localhost:4173/love-game/';
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true }); fs.rmSync(path.join(OUT, '.inter'), { force: true });

const wait = (p, ms) => p.waitForTimeout(ms);
const click = async (p, re) => { const b = p.getByRole('button', { name: re }).first(); if (await b.count()) { await b.click({ timeout: 4000 }).catch(() => {}); await wait(p, 900); return true; } return false; };
const snap = async (p, name) => { await wait(p, 900); await p.screenshot({ path: path.join(OUT, name + '.jpg'), type: 'jpeg', quality: 72 }); console.log('знімок', name); };

// новий гість; theme — 'dark' | 'light'; intro — чи показати спершу «сторіс»
const start = async (b, w, h, { theme = 'dark', intro = false, motion = 'reduce' } = {}) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'uk-UA', reducedMotion: motion, colorScheme: theme });
  await ctx.addInitScript(([t, i]) => { try { localStorage.setItem('askme_theme_v1', t); if (!i) localStorage.setItem('askme_intro_seen_v1', '1'); } catch (e) {} }, [theme, intro]);
  const p = await ctx.newPage();
  await p.goto(BASE, { waitUntil: 'networkidle' }); await wait(p, 800);
  return p;
};
const names = async (p) => { const inputs = p.locator('input[type=text]'); if (await inputs.count() > 1) { await inputs.nth(0).fill('Аня'); await inputs.nth(1).fill('Макс'); } };
const toMood = async (p) => { await names(p); await click(p, /Почати вечір/); await wait(p, 600); };
const go = async (p, hash) => { await p.evaluate((h) => { location.hash = h; }, hash); await wait(p, 900); };
// рулетка ходу: дотискаємо до кінця; у довідник не беремо питання про війну — це зразок вигляду, а не змісту
const settle = async (p) => { for (let k = 0; k < 8 && await p.locator('.roulette-dlg').count(); k++) { const rb = p.locator('.roulette-dlg button'); if (await rb.count()) await rb.last().click().catch(() => {}); await wait(p, 500); } };
const next = async (p) => {
  const skip = p.getByRole('button', { name: 'Пропустити питання' }); if (await skip.count()) { await skip.click({ timeout: 3000 }).catch(() => {}); await wait(p, 250); await p.getByRole('button', { name: /Для всіх/ }).click().catch(() => {}); await wait(p, 400); }
  if (await p.locator('.ev-inter').count()) { await p.locator('.ev-inter').click().catch(() => {}); await wait(p, 300); }
  await p.locator('.btn-primary:has-text("Далі")').last().click({ timeout: 3000 }).catch(() => {});
  if (!fs.existsSync(path.join(OUT, '.inter'))) for (let k = 0; k < 10 && !(await p.locator('.ev-inter').count()); k++) await wait(p, 100);
  if (await p.locator('.ev-inter').count() && !fs.existsSync(path.join(OUT, '.inter'))) { await wait(p, 450); await p.screenshot({ path: path.join(OUT, 'm-inter.jpg'), type: 'jpeg', quality: 72 }); fs.writeFileSync(path.join(OUT, '.inter'), ''); console.log('знімок m-inter'); }
  await settle(p);
};
const card = async (p) => { await settle(p); for (let k = 0; k < 4 && /війн/i.test(await p.locator('.game-card').innerText().catch(() => '')); k++) await next(p); };

(async () => {
  const b = await chromium.launch();
  // телефон, «Ніч»: знайомство, вітання, настрій, межі, вечір
  let p = await start(b, 390, 844, { intro: true });
  await snap(p, 'm-intro');
  await p.keyboard.press('Escape'); await wait(p, 600);
  if (await p.locator('.intro').count()) await p.locator('.intro-top button[aria-label]').last().click();
  await p.context().close();
  p = await start(b, 390, 844);
  await snap(p, 'm-welcome');
  await toMood(p); await snap(p, 'm-mood');
  await p.locator('.limits-btn').click(); await wait(p, 400);
  await p.locator('.lim-grid .chip').nth(1).click(); await p.locator('.lim-grid .chip').nth(8).click(); await snap(p, 'm-limits');
  await p.keyboard.press('Escape'); await wait(p, 400);
  await p.locator('.mood-close').click(); await wait(p, 2000); await card(p); await snap(p, 'm-game');
  // заставка глави і «Врятувати вечір» — у другій главі (рух увімкнено, щоб заставка встигла з'явитися)
  for (let i = 0; i < 12; i++) {
    await next(p);
    if (await p.locator('.rescue-btn').count()) { await card(p); await p.locator('.rescue-btn').scrollIntoViewIfNeeded(); await snap(p, 'm-rescue'); break; }
  }
  await go(p, '#/more'); await snap(p, 'm-more');
  await go(p, '#/mode'); await snap(p, 'm-mode');
  await go(p, '#/tod'); await click(p, /Почати гру/); if (await p.getByRole('button', { name: /Нам є 18/ }).count()) await click(p, /Нам є 18/); await snap(p, 'm-tod-choose');
  await p.context().close();

  // телефон, «Світанок»
  p = await start(b, 390, 844, { theme: 'light' });
  await snap(p, 'l-welcome');
  await toMood(p); await snap(p, 'l-mood');
  await p.locator('.mood-easy').click(); await wait(p, 2000); await card(p); await snap(p, 'l-game');
  await go(p, '#/more'); await snap(p, 'l-more');
  await p.context().close();

  // комп'ютер
  p = await start(b, 1440, 900);
  await toMood(p); await snap(p, 'd-mood');
  await p.locator('.mood-close').click(); await wait(p, 2000); await card(p); await snap(p, 'd-game');
  await go(p, '#/tod'); await click(p, /Почати гру/); if (await p.getByRole('button', { name: /Нам є 18/ }).count()) await click(p, /Нам є 18/); await click(p, /Правда/); await snap(p, 'd-tod');
  await go(p, '#/about'); await snap(p, 'd-about');
  await b.close();
})();
