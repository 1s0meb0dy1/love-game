// Проверка веса сборки. Ошибка (код 1), если превышен любой из лимитов. Лимиты можно менять переменными окружения.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { gzipSync } from 'node:zlib';

const MAX_TOTAL_MB = Number(process.env.MAX_TOTAL_MB || 15);          // весь сайт, без сжатых копий
const MAX_INITIAL_GZIP_KB = Number(process.env.MAX_INITIAL_GZIP_KB || 500); // HTML + CSS + JS в gzip (то, что качается при первом открытии)
const MAX_IMAGE_KB = Number(process.env.MAX_IMAGE_KB || 150);          // один рисунок
const MAX_MEDIA_KB = Number(process.env.MAX_MEDIA_KB || 100);          // один звук/видео
const DIST = new URL('../dist', import.meta.url).pathname;
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(DIST).filter((f) => !/\.(br|gz)$/.test(f));
const kb = (x) => (x / 1024).toFixed(1);
let total = 0, initial = 0; const problems = []; const rows = [];
for (const f of files) {
  const size = statSync(f).size; const ext = extname(f).toLowerCase(); total += size;
  const rel = f.replace(DIST + '/', '');
  if (['.js', '.css', '.html'].includes(ext) && !rel.startsWith('workbox')) initial += gzipSync(readFileSync(f)).length;
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.ico'].includes(ext) && size / 1024 > MAX_IMAGE_KB) problems.push(`Рисунок ${rel}: ${kb(size)} КБ > ${MAX_IMAGE_KB} КБ`);
  if (['.mp3', '.ogg', '.opus', '.wav', '.m4a', '.aac', '.mp4', '.webm'].includes(ext) && size / 1024 > MAX_MEDIA_KB) problems.push(`Звук/видео ${rel}: ${kb(size)} КБ > ${MAX_MEDIA_KB} КБ`);
  rows.push([rel, size]);
}
rows.sort((a, b) => b[1] - a[1]);
console.log('Самые тяжёлые файлы:'); rows.slice(0, 8).forEach(([n, s]) => console.log(`  ${kb(s).padStart(8)} КБ  ${n}`));
console.log(`\nВсего файлов: ${files.length} | вес сайта: ${(total / 1048576).toFixed(2)} МБ (лимит ${MAX_TOTAL_MB} МБ)`);
console.log(`Первая загрузка (HTML+CSS+JS, gzip): ${kb(initial)} КБ (лимит ${MAX_INITIAL_GZIP_KB} КБ)`);
if (total / 1048576 > MAX_TOTAL_MB) problems.push(`Сайт весит ${(total / 1048576).toFixed(2)} МБ > ${MAX_TOTAL_MB} МБ`);
if (initial / 1024 > MAX_INITIAL_GZIP_KB) problems.push(`Первая загрузка ${kb(initial)} КБ > ${MAX_INITIAL_GZIP_KB} КБ`);
if (problems.length) { console.error('\nПРОВЕРКА ВЕСА НЕ ПРОЙДЕНА:\n - ' + problems.join('\n - ')); process.exit(1); }
console.log('\nПроверка веса пройдена ✔');
