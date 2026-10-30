// Запуск: npm run build && node docs/design-system/build.mjs → docs/design-system/ask-me-heat.html (не в git; довідник для артефакту «ASK ME Heat»).
// Збирає живий довідник дизайн-системи ASK ME: справжній CSS застосунку + реальні іконки, мотиви фону й логотип.
import fs from 'node:fs'; import path from 'node:path';
const ROOT = process.argv[2] || path.resolve(import.meta.dirname, "../.."); const OUT = process.argv[3] || path.join(import.meta.dirname, "ask-me-heat.html"); const PAGE = process.argv[4] || path.join(import.meta.dirname, "page.html");
const rd = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// 1. CSS із збірки, шрифти — data: URI
const cssFile = fs.readdirSync(path.join(ROOT, 'dist/assets')).find(f => /^index-.*\.css$/.test(f));
let css = fs.readFileSync(path.join(ROOT, 'dist/assets', cssFile), 'utf8');
css = css.replace(/url\(([^)]*?)((onest|unbounded)-(cyrillic|latin))[^)]*?\.woff2\)/g, (_, _p, base) => 'url(data:font/woff2;base64,' + fs.readFileSync(path.join(ROOT, 'src/fonts', base + '.woff2')).toString('base64') + ')');

// 2. JSX -> HTML для статичних SVG
const jsx2html = (s) => s
  .replace(/className=\{`([^`$]*)\$\{[^}]*\}[^`]*`\}/g, 'class="$1"')
  .replace(/className=/g, 'class=')
  .replace(/\s(on[A-Z]\w*)=\{[^}]*\}/g, '')
  .replace(/=\{(\d+(?:\.\d+)?)\}/g, '="$1"')
  .replace(/\s(strokeWidth|strokeLinecap|strokeLinejoin|fillRule|clipRule|strokeDasharray|strokeMiterlimit|stopColor|stopOpacity)=/g, (_, a) => ' ' + a.replace(/[A-Z]/g, c => '-' + c.toLowerCase()) + '=');
const app = rd('src/app.jsx');
const iconsBlock = app.slice(app.indexOf('const Icons = {'), app.indexOf('const PopupModal'));
const icons = [...iconsBlock.matchAll(/(\w+): \(\) => (<svg[\s\S]*?<\/svg>)/g)].map(m => [m[1], jsx2html(m[2]).replace(/class="[^"]*"/, 'class="ds-ico"')]);
const logoSrc = app.slice(app.indexOf('const AskMeLogo'), app.indexOf('// divider: тонкая линия'));
const logos = [...logoSrc.matchAll(/return \( (<div[\s\S]*?<\/div>) \);/g)].map(m => jsx2html(m[1]));

// 3. мотиви фону з index.html
const idx = rd('index.html');
const defs = (idx.match(/<svg class="motif-defs"[\s\S]*?<\/svg>/) || [''])[0];
const motifs = [...idx.matchAll(/<svg class="motif( m-[a-z]+)?"([\s\S]*?)>([\s\S]*?)<\/svg>/g)].map(m => ({ kind: (m[1] || '').trim() || 'контур', svg: `<svg class="ds-motif ${(m[1] || '').trim()}"${m[2].replace(/\sstyle="[^"]*"/, '')}>${m[3]}</svg>` }));
const room = (idx.match(/<div class="bg-room"[\s\S]*?<div class="grain"><\/div>\s*<\/div>/) || [''])[0];

let html = fs.readFileSync(PAGE, 'utf8');
const MOTIF_NAMES = ['Реплика', 'Кубик', 'Вопрос', 'Пламя', 'Сердце', 'Луна', 'Реплика с точками', 'Искра', 'Бесконечность', 'Бокалы', 'Звезда', 'Два сердца'];
html = html.replace('/*APP_CSS*/', () => css)
  .replace('<!--ICONS-->', () => icons.map(([n, s]) => `<figure class="ds-icon-cell">${s}<figcaption><code>Icons.${n}</code></figcaption></figure>`).join('\n'))
  .replace('<!--MOTIF_DEFS-->', () => defs.replace('class="motif-defs"', 'class="ds-defs"'))
  .replace('<!--MOTIFS-->', () => motifs.map((m, i) => `<figure class="ds-motif-cell">${m.svg}<figcaption>${MOTIF_NAMES[i] || 'Мотив'}<span>${m.kind === 'контур' ? 'контур' : m.kind === 'm-glass' ? 'стекло' : 'дальний'}</span></figcaption></figure>`).join('\n'))
  .replace('<!--ROOM-->', () => room)
  .replace('<!--LOGO_LG-->', () => logos[2] || '').replace('<!--LOGO_MD-->', () => logos[1] || '').replace('<!--LOGO_XS-->', () => logos[0] || '')
  .replace(/<!--COUNT_ICONS-->/g, String(icons.length)).replace(/<!--COUNT_MOTIFS-->/g, String(motifs.length));
fs.writeFileSync(OUT, html);
console.log('icons', icons.length, 'motifs', motifs.length, 'logos', logos.length, 'room', room.length, 'bytes', html.length);
