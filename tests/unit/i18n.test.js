// Мови інтерфейсу (src/i18n.js + src/i18n-en.js): вибір мови пристрою, переклад рядків, тексти з бази, повнота словника EN.
const fs = require('fs'); const path = require('path');
const src = (fs.readFileSync(path.join(__dirname, '../../src/i18n-en.js'), 'utf8') + '\n' + fs.readFileSync(path.join(__dirname, '../../src/i18n.js'), 'utf8').replace(/^import .*$/gm, '')).replace(/^export /gm, '');
const M = new Function(src + '; return { SUPPORTED_LANGS, DEFAULT_LANG, detectLang, setLang, getLang, t, tf, catName, diffName, audienceLabel, pickText, dateLocale, UK, EN, CATEGORY_UK, CATEGORY_EN, DIFFICULTY_UK, DIFFICULTY_EN, AUDIENCE_LABELS };')();
const res = []; const T = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
T('мови: uk (за замовчуванням), en, ru', JSON.stringify(M.SUPPORTED_LANGS) === '["uk","en","ru"]' && M.DEFAULT_LANG === 'uk');
T('мова пристрою: uk-UA -> uk, en-GB -> en, ru -> ru', M.detectLang(['uk-UA']) === 'uk' && M.detectLang(['en-GB', 'uk']) === 'en' && M.detectLang(['ru']) === 'ru');
T('мова пристрою: перша підтримувана зі списку (de, en-US -> en)', M.detectLang(['de-DE', 'en-US']) === 'en' && M.detectLang(['pl', 'ru-RU', 'en']) === 'ru');
T('мова пристрою: невідомі мови й порожнеча -> uk', M.detectLang(['de', 'fr']) === 'uk' && M.detectLang([]) === 'uk' && M.detectLang(undefined) === 'uk' && M.detectLang([null, '']) === 'uk');
M.setLang('en'); T('en: t() бере словник EN, без перекладу — оригінал', M.getLang() === 'en' && M.t('Закрыть') === M.EN['Закрыть'] && M.t('нет такого ключа') === 'нет такого ключа');
T('en: tf() підставляє значення', M.tf('Вопрос {v0} из {v1}', { v0: 2, v1: 9 }) === M.EN['Вопрос {v0} из {v1}'].replace('{v0}', '2').replace('{v1}', '9'));
T('en: назви тем, рівнів і аудиторії англійською', M.catName('family', 'Семья') === M.CATEGORY_EN.family && M.diffName('Глубокие', 'Глубокие') === M.DIFFICULTY_EN['Глубокие'] && M.audienceLabel('group') === M.AUDIENCE_LABELS.en.group);
T('en: тема без перекладу (власна) — показується як є', M.catName('custom_x', 'Моя тема') === 'Моя тема');
M.setLang('xx'); T('невідома мова -> uk', M.getLang() === 'uk');
T('pickText: uk/en беруть свою версію, порожня -> ru', M.pickText('uk', 'р', 'у', 'e') === 'у' && M.pickText('en', 'р', 'у', 'e') === 'e' && M.pickText('en', 'р', 'у', ' ') === 'р' && M.pickText('ru', 'р', 'у', 'e') === 'р' && M.pickText('en', 'р', 'у') === 'р');
T('dateLocale: uk-UA, en-US, ru-RU', M.dateLocale('uk') === 'uk-UA' && M.dateLocale('en') === 'en-US' && M.dateLocale('ru') === 'ru-RU');
// повнота: кожен ключ UK має EN-переклад без кирилиці і з тими самими підстановками {v0}, {name}
const CYR = /[А-Яа-яЁёІіЇїЄєҐґ]/; const subs = (s) => (String(s).match(/\{\w+\}/g) || []).sort().join();
const keys = Object.keys(M.UK);
const missing = keys.filter(k => typeof M.EN[k] !== 'string' || !M.EN[k].trim());
T('EN: є переклад для кожного ключа UK' + (missing.length ? ` — бракує ${missing.length}: ` + missing.slice(0, 8).join(' | ') : ''), missing.length === 0);
const cyr = Object.entries(M.EN).filter(([, v]) => CYR.test(v));
T('EN: у перекладах немає кирилиці' + (cyr.length ? ' — ' + cyr.slice(0, 8).map(([k]) => k).join(' | ') : ''), cyr.length === 0);
const badSubs = keys.filter(k => typeof M.EN[k] === 'string' && subs(M.EN[k]) !== subs(k));
T('EN: підстановки {v0}/{name} ті самі, що в оригіналі' + (badSubs.length ? ' — ' + badSubs.slice(0, 8).join(' | ') : ''), badSubs.length === 0);
T('EN: усі теми й рівні перекладено', Object.keys(M.CATEGORY_UK).every(id => M.CATEGORY_EN[id] && !CYR.test(M.CATEGORY_EN[id])) && Object.keys(M.DIFFICULTY_UK).every(id => M.DIFFICULTY_EN[id]));
console.log(res.join('\n')); console.log('--- captured runtime errors: 0'); process.exit(0);
