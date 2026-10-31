// Сборка «ASK ME · Strategy Atlas 2026»: node docs/strategy/build.mjs → docs/strategy/ask-me-strategy-atlas.html
// Один самодостаточный файл: шрифты Onest/Unbounded из src/fonts встроены, внешних запросов нет.
import fs from 'node:fs';
import path from 'node:path';
import { chapters, hero } from './content/index.mjs';
import { GLOSS, PICKS } from './content/names.mjs';
import { NEW_CARDS } from './content/bank.mjs';
import { UK_NEW, UK_OLD } from './content/bank-uk.mjs';
import { chapter, createCtx, esc, md, contrast } from './render.mjs';

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, '../..');
const OUT = process.argv[2] || path.join(HERE, 'ask-me-strategy-atlas.html');
const rd = (f) => fs.readFileSync(path.join(HERE, f), 'utf8');

/* ── проверка контраста текстовых токенов обеих тем ─────────────── */
const T = {
  dark: { bg: '#0a0710', s1: '#170f20', s2: '#1f1529', t1: '#fbf4f2', t2: '#d0c2cd', t3: '#a496a6', rose: '#ff4d6d', ember: '#ffb061', orchid: '#c98bff', mint: '#4ade9b', sky: '#6ab7ff' },
  light: { bg: '#f6f4fa', s1: '#ffffff', s2: '#faf8fd', t1: '#1b1324', t2: '#403550', t3: '#5e526c', rose: '#d0123d', ember: '#a24c00', orchid: '#6a28c4', mint: '#0a7647', sky: '#0b5cb3' },
};
const bad = [];
for (const [theme, t] of Object.entries(T)) for (const fg of ['t1', 't2', 't3', 'rose', 'ember', 'orchid', 'mint', 'sky']) for (const bg of ['bg', 's1', 's2']) { const r = contrast(t[fg], t[bg]); if (r < 4.5) bad.push(`${theme}: ${fg} на ${bg} = ${r.toFixed(2)}`); }
if (bad.length) { console.error('Контраст ниже 4,5:1:\n' + bad.join('\n')); process.exit(1); }

/* ── шрифты ─────────────────────────────────────────────────────── */
const font = (file) => 'data:font/woff2;base64,' + fs.readFileSync(path.join(ROOT, 'src/fonts', file)).toString('base64');
const CYR = 'U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116', LAT = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2212';
const fontCss = `@font-face{font-family:'Onest';font-weight:400 800;font-display:swap;src:url(${font('onest-cyrillic.woff2')}) format('woff2');unicode-range:${CYR}}
@font-face{font-family:'Onest';font-weight:400 800;font-display:swap;src:url(${font('onest-latin.woff2')}) format('woff2');unicode-range:${LAT}}
@font-face{font-family:'Unbounded';font-weight:500 800;font-display:swap;src:url(${font('unbounded-cyrillic.woff2')}) format('woff2');unicode-range:${CYR}}
@font-face{font-family:'Unbounded';font-weight:500 800;font-display:swap;src:url(${font('unbounded-latin.woff2')}) format('woff2');unicode-range:${LAT}}`;

/* ── данные интерактивных блоков ────────────────────────────────── */
const nm = JSON.parse(fs.readFileSync(path.join(HERE, 'data/names_check.json'), 'utf8'));
const old = JSON.parse(fs.readFileSync(path.join(HERE, 'data/old_names.json'), 'utf8'));
const score = (d) => {
  let s = 0;
  if (d.com === 'free') s += 3; if (d.app === 'free') s += 1.5; if (d.party === 'free') s += 1; if (d.io === 'free') s += 0.5;
  if (d.play === 'none') s += 3; else if (d.play === 'partial') s += 1;
  if (d.n.length <= 7) s += 1;
  return Math.round(s * 10) / 10;
};
const names = [
  ...nm.map((x) => { const d = { n: x.name, g: x.group, gl: GLOSS[x.name] || '', com: x.com, io: x.io, app: x.app, game: x.game, party: x.party, play: x.play.status, pick: PICKS[x.name] || 0 }; d.sc = score(d); return d; }),
  ...old.map((x) => { const d = { n: x.n, g: 'old', gl: x.gl || '', com: x.com, io: x.io, app: x.app, game: x.game, party: x.party, play: x.play === 'exact' ? 'exact' : x.play, pick: 0 }; d.sc = score(d); return d; }),
];
const missing = nm.filter((x) => !GLOSS[x.name]).map((x) => x.name);
if (missing.length) console.warn('Нет пояснения для названий:', missing.join(', '));
const oldBank = JSON.parse(fs.readFileSync(path.join(HERE, 'data/old_bank.json'), 'utf8'));
if (UK_NEW.length !== NEW_CARDS.length || UK_OLD.length !== oldBank.length) throw new Error(`Украинский перевод не совпадает по длине: ${UK_NEW.length}/${NEW_CARDS.length}, ${UK_OLD.length}/${oldBank.length}`);
const bank = [...NEW_CARDS.map((c, i) => ({ ...c, u: UK_NEW[i] })), ...oldBank.map((c, i) => ({ ...c, u: UK_OLD[i] }))];
const ctx = createCtx({ names, bank });

/* ── страница ───────────────────────────────────────────────────── */
const ids = new Set(); chapters.forEach((c) => { if (ids.has(c.id)) throw new Error('Дубль главы ' + c.id); ids.add(c.id); });
let lastPart = '';
const toc = chapters.map((c) => { const h = c.part !== lastPart ? `<div class="toc-part">${esc(c.part)}</div>` : ''; lastPart = c.part; return `${h}<a href="#${c.id}"><span class="n">${c.num}</span><span>${c.icon} ${esc(c.title)}</span></a>`; }).join('');
const body = chapters.map((c) => chapter(c, ctx)).join('\n');

const html = `<!doctype html>
<html lang="ru" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="description" content="${esc(hero.lead.replace(/\*\*/g, ''))}">
<title>ASK ME · Strategy Atlas 2026</title>
<script>try{document.documentElement.setAttribute('data-theme',localStorage.getItem('atlas-theme')||'dark')}catch(e){}</script>
<style>${fontCss}
${rd('template/styles.css')}</style>
</head>
<body>
<a class="skip" href="#c00">К содержанию</a>
<div id="progress" aria-hidden="true"></div>
<div class="app">
<aside class="rail" id="rail" aria-label="Оглавление">
  <a class="brand" href="#top"><span class="brand-mark">AM</span><span class="brand-name">Ask Me<span class="brand-sub">Strategy Atlas 2026</span></span></a>
  <button class="btn-search" data-search aria-label="Поиск по документу"><span aria-hidden="true">🔎</span>Поиск по документу<kbd>Ctrl K</kbd></button>
  <nav class="toc" aria-label="Главы">${toc}</nav>
  <div class="rail-foot"><button class="pill-btn" id="themeBtn">☀️ Светлая</button><button class="pill-btn" id="printBtn">⬇ PDF / печать</button></div>
</aside>
<div class="scrim" id="scrim"></div>
<main id="top">
  <div class="topbar"><button class="pill-btn" data-menu aria-label="Открыть оглавление">☰ Главы</button><span class="brand-name">Ask Me Atlas</span><button class="pill-btn" data-search aria-label="Поиск">🔎</button></div>
  <header class="hero"><div class="hero-in">
    <span class="hero-tag"><i></i>${esc(hero.tag)}</span>
    <div class="wordmark" aria-hidden="true">${esc(hero.wordmark)}</div>
    <h1>${esc(hero.title)}</h1>
    <p class="hero-lead">${md(hero.lead)}</p>
    <div class="hero-meta">${hero.meta.map((m) => `<span><b>${esc(m[0])}</b> ${esc(m[1])}</span>`).join('')}</div>
    <div class="hero-cta"><a class="btn btn-hot" href="#c00">Начать с вердикта</a><button class="btn btn-ghost" data-search>Поиск по документу</button></div>
  </div></header>
  <div class="wrap" style="margin-top:8px">${chapters[0] ? '' : ''}<div class="blk" style="margin-top:0">${hero.bento ? `<div class="bento">${hero.bento.map((i) => `<div class="bt bt-${i.tone} ${i.span ? 's' + i.span : ''}" data-s="${esc(i.big + ' ' + i.label)}">${i.ev ? `<span class="ev ev-${i.ev}">${{ fact: 'ФАКТ', src: 'ИСТОЧНИК', model: 'МОДЕЛЬ', know: 'ЗНАНИЕ', hyp: 'ГИПОТЕЗА', unk: 'НЕ ПРОВЕРЕНО' }[i.ev]}</span>` : ''}<div class="bt-big">${esc(i.big)}${i.unit ? `<small>${esc(i.unit)}</small>` : ''}</div><div class="bt-lab">${md(i.label)}</div>${i.sub ? `<div class="bt-sub">${md(i.sub)}</div>` : ''}</div>`).join('')}</div>` : ''}</div></div>
  ${body}
  <footer class="foot"><div class="wrap"><span>${esc(hero.footer[0])}</span><span>${esc(hero.footer[1])}</span></div></footer>
</main>
</div>
<div class="palette" id="palette" role="dialog" aria-modal="true" aria-label="Поиск по документу"><div class="pal-box"><input id="palInput" type="search" placeholder="Что искать? Например: Paddle, .com, комиссия, TikTok" autocomplete="off" aria-label="Запрос"><div class="pal-res" id="palRes"></div></div></div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script>${rd('template/app.js')}</script>
</body>
</html>`;

fs.writeFileSync(OUT, html);
console.log(`OK ${path.relative(ROOT, OUT)} · ${(html.length / 1024).toFixed(0)} КБ · глав: ${chapters.length} · названий: ${names.length} · карточек: ${bank.length}`);
