// «Об игре» и юридические страницы: открываются без сессии по прямой ссылке, показывают то, что лежит в src/content/*.js,
// интерактив работает (глубина вопроса, фильтр возможностей, аккордеоны, «Поделиться»), ссылки в меню и подвале есть и не бросаются в глаза.
const path = require('path'); const fs = require('fs');
const makeEnv = require('../harness.js');
const root = path.join(__dirname, '../..');
const load = (n, exp) => new Function(fs.readFileSync(path.join(root, 'src/content', n + '.js'), 'utf8').replace(/^export /gm, '') + '; return ' + exp + ';')();
const ABOUT = load('about', 'ABOUT'), LEGAL = load('legal', 'LEGAL');
const norm = (s) => String(s).replace(/\s+/g, ' ').trim();
const res = []; const T = (n, ok) => res.push((ok ? 'PASS ' : 'FAIL ') + n); const allErrors = [];
const PROFILE = { sessionId: 'K7M2Q9XA', sessionKey: 'AbCdEfGhIjKlMnOpQrStUv', players: [{ id: 'p1', name: 'Макс', gender: 'guy' }, { id: 'p2', name: 'Аня', gender: 'girl' }], archivedIds: [], disabledIds: [], savedGame: null, updatedAt: Date.now() };

// запускает приложение сразу на нужной странице (как по общей ссылке), с сессией или без
const boot = async (hash, withProfile) => {
  const A = makeEnv(); const { w, sleep, D } = A;
  if (withProfile) w.localStorage.setItem('askme_device_profile_v4', JSON.stringify(PROFILE));
  w.history.replaceState(null, '', '/love-game/' + hash);
  const copied = []; Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async (t) => { copied.push(t); } }, configurable: true });
  w.eval(A.code); await sleep(1800);
  const c = async (el, ms = 300) => { if (!el) throw new Error('нет элемента'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await sleep(ms); };
  const go = async (h) => { w.location.hash = h; w.dispatchEvent(new w.HashChangeEvent('hashchange')); await sleep(400); };
  const mainBtn = (t) => [...D.querySelectorAll('main button')].find(b => b.textContent.trim() === t);
  return Object.assign(A, { copied, c, go, mainBtn });
};

(async () => { let A; try {
  // ---------- «Об игре» без сессии ----------
  A = await boot('#/about', false); let { w, D, sleep, has, c, copied, mainBtn } = A;
  const aboutMain = () => D.querySelector('main.about-page');
  T('«Об игре» открывается по прямой ссылке без сессии: заголовок, вкладка и адрес', D.title === 'Об игре — ASK ME' && w.location.hash === '#/about' && !!aboutMain() && D.querySelector('h1').textContent === 'Об игре');
  T('герой: заголовок и подзаголовок из файла содержимого, кнопка «' + ABOUT.hero.cta + '»', has(ABOUT.hero.title) && has(ABOUT.hero.lead) && !!mainBtn(ABOUT.hero.cta));
  T('в тексте страницы не осталось неподставленных {заготовок}', !/\{[a-z]+(#[^}]*)?\}/.test(aboutMain().textContent));
  const nums = [...D.querySelectorAll('.about-num-v')].map(e => e.textContent), labels = [...D.querySelectorAll('.about-num-l')];
  T('цифры подставлены из базы: вопросов ' + A.qCount + ', тем 14, уровней 3, игроков 10 (получено ' + nums.join('/') + ')', nums[0] === String(A.qCount) && nums[1] === '14' && nums[2] === '3' && nums[3] === '10' && labels.length === ABOUT.numbers.length);
  T('шаги «Как это работает»: ' + ABOUT.steps.length + ' пункта по порядку, с номерами', D.querySelectorAll('.about-steps li').length === ABOUT.steps.length && [...D.querySelectorAll('.about-step-n')].map(e => e.textContent).join('') === ABOUT.steps.map((_, i) => i + 1).join(''));

  // демо-вопрос: ровно 9 примеров — по 3 на каждую глубину
  const tabs = () => [...D.querySelectorAll('[aria-label="Глубина вопроса"] [role="tab"]')]; const shown = () => norm(D.querySelector('.about-q p').textContent);
  const nextBtn = () => D.querySelector('.about-page .btn-secondary'); const counter = () => norm(D.querySelector('.about-q').nextElementSibling.textContent);
  const clean = (q) => norm(q.text.replace(/^№\s*\d+\.\s*/, ''));
  const intimacy = new Set(Object.values(A.exp).filter(q => q.categoryId === 'intimacy').map(clean));
  const byLevel = (lv) => new Set(Object.values(A.exp).filter(q => q.level === lv && q.categoryId !== 'intimacy').map(clean));
  T('демо: три вкладки глубины, выбрана первая, вопрос показан', tabs().length === 3 && tabs()[0].getAttribute('aria-selected') === 'true' && shown().length > 10);
  let okLevel = true, okIntim = true, okCycle = true, okCount = true, okReal = true; const seen = new Set();
  for (const [i, lv] of ['Простые', 'Средние', 'Глубокие'].entries()) {
    await c(tabs()[i], 200); okLevel = okLevel && tabs()[i].getAttribute('aria-selected') === 'true' && D.querySelector('.about-q').className.includes('lvl-' + (i + 1));
    const row = [];
    for (let k = 0; k < 4; k++) { row.push(shown()); okCount = okCount && counter() === (k % 3 + 1) + ' / 3'; await c(nextBtn(), 120); }
    row.forEach(q => { seen.add(q); if (intimacy.has(q)) okIntim = false; if (!byLevel(lv).has(q)) okReal = false; });
    okCycle = okCycle && new Set(row.slice(0, 3)).size === 3 && row[3] === row[0] && row.slice(0, 3).join('|') === ABOUT.demo.examples[lv].map(norm).join('|');
  }
  T('демо: у каждой глубины свой цвет карточки, у вкладки аккуратно выбран уровень', okLevel);
  T('демо: у каждой глубины ровно 3 примера по порядку, четвёртое нажатие возвращает к первому, под карточкой «1 / 3»…«3 / 3»', okCycle && okCount);
  T('демо: всего 9 разных примеров (получено ' + seen.size + ')', seen.size === 9);
  T('демо: это настоящие вопросы из базы игры именно этой глубины', okReal);
  T('демо: вопросы из темы «Интим» не показываются на публичной странице', okIntim);
  await c(tabs()[1], 150); await c(nextBtn(), 100); await c(tabs()[2], 150); await c(tabs()[1], 150);
  T('демо: при смене вкладки показ начинается с первого примера этой глубины', shown() === norm(ABOUT.demo.examples['Средние'][0]) && counter() === '1 / 3');
  await c(tabs()[0], 150);

  // возможности: фильтр и раскрытие
  const featRows = () => [...D.querySelectorAll('[aria-labelledby="about-feat"] .about-acc-item .row')];
  const chips = () => [...D.querySelectorAll('[aria-label="Категории возможностей"] [role="tab"]')];
  T('возможности: показаны все ' + ABOUT.features.length + ', чипы-фильтры по группам (' + chips().map(x => x.textContent).join(', ') + ')', featRows().length === ABOUT.features.length && chips().length === ABOUT.featureGroups.length && chips()[0].getAttribute('aria-selected') === 'true');
  let okFilter = true; for (const g of ABOUT.featureGroups.slice(1)) { await c(chips().find(x => x.textContent === g.label), 150); okFilter = okFilter && featRows().length === ABOUT.features.filter(f => f.group === g.id).length && featRows().length > 0; }
  T('фильтр по группе оставляет только её возможности', okFilter);
  await c(chips()[0], 150); const f0 = featRows()[0]; const before = !D.querySelector('[aria-labelledby="about-feat"] .about-more') && f0.getAttribute('aria-expanded') === 'false';
  await c(f0, 200); const opened = featRows()[0].getAttribute('aria-expanded') === 'true' && !!D.querySelector('[aria-labelledby="about-feat"] .about-more') && norm(D.querySelector('[aria-labelledby="about-feat"] .about-more').textContent).length > 30;
  await c(featRows()[0], 200); const closed = !D.querySelector('[aria-labelledby="about-feat"] .about-more');
  T('возможность раскрывается по нажатию (aria-expanded + подробный текст) и сворачивается обратно', before && opened && closed);
  await c(featRows()[0], 150); await c(featRows()[1], 150); T('одновременно раскрыта только одна возможность', D.querySelectorAll('[aria-labelledby="about-feat"] .about-more').length === 1);
  const faqRows = () => [...D.querySelectorAll('[aria-labelledby="about-faq"] .row')]; const nFaq = faqRows().length; await c(faqRows()[0], 200); const fa = D.querySelector('[aria-labelledby="about-faq"] .about-more');
  T('FAQ: ' + ABOUT.faq.length + ' вопросов, ответ раскрывается по нажатию', nFaq === ABOUT.faq.length && !!fa && norm(fa.textContent).length > 5 && !/\{/.test(fa.textContent));
  T('блок «Режим «Правда или действие»» показывает все пункты, а «Чем отличается» — свои', D.querySelectorAll('section[aria-labelledby="about-tod"] .about-card').length === ABOUT.todSection.items.length && has(ABOUT.todSection.title));
  T('блок «Чем отличается» показывает все пункты', D.querySelectorAll('section[aria-labelledby="about-uniq"] .about-card').length === ABOUT.unique.items.length);
  T('внизу видна версия и дата страницы из файла', has('Версия страницы ' + ABOUT.version) && has(ABOUT.updated));

  // поделиться
  await c(D.querySelector('[aria-label="Поделиться страницей"]'), 400);
  T('«Поделиться» копирует прямую ссылку на #/about (без секретов)', copied.length === 1 && /\/love-game\/#\/about$/.test(copied[0]) && !/key=|sid=/.test(copied[0]));

  // кнопка героя без сессии ведёт на создание сессии
  await c(mainBtn(ABOUT.hero.cta), 700);
  T('без сессии «' + ABOUT.hero.cta + '» ведёт на создание сессии', D.title === 'ASK ME — начните игру' && w.location.hash === '#/welcome');
  T('на странице создания сессии внизу есть спокойные ссылки на «Об игре», политику и соглашение', ['#/about', '#/privacy', '#/terms'].every(h => !!D.querySelector('nav.footer-links a[href="' + h + '"]')));
  allErrors.push(...A.errors); w.close();

  // ---------- с сессией ----------
  A = await boot('#/about', true); ({ w, D, sleep, has, c, copied, mainBtn } = A);
  T('с сессией на странице «Об игре» кнопка называется «' + ABOUT.hero.ctaHave + '»', !!mainBtn(ABOUT.hero.ctaHave) && !mainBtn(ABOUT.hero.cta));
  await c(mainBtn(ABOUT.hero.ctaHave), 700);
  T('и возвращает в главное меню игры', D.title.startsWith('ASK ME — откровенные') && w.location.hash === '#/');
  const foot = [...D.querySelectorAll('nav.footer-links a')]; const fh = foot.map(a => a.getAttribute('href'));
  T('в подвале главного экрана — тихие ссылки: Об игре, Конфиденциальность, Соглашение (' + foot.map(a => a.textContent).join(', ') + ')', ['#/about', '#/privacy', '#/terms'].every(h => fh.includes(h)) && foot.every(a => !/btn|row/.test(a.className)));
  T('ссылки подвала мелкие и приглушённые (правило .footer-links a: 13px, цвет --text-3, без кнопочного вида)', /\.footer-links a[^{]*\{[^}]*font-size: 0\.8125rem[^}]*color: var\(--text-3\)/.test(A.html));
  await A.go('#/more');
  T('в меню есть пункт «Об игре» среди разделов', D.title === 'Меню — ASK ME' && [...D.querySelectorAll('main button')].some(b => /Об игре/.test(b.textContent) && /Что умеет/.test(b.textContent)));
  const nav = D.querySelector('nav.legal-links-row'); const menuLinks = nav ? [...nav.querySelectorAll('a')].map(a => a.getAttribute('href')) : [];
  T('в меню внизу — все 4 документа (' + menuLinks.join(' ') + ')', menuLinks.length === LEGAL.order.length && ['#/privacy', '#/terms', '#/cookies', '#/age'].every(h => menuLinks.includes(h)));
  const exitBtn = [...D.querySelectorAll('main button')].find(b => /Выйти из сессии/.test(b.textContent));
  T('ссылки документов — самый последний блок меню, ниже «Выйти из сессии»; мелкий текст без рамок и заливки', !!nav && !!exitBtn && !!(exitBtn.compareDocumentPosition(nav) & 4) && !/btn|row/.test(nav.querySelector('a').className) && /\.legal-links-row a[^{]*\{[^}]*font-size: 0\.8125rem/.test(A.html));
  T('обычный игрок не видит ни слова об админском доступе в меню', !/владел|админ/i.test(D.querySelector('main').textContent));
  allErrors.push(...A.errors); w.close();

  // ---------- юридические страницы ----------
  A = await boot('#/privacy', false); ({ w, D, sleep, c } = A);
  const ids = { privacy: '#/privacy', terms: '#/terms', cookies: '#/cookies', age: '#/age', copyright: '#/copyright' };
  T('политика открывается по прямой ссылке без сессии', D.title === LEGAL.docs.privacy.title + ' — ASK ME' && D.querySelector('h1').textContent === LEGAL.docs.privacy.title);
  for (const id of LEGAL.order) {
    await A.go(ids[id]); const doc = LEGAL.docs[id], page = D.querySelector('main.legal-doc'), txt = norm(page.textContent);
    const okTitle = D.querySelector('h1').textContent === doc.title && D.title === doc.title + ' — ASK ME' && w.location.hash === ids[id];
    const okSec = [...page.querySelectorAll('section h2')].map(h => h.textContent).join('|') === doc.sections.map(s => s.h.replace(/\s*\*$/, '')).join('|');
    const noJunk = !/\{(contact|operator)\}/.test(txt) && [...page.querySelectorAll('h2')].every(h => !/\*/.test(h.textContent)) && !/@/.test(txt) && txt.includes(LEGAL.updatedHuman) && txt.includes(norm(doc.lead));
    const others = [...page.querySelectorAll('nav.legal-others a')].map(a => a.getAttribute('href'));
    const okOthers = others.length === LEGAL.order.length - 1 && !others.includes(ids[id]) && LEGAL.order.filter(x => x !== id).every(x => others.includes(ids[x]));
    T('«' + doc.title + '»: заголовок, ' + doc.sections.length + ' разделов, дата, без служебных заготовок, звёздочек в заголовках и адресов почты; ссылки на остальные документы', okTitle && okSec && noJunk && okOthers);
  }
  await A.go('#/privacy'); const links = [...D.querySelectorAll('main.legal-doc a.legal-link')];
  T('контакт — публичная страница обращений GitHub; ссылка открывается в новой вкладке безопасно', links.length >= 1 && links.every(x => x.getAttribute('href') === LEGAL.contact.url && x.target === '_blank' && /noopener/.test(x.rel)) && /^https:\/\/github\.com\//.test(LEGAL.contact.url));
  T('название оператора подставлено в текст политики', norm(D.querySelector('main.legal-doc').textContent).includes(LEGAL.operator));
  const firstOther = D.querySelector('nav.legal-others a'); const wantHash = firstOther.getAttribute('href'); await c(firstOther, 500);
  T('переход по ссылке на соседний документ работает (' + wantHash + ')', w.location.hash === wantHash && D.title !== LEGAL.docs.privacy.title + ' — ASK ME');
  await c(D.querySelector('[aria-label="Назад"]'), 700); T('«Назад» без сессии ведёт на создание сессии', D.title === 'ASK ME — начните игру');
  allErrors.push(...A.errors); w.close();

  console.log(res.join('\n')); console.log('--- captured runtime errors:', allErrors.length); allErrors.slice(0, 6).forEach(e => console.log(' ', e)); process.exit(0);
 } catch (err) { console.log(res.join('\n')); console.log('TEST CRASH:', err.stack.split('\n').slice(0, 3).join(' | '), '|', A && A.D.title, A && A.D.body.textContent.replace(/\s+/g, ' ').slice(0, 200)); process.exit(1); } })();
