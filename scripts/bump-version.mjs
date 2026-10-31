// Поднимает версию приложения на один шаг: 0.1.29а → 0.1.29б … 0.1.29я → 0.1.29аа. Запуск: npm run bump (или автоматически из .githooks/pre-commit).
// `--check` ничего не пишет и печатает текущую версию; `--staged` пропускает подъём, если файл версии уже лежит в индексе git (версию поставили руками).
import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process';
const FILE = path.resolve(import.meta.dirname, '../src/content/version.js');
export const LETTERS = 'абвгдежзиклмнопрстуфхцчшщэюя';
// следующая буквенная часть: '' → 'а', 'а' → 'б', 'я' → 'аа', 'аа' → 'аб' (как нумерация столбцов в таблице)
export const nextSuffix = (s) => {
  if (!s) return LETTERS[0];
  const a = [...s].map(ch => LETTERS.indexOf(ch)); if (a.some(i => i < 0)) throw new Error('в версии допустимы только строчные русские буквы без ё, й, ъ, ы, ь: ' + s);
  let i = a.length - 1; while (i >= 0) { if (a[i] < LETTERS.length - 1) { a[i]++; return a.map(k => LETTERS[k]).join(''); } a[i] = 0; i--; }
  return LETTERS[0] + a.map(k => LETTERS[k]).join('');
};
export const nextVersion = (v) => { const m = String(v).match(/^(\d+\.\d+\.\d+)([а-я]*)$/); if (!m) throw new Error('неверный формат версии: ' + v); return m[1] + nextSuffix(m[2]); };
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const src = fs.readFileSync(FILE, 'utf8'); const cur = (src.match(/APP_VERSION = '([^']+)'/) || [])[1];
  if (!cur) { console.error('bump-version: не найдена APP_VERSION в ' + FILE); process.exit(1); }
  if (process.argv.includes('--check')) { console.log(cur); process.exit(0); }
  if (process.argv.includes('--staged')) { try { const staged = execSync('git diff --cached --name-only', { cwd: path.dirname(FILE), encoding: 'utf8' }); if (staged.split('\n').some(f => f.endsWith('src/content/version.js'))) { console.log('bump-version: версия уже в коммите (' + cur + '), пропускаю'); process.exit(0); } } catch (e) {} }
  const next = nextVersion(cur); fs.writeFileSync(FILE, src.replace(`APP_VERSION = '${cur}'`, `APP_VERSION = '${next}'`)); console.log('версия ' + cur + ' → ' + next);
}
