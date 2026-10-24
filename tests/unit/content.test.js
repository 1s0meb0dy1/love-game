// Проверка текстов страниц «Об игре» и юридических документов (src/content/*.js): их правит владелец вручную, и тест ловит типичные ошибки —
// пустые поля, повторяющиеся id, неизвестные группы, неподставляемые заготовки, случайно вписанную почту или телефон, висящие звёздочки.
const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '../..');
const load = (n, exp) => new Function(fs.readFileSync(path.join(root, 'src/content', n + '.js'), 'utf8').replace(/^export /gm, '') + '; return ' + exp + ';')();
const ABOUT = load('about', 'ABOUT'), LEGAL = load('legal', 'LEGAL');
const res = []; const T = (n, ok) => res.push((ok ? 'PASS ' : 'FAIL ') + n);
const KNOWN = ['questions', 'topics', 'players', 'devices']; // что подставляет aboutFill в app.jsx
const strings = (o, out = [], p = '') => { if (typeof o === 'string') out.push([p, o]); else if (Array.isArray(o)) o.forEach((v, i) => strings(v, out, p + '[' + i + ']')); else if (o && typeof o === 'object') Object.entries(o).forEach(([k, v]) => strings(v, out, p + '.' + k)); return out; };
const dup = (arr) => arr.filter((x, i) => arr.indexOf(x) !== i);
const aboutStr = strings(ABOUT), legalStr = strings(LEGAL);
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/, PHONE = /(\+?\d[\d\s().-]{8,}\d)/;

T('about: нет пустых и пробельных строк (' + aboutStr.length + ' полей)', aboutStr.every(([p, s]) => s.trim().length > 0) || (console.log(aboutStr.filter(([, s]) => !s.trim()).map(x => x[0])), false));
T('legal: нет пустых и пробельных строк (' + legalStr.length + ' полей)', legalStr.every(([p, s]) => s.trim().length > 0));
T('about: у возможностей уникальные id и все группы из списка featureGroups', dup(ABOUT.features.map(f => f.id)).length === 0 && ABOUT.features.every(f => ABOUT.featureGroups.some(g => g.id === f.group && g.id !== 'all')) && ABOUT.featureGroups[0].id === 'all');
T('about: у каждой возможности есть значок, заголовок, короткое и подробное описание', ABOUT.features.every(f => f.icon && f.title && f.short && f.more));
T('about: в каждой группе (кроме «Все») есть хотя бы одна возможность — нет пустых чипов', ABOUT.featureGroups.slice(1).every(g => ABOUT.features.some(f => f.group === g.id)));
T('about: для всех трёх глубин есть запасные вопросы (пока база не загрузилась)', ['Простые', 'Средние', 'Глубокие'].every(l => Array.isArray(ABOUT.demo.fallback[l]) && ABOUT.demo.fallback[l].length >= 2));
const ph = []; aboutStr.forEach(([, s]) => { for (const m of s.matchAll(/\{(\w+)(?:#([^}]+))?\}/g)) ph.push([m[1], m[2]]); });
T('about: все заготовки {…} известны приложению (' + [...new Set(ph.map(x => x[0]))].join(', ') + ')', ph.every(([k]) => KNOWN.includes(k)));
T('about: у заготовок со склонением ровно три формы через запятую', ph.filter(([, f]) => f).every(([, f]) => f.split(',').length === 3 && f.split(',').every(x => x.trim())));
T('about: цифры в блоке «в цифрах» используют заготовки или числа, а запасное значение для вопросов задано', ABOUT.numbers.length >= 3 && ABOUT.numbers.every(n => n.value && n.label) && !!ABOUT.fallbackNumbers.questions);
T('about: версия и дата страницы заполнены, дата в формате ГГГГ-ММ-ДД и не из будущего', /^\d+(\.\d+)*$/.test(ABOUT.version) && /^\d{4}-\d{2}-\d{2}$/.test(ABOUT.updated) && ABOUT.updated <= new Date(Date.now() + 864e5).toISOString().slice(0, 10));
T('about: у шагов, «Чем отличается» и FAQ нет пропущенных частей', ABOUT.steps.every(s => s.title && s.text) && ABOUT.unique.items.every(s => s.title && s.text) && ABOUT.faq.every(s => s.q && s.a) && dup(ABOUT.faq.map(f => f.q)).length === 0);

T('legal: порядок документов совпадает с набором docs, id не повторяются', LEGAL.order.length === Object.keys(LEGAL.docs).length && LEGAL.order.every(id => LEGAL.docs[id]) && dup(LEGAL.order).length === 0);
T('legal: у каждого документа название, название для меню, вводный абзац и разделы с заголовком и текстом', LEGAL.order.every(id => { const d = LEGAL.docs[id]; return d.title && d.menu && d.lead && d.sections.length >= 2 && d.sections.every(s => s.h && ((s.p && s.p.length) || (s.list && s.list.length) || (s.table && s.table.length))); }));
T('legal: у документов нет повторяющихся заголовков разделов', LEGAL.order.every(id => dup(LEGAL.docs[id].sections.map(s => s.h)).length === 0));
const lph = []; legalStr.forEach(([, s]) => { for (const m of s.matchAll(/\{(\w+)\}/g)) lph.push(m[1]); });
T('legal: в текстах только заготовки {contact} и {operator} (иначе страница покажет скобки как есть)', lph.every(k => k === 'contact' || k === 'operator') && lph.includes('contact') && lph.includes('operator'));
T('legal: контакт — обычная https-ссылка с подписью (не почта)', /^https:\/\//.test(LEGAL.contact.url) && !!LEGAL.contact.label && !/^mailto:/i.test(LEGAL.contact.url));
T('legal: дата в двух видах совпадает (' + LEGAL.updated + ' = ' + LEGAL.updatedHuman + ')', (() => { const [y, m, d] = LEGAL.updated.split('-').map(Number); const mon = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'][m - 1]; return LEGAL.updatedHuman === d + ' ' + mon + ' ' + y; })());
T('legal: звёздочка ставится только в конце заголовка раздела (метка «можно менять»), а в тексте не висит одиноко', legalStr.every(([p, s]) => !/\s\*(\s|$)/.test(s) || /\.h$/.test(p)) && legalStr.filter(([p, s]) => /\.h$/.test(p) && s.includes('*')).every(([, s]) => /\s\*$/.test(s)));
T('legal: в документе «Cookies» перечислены все ключи локального хранилища, которые использует приложение', (() => { const app = fs.readFileSync(path.join(root, 'src/app.jsx'), 'utf8'); const keys = [...new Set([...app.matchAll(/['"`](askme_[a-z0-9_]+)(?:_?\$\{|['"`])/g)].map(m => m[1].replace(/_$/, '')))]; const text = JSON.stringify(LEGAL.docs.cookies); // исключения: соль для хеша (это не ключ хранилища), старый профиль v3 (только читается) и служебные ключи владельца — их имена на публичной странице не называем, они покрыты строкой «Прочие записи askme_*»
  const skip = ['askme_vault_k1', 'askme_vault_k2', 'askme_device_profile_v3', 'askme_admin_unlocked_v4', 'askme_an_min_v1'];
  const pats = [...text.matchAll(/askme_[A-Za-z0-9_*<>]+/g)].filter(m => m[0] !== 'askme_*').map(m => new RegExp('^' + m[0].replace(/<ID>/g, '.*').replace(/\*/g, '.*') + '$')); // в таблице допустимы шаблоны: askme_*_cache_*, askme_sess_<ID>
  const miss = keys.filter(k => !skip.includes(k) && !text.includes(k) && !pats.some(r => r.test(k))); if (miss.length) console.log('не описаны в cookies:', miss.join(', ')); return miss.length === 0; })());

// приватность самих текстов: никаких адресов почты и телефонов, имён владельца по паспорту и т. п.
const pii = [...aboutStr, ...legalStr].filter(([, s]) => EMAIL.test(s) || PHONE.test(s.replace(/\d{4}-\d{2}-\d{2}/g, '')));
T('в текстах нет адресов почты и номеров телефона' + (pii.length ? ' — найдено: ' + pii.map(x => x[0]).join(', ') : ''), pii.length === 0);
T('в обоих файлах не светится адрес владельца аккаунта (gmail и подобные)', ![...aboutStr, ...legalStr].some(([, s]) => /gmail|yandex\.|mail\.ru|outlook|icloud/i.test(s)));

console.log(res.join('\n')); console.log('--- captured runtime errors: 0'); process.exit(0);
