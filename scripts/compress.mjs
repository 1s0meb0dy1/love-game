// Сжимает собранные файлы (Brotli + gzip) рядом с оригиналами. Хостинг с поддержкой .br/.gz отдаст их автоматически.
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { brotliCompressSync, gzipSync, constants } from 'node:zlib';

const DIST = new URL('../dist', import.meta.url).pathname;
const TEXT = new Set(['.js', '.css', '.html', '.svg', '.json', '.webmanifest', '.txt']);
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
let raw = 0, br = 0, gz = 0, n = 0;
for (const file of walk(DIST)) {
  if (!TEXT.has(extname(file))) continue;
  const buf = readFileSync(file); const b = brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }); const g = gzipSync(buf, { level: 9 });
  writeFileSync(file + '.br', b); writeFileSync(file + '.gz', g); raw += buf.length; br += b.length; gz += g.length; n++;
}
const kb = (x) => (x / 1024).toFixed(1) + ' КБ';
console.log(`Сжато файлов: ${n} | исходно ${kb(raw)} → gzip ${kb(gz)} → brotli ${kb(br)}`);
