// Кнопка «Пригласить игроков» в шапке экранов начала игры («Выберите режим», «Усложнённый режим») и лимит устройств по числу игроков:
// устройств в одной партии не больше, чем игроков в сессии. Живую проверку лимита (третье устройство при двух игроках) см. в live-lifecycle.test.js.
const makeEnv = require('../harness.js');
const res = []; const T = (n, ok) => res.push((ok ? 'PASS ' : 'FAIL ') + n); const allErrors = [];
const PROFILE = (names) => ({ sessionId: 'K7M2Q9XA', sessionKey: 'AbCdEfGhIjKlMnOpQrStUv', players: names.map((n, i) => ({ id: 'p' + (i + 1), name: n, gender: i % 2 ? 'girl' : 'guy' })), archivedIds: [], disabledIds: [], savedGame: null, joinAt: Date.now(), updatedAt: Date.now() });
const boot = async (hash, names = ['Макс', 'Аня']) => { const A = makeEnv(); const { w, sleep, D } = A; w.localStorage.setItem('askme_device_profile_v4', JSON.stringify(PROFILE(names))); w.history.replaceState(null, '', '/love-game/#' + hash); w.eval(A.code); await sleep(1800);
  const c = async (el, ms = 300) => { if (!el) throw new Error('нет элемента'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await sleep(ms); };
  const share = () => D.querySelector('header [aria-label="Пригласить игроков"]'); return Object.assign(A, { c, share }); };

(async () => { try {
  for (const [hash, title, name] of [['/mode', 'Выберите режим', 'выбор режима'], ['/setup', 'Усложнённый режим', 'усложнённый режим']]) {
    const A = await boot(hash); const { w, D, c, share } = A; const b = share();
    T(name + ': в шапке справа есть кнопка «Пригласить игроков» (иконка, 44 px, как «назад»)', !!b && /btn-icon/.test(b.className) && !!b.querySelector('svg') && b.getAttribute('title') === 'Пригласить игроков' && D.querySelector('header h1').textContent === title);
    T(name + ': кнопка стоит после заголовка (справа), «Назад» — слева', (() => { const hs = [...D.querySelector('header').children]; return hs[0].getAttribute('aria-label') === 'Назад' && hs[hs.length - 1] === b; })());
    await c(b, 500);
    T(name + ': кнопка открывает страницу приглашения (QR и ссылка для этой сессии)', D.title === 'Пригласить игроков — ASK ME' && w.location.hash === '#/invite' && !!D.querySelector('svg.qr-svg'));
    await c(D.querySelector('[aria-label="Назад"]'), 500);
    T(name + ': «Назад» со страницы приглашения возвращает на тот же экран (' + w.location.hash + ')', w.location.hash === (hash === '/mode' ? '#/mode' : '#/setup') && D.querySelector('header h1').textContent === title);
    allErrors.push(...A.errors); w.close();
  }
  // из меню «Назад» ведёт в меню, как раньше; кнопка там — во всю ширину в стиле набора (см. quick-ui)
  { const A = await boot('/more'); const { w, D, c } = A; const b = [...D.querySelectorAll('button')].find(x => /Пригласить игроков/.test(x.textContent)); await c(b, 500); await c(D.querySelector('[aria-label="Назад"]'), 500);
    T('из меню: «Назад» со страницы приглашения возвращает в меню', w.location.hash === '#/more'); allErrors.push(...A.errors); w.close(); }
  // лимит устройств в тексте приглашения: по числу игроков
  for (const [names, cap] of [[['Макс', 'Аня'], 2], [['Макс', 'Аня', 'Ира'], 3], [['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'И', 'К'], 10]]) {
    const A = await boot('/invite', names); const { D } = A; const t = D.querySelector('.invite-page').textContent;
    T('страница приглашения: при ' + names.length + ' игроках сказано «до ' + cap + ' устройств — столько же, сколько игроков»', new RegExp('до ' + cap + ' устройств').test(t) && /сколько игроков в сессии/.test(t)); allErrors.push(...A.errors); A.w.close();
  }
  { const A = await boot('/mode', ['Макс', 'Аня', 'Ира']); T('«Выберите режим»: подсказка про синхронизацию называет лимит по числу игроков (3) и отсылает к кнопке в шапке', /до 3 одновременно/.test(A.D.body.textContent) && /кнопкой в шапке/.test(A.D.body.textContent)); allErrors.push(...A.errors); A.w.close(); }
  console.log(res.join('\n')); console.log('--- captured runtime errors:', allErrors.length); allErrors.slice(0, 6).forEach(e => console.log(' ', e)); process.exit(0);
 } catch (err) { console.log(res.join('\n')); console.log('TEST CRASH:', err.stack.split('\n').slice(0, 3).join(' | ')); process.exit(1); } })();
