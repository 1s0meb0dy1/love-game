import { readFileSync, writeFileSync } from 'node:fs';
const index = process.argv.indexOf('--owner-uid');
const uid = index >= 0 ? process.argv[index + 1] : '';
if (!uid || uid === 'OWNER_UID' || !/^[A-Za-z0-9:_-]{1,128}$/.test(uid)) {
  throw new Error('Укажите UID владельца: npm run rules:render -- --owner-uid <UID>');
}
const source = readFileSync(new URL('../firebase/database.rules.template.json', import.meta.url), 'utf8');
const rendered = source.replaceAll('OWNER_UID', uid);
JSON.parse(rendered);
writeFileSync(new URL('../firebase/database.rules.json', import.meta.url), rendered, { mode: 0o600 });
console.log('Сформирован firebase/database.rules.json. Публикация не выполнялась.');
