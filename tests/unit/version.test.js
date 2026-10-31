// Версия приложения (src/content/version.js) и скрипт подъёма scripts/bump-version.mjs: формат, порядок букв, перенос после «я».
const fs = require('fs'); const path = require('path');
const res = []; const T = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
(async () => {
  try {
    const { nextSuffix, nextVersion, LETTERS } = await import('../../scripts/bump-version.mjs');
    const { APP_VERSION, appVersionLabel } = await import('../../src/content/version.js');
    const src = fs.readFileSync(path.join(__dirname, '../../src/content/version.js'), 'utf8');
    const cur = (src.match(/APP_VERSION = '([^']+)'/) || [])[1];
    T('версия записана в src/content/version.js в формате 0.1.29а (числа и русская буква)', /^\d+\.\d+\.\d+[а-я]+$/.test(cur || ''));
    T('буквы идут по алфавиту без ё, й, ъ, ы, ь (28 букв)', LETTERS === 'абвгдежзиклмнопрстуфхцчшщэюя' && LETTERS.length === 28);
    T('следующая буква: а → б, б → в, к → л', nextSuffix('а') === 'б' && nextSuffix('б') === 'в' && nextSuffix('к') === 'л');
    T('после «я» — «аа», потом «аб»; «ая» → «ба»', nextSuffix('я') === 'аа' && nextSuffix('аа') === 'аб' && nextSuffix('ая') === 'ба' && nextSuffix('яя') === 'ааа');
    T('без буквы начинается с «а»', nextSuffix('') === 'а');
    T('числа не меняются: 0.1.29а → 0.1.29б, 2.7.103я → 2.7.103аа', nextVersion('0.1.29а') === '0.1.29б' && nextVersion('2.7.103я') === '2.7.103аа');
    T('неверный формат отклоняется', (() => { try { nextVersion('1.0'); return false; } catch (e) { return true; } })() && (() => { try { nextSuffix('Ы'); return false; } catch (e) { return true; } })());
    T('в английском интерфейсе буква версии латиницей, в украинском и русском — как есть', appVersionLabel('0.1.29а', 'en') === '0.1.29a' && appVersionLabel('0.1.29б', 'en') === '0.1.29b' && appVersionLabel('0.1.29а', 'uk') === '0.1.29а' && appVersionLabel('0.1.29я', 'ru') === '0.1.29я' && !/[а-я]/.test(appVersionLabel(APP_VERSION, 'en')));
    T('для каждой буквы алфавита версии есть латинская запись', [...LETTERS].every(ch => /^[a-z]+$/.test(appVersionLabel('1.1.1' + ch, 'en').slice(5))));
    const app = fs.readFileSync(path.join(__dirname, '../../src/app.jsx'), 'utf8');
    T('приложение показывает версию в подвале (мобильном и компьютерном)', /import \{ APP_VERSION, appVersionLabel \} from '\.\/content\/version\.js'/.test(app) && (app.match(/Версия \{v0\}", \{ v0: appVersionLabel\(APP_VERSION, getLang\(\)\) \}/g) || []).length === 2);
    const hook = fs.readFileSync(path.join(__dirname, '../../.githooks/pre-commit'), 'utf8');
    T('хук pre-commit поднимает версию и добавляет файл в коммит', /bump-version\.mjs --staged/.test(hook) && /git add src\/content\/version\.js/.test(hook));
  } catch (e) { T('сценарий выполнился без исключений: ' + e, false); }
  console.log(res.join('\n')); console.log('--- captured runtime errors: 0'); process.exit(0);
})();
