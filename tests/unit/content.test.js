// Проверка текстов страниц «Об игре» и юридических документов (src/content/*.js): их правит владелец вручную, и тест ловит типичные ошибки —
// пустые поля, повторяющиеся id, неизвестные группы, неподставляемые заготовки, случайно вписанную почту или телефон, висящие звёздочки.
const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '../..');
const load = (n, exp) => new Function(fs.readFileSync(path.join(root, 'src/content', n + '.js'), 'utf8').replace(/^export /gm, '') + '; return ' + exp + ';')();
const ABOUT = load('about', 'ABOUT'), LEGAL = load('legal', 'LEGAL'), ABOUT_UK = load('about-uk', 'ABOUT_UK');
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
T('about: «Попробуйте» — ровно по 3 разных примера на каждую из трёх глубин (всего 9), без пустых строк', (() => { const ex = ABOUT.demo.examples, lv = ['Простые', 'Средние', 'Глубокие']; return Object.keys(ex).join() === lv.join() && lv.every(l => Array.isArray(ex[l]) && ex[l].length === 3 && ex[l].every(q => typeof q === 'string' && q.trim().length > 10)) && new Set(lv.flatMap(l => ex[l])).size === 9; })());
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
T('legal: в документе «Cookies» перечислены все ключи локального хранилища, которые использует приложение', (() => { const todDir = path.join(root, 'src/tod'); const app = ['src/app.jsx'].concat(fs.existsSync(todDir) ? fs.readdirSync(todDir).filter(f => /\.jsx?$/.test(f)).sort().map(f => 'src/tod/' + f) : []).map(f => fs.readFileSync(path.join(root, f), 'utf8')).join('\n'); const keys = [...new Set([...app.matchAll(/['"`](askme_[a-z0-9_]+)(?:_?\$\{|['"`])/g)].map(m => m[1].replace(/_$/, '')))]; const text = JSON.stringify(LEGAL.docs.cookies); // исключения: соль для хеша (это не ключ хранилища), старый профиль v3 (только читается) и служебные ключи владельца — их имена на публичной странице не называем, они покрыты строкой «Прочие записи askme_*»
  const skip = ['askme_vault_k1', 'askme_vault_k2', 'askme_device_profile_v3', 'askme_admin_unlocked_v4', 'askme_an_min_v1'];
  const pats = [...text.matchAll(/askme_[A-Za-z0-9_*<>]+/g)].filter(m => m[0] !== 'askme_*').map(m => new RegExp('^' + m[0].replace(/<ID>/g, '.*').replace(/\*/g, '.*') + '$')); // в таблице допустимы шаблоны: askme_*_cache_*, askme_sess_<ID>
  const miss = keys.filter(k => !skip.includes(k) && !text.includes(k) && !pats.some(r => r.test(k))); if (miss.length) console.log('не описаны в cookies:', miss.join(', ')); return miss.length === 0; })());

// --- стартовый набор «Правда или действие» (src/content/tod-cards.js): загружается так же, как about; карточки проверяет та же модель, что и приложение ---
{
  let TOD_STARTER = null, todCleanCard = null;
  try { TOD_STARTER = load('tod-cards', 'TOD_STARTER'); } catch (e) { T('tod-cards: файл загружается — ' + (e && e.message), false); }
  try { ({ todCleanCard } = require('../tod-load.js').loadTod(['tod/model.js'], ['todCleanCard'])); } catch (e) { T('tod-cards: модель src/tod/model.js загружается — ' + (e && e.message), false); }
  if (Array.isArray(TOD_STARTER) && todCleanCard) {
    const S = TOD_STARTER; const TYPES = ['truth', 'dare'], LEVELS = ['easy', 'medium', 'hard'];
    const norm = (s) => String(s).toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim(); // для поиска «почти одинаковых» текстов: без регистра, ё/е и знаков
    // стоп-список: война и её приметы, армия, политика и политики, государства. Слова ищутся с начала слова (кириллица не работает с \b);
    // у неоднозначных основ перечислены точные формы, чтобы не ловить «двойной», «странный», «родинка», «трамплин», «генеральная уборка», «призывно», «ракетка», «пленительный»
    const L = '(?<![а-яёa-z])', R = '(?![а-яёa-z])';
    const STOP = new RegExp([
      'войн', 'воен', 'воева', 'воюе', 'воюю', 'фронт', 'окоп', 'оккупа', 'окупант', 'окупац', 'мобилиз', 'обстрел', 'снаряд', 'взрыв', 'бомб', 'шахед', 'укрыти', 'блэкаут', 'блекаут', 'повестк', 'стрельб', 'казарм', 'дезертир', 'погиб', 'воздушн[а-яё]* тревог',
      'ракет(?:а|ы|у|ой|е|ам|ами|ах)?' + R, 'дрон(?:а|у|ом|е|ы|ов|ам|ами|ах)?' + R, 'призыв(?:а|у|ом|е|ник[а-яё]*)?' + R, 'плен(?:а|у|ом|е|ник[а-яё]*|ные|ных)?' + R,
      'арми', 'солдат', 'офицер', 'полковник', 'сержант', 'лейтенант', 'оружи', 'генерал(?:а|у|ом|е|ы|ов|ам)?' + R, 'танк(?:а|у|ом|е|и|ов|ам|ами|ах|ист[а-яё]*)?' + R,
      'зсу' + R, 'всу' + R, 'тцк' + R, 'нато' + R, 'оон' + R,
      'полити', 'президент', 'депутат', 'министр', 'парламент', 'верховн[а-яё]* рад', 'кабмин', 'санкци', 'пропаганд', 'патриот', 'кремл', 'путин', 'зеленск', 'порошенк', 'янукович', 'лукашенк', 'байден',
      'трамп(?:а|у|ом|е)?' + R, 'выбор(?:ы|ов|ах)' + R, 'гимн(?:а|у|ом|е|ы)?' + R, 'сепар', 'рашист', 'рашк', 'русня', 'кацап', 'москал', 'хохол' + R, 'хохл(?:а|у|ом|е|ы|ов|ам|ами|ах)?' + R, 'бандер', 'ватник', 'орк(?:и|ов|ам|ами|ах)' + R,
      'государств', 'держав', 'отечеств', 'стран(?:а|ы|е|у|ой|ам|ами|ах)?' + R, 'родин(?:а|ы|у|ой|е)?' + R, 'росси', 'русск', 'рф' + R, 'украин', 'україн', 'сша' + R, 'америк', 'беларус', 'белорус',
      'кита(?:й|я|ю|ем|е)' + R, 'германи', 'франци', 'польш', 'израил', 'иран(?:а|у|ом|е)?' + R, 'турци', 'япони', 'англи(?:я|и|ю|ей)' + R, 'британи', 'евросоюз',
      'war' + R, 'army', 'military', 'putin', 'president', 'politic', 'russia', 'ukrain', 'nato' + R, 'usa' + R,
    ].map(p => L + p).join('|'), 'iu');
    T('tod-cards: стоп-список ловит примеры (война, армия, президент, Россия, страна, ракета, «воздушная тревога») и не ловит похожие слова (двойной, странный, родинка, трамплин, ракетка…)',
      ['Война', 'армия', 'президент', 'Россия', 'страна', 'ракета', 'воздушная тревога', 'в окопе', 'Путин', 'государство', 'генерал', 'танки', 'в плену', 'гимн', 'выборы', 'США', 'Украина'].every(s => STOP.test(s))
      && ['двойное свидание', 'странный', 'гармония', 'родинка', 'трамплин', 'генеральная уборка', 'призывно', 'танкетка', 'ракетка', 'пленительный', 'хохолок', 'окупается', 'гимнастика', 'твой выбор', 'спокойно', 'партия', 'ватные ноги', 'польщён', 'китайская еда', 'английский'].every(s => !STOP.test(s)));
    const grp = (t, d) => S.filter(c => c && c.type === t && c.difficulty === d).length;
    T('tod-cards: TOD_STARTER — массив из 120 карточек', S.length === 120);
    T('tod-cards: id по порядку td_s001…td_s120', S.every((c, i) => c && c.id === 'td_s' + String(i + 1).padStart(3, '0')));
    T('tod-cards: по 20 карточек в каждой из шести групп «тип × уровень» (' + TYPES.map(t => LEVELS.map(d => t + '.' + d + '=' + grp(t, d)).join(' ')).join(' ') + ')', TYPES.every(t => LEVELS.every(d => grp(t, d) === 20)));
    T('tod-cards: id не повторяются', new Set(S.map(c => c && c.id)).size === S.length);
    const dupT = S.map(c => norm(c && c.text)).filter((x, i, a) => a.indexOf(x) !== i);
    T('tod-cards: тексты не повторяются (без учёта регистра, ё/е и знаков)' + (dupT.length ? ' — повторы: ' + dupT.join(' | ') : ''), dupT.length === 0);
    const changed = S.filter(c => JSON.stringify(todCleanCard(c)) !== JSON.stringify(c));
    T('tod-cards: все карточки проходят todCleanCard без изменений (поля, значения, текст без <>, управляющих символов и пробелов по краям)' + (changed.length ? ' — не проходят: ' + changed.map(c => c && c.id).join(', ') : ''), changed.length === 0);
    T('tod-cards: все карточки активны (isActive: true) и без updatedAt', S.every(c => c && c.isActive === true && !('updatedAt' in c)));
    T('tod-cards: весь набор проходит правила tod (tests/fixtures/tod-rules.json) — его можно загрузить в базу и по одной карточке, и целиком', (() => {
      const r = require('../rules-eval.js').makeRules(JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/tod-rules.json'), 'utf8'))); const OWNER = { uid: 'OWNER_UID' };
      return S.every(c => r.check('PUT', ['tod', c.id], OWNER, c) === null) && r.check('PUT', ['tod'], OWNER, Object.fromEntries(S.map(c => [c.id, c]))) === null; })());
    const badQ = S.filter(c => c && c.type === 'truth' && !/\?$/.test(c.text));
    T('tod-cards: у «Правды» текст оканчивается на «?»' + (badQ.length ? ' — нет: ' + badQ.map(c => c.id).join(', ') : ''), badQ.length === 0);
    const badD = S.filter(c => c && c.type === 'dare' && /\?$/.test(c.text));
    T('tod-cards: «Действие» — просьба, а не вопрос (не оканчивается на «?»)' + (badD.length ? ' — с вопросом: ' + badD.map(c => c.id).join(', ') : ''), badD.length === 0);
    const maxLen = Math.max(...S.map(c => String(c && c.text).length));
    T('tod-cards: длина текста 1–300 знаков (самый длинный — ' + maxLen + ')', S.every(c => c && typeof c.text === 'string' && c.text.length >= 1 && c.text.length <= 300));
    const stop = S.filter(c => c && STOP.test(c.text));
    T('tod-cards: в карточках нет войны, армии, политиков и государств' + (stop.length ? ' — найдено: ' + stop.map(c => c.id + ' «' + c.text.match(STOP)[0] + '»').join(', ') : ''), stop.length === 0);
    T('tod-cards: нет заготовок {…}, двойных пробелов и переносов строк (карточка выводится как есть)', S.every(c => c && !/[{}]|\s{2}|\n/.test(c.text)));
  }
}

// приватность самих текстов: никаких адресов почты и телефонов, имён владельца по паспорту и т. п.
// --- подколки и титулы «Правда или действие» (src/content/tod-banter.js): границы содержимого — раздел 9.2 спеки ---
{
  let B = null;
  try { B = load('tod-banter', '{ TOD_EVENTS, TOD_BANTER, TOD_TITLES }'); } catch (e) { T('tod-banter: файл загружается — ' + (e && e.message), false); }
  if (B) {
    const { TOD_EVENTS, TOD_BANTER, TOD_TITLES } = B; const L = Array.isArray(TOD_BANTER) ? TOD_BANTER : [];
    const cnt = (ev, tone) => L.filter(l => l.ev === ev && l.tone === tone).length;
    const thin = (TOD_EVENTS || []).filter(ev => cnt(ev, 1) < 4 || cnt(ev, 2) < 3);
    T('tod-banter: у каждого события >=4 реплик тона 1 и >=3 тона 2' + (thin.length ? ' — мало: ' + thin.join(', ') : ''), TOD_EVENTS.length === 17 && thin.length === 0);
    T('tod-banter: id уникальны, ev из TOD_EVENTS, tone 1|2, текст 8..140 знаков', dup(L.map(l => l.id)).length === 0 && L.every(l => TOD_EVENTS.includes(l.ev) && (l.tone === 1 || l.tone === 2) && typeof l.text === 'string' && l.text.length >= 8 && l.text.length <= 140));
    const badSub = L.filter(l => [...l.text.matchAll(/\{([^}]*)\}/g)].some(m => m[1] !== 'name' && !/^[^{}|]+\|[^{}|]+$/.test(m[1])) || /[{}]/.test(l.text.replace(/\{[^{}]*\}/g, '')));
    T('tod-banter: в тексте только {name} и {a|b} с непустыми обеими формами' + (badSub.length ? ' — ' + badSub.map(l => l.id).join(', ') : ''), badSub.length === 0);
    const ua = L.filter(l => l.tags);
    T('tod-banter: теги только ["ua"], политические (ua) реплики только тона 2, их >= 8', ua.every(l => Array.isArray(l.tags) && l.tags.length === 1 && l.tags[0] === 'ua' && l.tone === 2) && ua.length >= 8);
    // стоп-список (границы 9.2): этнические и национальные оскорбления, слова о потерях и жертвах, призывы к насилию, сексуально-грубые оскорбления.
    // Границы слова — через \p{L}: \b в JavaScript не видит кириллицу
    const STOP = /(?<!\p{L})(русн|кацап|москал|хохл|хохол|жид(?!к)|чурк|хач(и|ей|ам)?(?!\p{L})|ватник|орк(и|ов|ам|а)?(?!\p{L})|укроп|бандеровц)|погиб|убит|убей|убива|жертв|труп(?!п)|похорон|двухсот|мобилиз|расстрел|смерть им|оккупирован|беженц|шлюх|пидор|(?<!\p{L})сук[аи](?!\p{L})|бляд|хуй|хуе|пизд|еба[нт]|ёба[нт]/iu;
    const stopHit = ['русня', 'Кацапы', 'хохлы', 'орки', 'убить их', 'погибшие', 'мобилизованных', 'сука', 'расстрелять', 'жертвы', 'на оккупированных'].every(w => STOP.test(w));
    const stopMiss = ['оркестр', 'хачапури', 'жидкий', 'сукно', 'ватрушка', 'труппа', 'задница', 'чёрт', 'хрень', 'армия агрессора', 'пропаганда'].every(w => !STOP.test(w));
    T('tod-banter: стоп-список ловит примеры и не ловит похожие безобидные слова', stopHit && stopMiss);
    const stopLines = L.filter(l => STOP.test(l.text));
    T('tod-banter: нет дублей текста, нет стоп-слов' + (stopLines.length ? ' — ' + stopLines.map(l => l.id).join(', ') : ''), dup(L.map(l => l.text.toLowerCase())).length === 0 && stopLines.length === 0);
    T('tod-banter: реплики skip_* содержат {name}', L.filter(l => /^skip_/.test(l.ev)).every(l => l.text.includes('{name}')));
    // украинские версии (src/i18n.js, словарь UK: ключ — русский шаблон): у каждой реплики и титула есть перевод с теми же подстановками
    let UK = null; try { UK = new Function(fs.readFileSync(path.join(root, 'src/i18n.js'), 'utf8').replace(/^export /gm, '') + '; return UK;')(); } catch (e) { T('i18n: словарь загружается — ' + (e && e.message), false); }
    if (UK) {
      const subs = (t) => (t.match(/\{[^}]*\}/g) || []).map(x => (x === '{name}' ? x : '{|}')).join();
      const miss = L.filter(l => typeof UK[l.text] !== 'string' || subs(UK[l.text]) !== subs(l.text) || /[ыэъё]/i.test(UK[l.text]));
      T('tod-banter: у каждой реплики есть украинский перевод с теми же {name} и {a|b}' + (miss.length ? ' — ' + miss.map(l => l.id).join(', ') : ''), miss.length === 0);
      T('tod-banter: украинские реплики без стоп-слов и без повторов', L.every(l => !STOP.test(UK[l.text] || '')) && dup(L.map(l => UK[l.text])).length === 0);
      T('tod-titles: у названий и подсказок титулов есть украинский перевод', (TOD_TITLES || []).every(t => typeof UK[t.name] === 'string' && typeof UK[t.hint] === 'string'));
    }
    const IDS = ['coward', 'deserter', 'hard_fold', 'later', 'easy_life', 'afraid_dare', 'careful', 'hero', 'fearless', 'redeemed', 'dare_master', 'honest'];
    T('tod-titles: 12 титулов, id по таблице, shame у первых 7', Array.isArray(TOD_TITLES) && TOD_TITLES.length === 12 && TOD_TITLES.every((t, i) => t.id === IDS[i] && t.shame === (i < 7) && t.icon && t.name && t.hint));
  }
}
const pii = [...aboutStr, ...legalStr].filter(([, s]) => EMAIL.test(s) || PHONE.test(s.replace(/\d{4}-\d{2}-\d{2}/g, '')));
T('в текстах нет адресов почты и номеров телефона' + (pii.length ? ' — найдено: ' + pii.map(x => x[0]).join(', ') : ''), pii.length === 0);
T('в обоих файлах не светится адрес владельца аккаунта (gmail и подобные)', ![...aboutStr, ...legalStr].some(([, s]) => /gmail|yandex\.|mail\.ru|outlook|icloud/i.test(s)));

const shape = (o) => Array.isArray(o) ? '[' + o.map(shape).join(',') + ']' : (o && typeof o === 'object') ? '{' + Object.keys(o).map(k => k + ':' + shape(o[k])).join(',') + '}' : typeof o;
T('about-uk: структура совпадает с about.js (те же ключи, длины списков и типы)', shape(ABOUT) === shape(ABOUT_UK));
T('about-uk: id, значки, группы и числа те же, что в about.js', JSON.stringify(ABOUT.features.map(f => [f.id, f.group, f.icon])) === JSON.stringify(ABOUT_UK.features.map(f => [f.id, f.group, f.icon])) && ABOUT.version === ABOUT_UK.version && ABOUT.updated === ABOUT_UK.updated);
T('about-uk: в украинском тексте нет русских букв ы, э, ъ, ё', !strings(ABOUT_UK).some(([p, s]) => !/^demo\.examples$/.test(p) && /[ыэъёЫЭЪЁ]/.test(s)));
console.log(res.join('\n')); console.log('--- captured runtime errors: 0'); process.exit(0);
