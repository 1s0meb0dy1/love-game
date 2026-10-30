// Знайомство з грою («сторіс»): показується лише новому гостю без сесії на привітанні; не показується тим, хто прийшов за запрошенням,
// має сесію, відкрив документ чи вже бачив історії. Гортання торканням, клавішами й самостійно; пауза; «Почати» і хрестик закривають назавжди.
const makeEnv = require('../harness.js');
const res = []; const T = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n); const errs = [];
const PROFILE = { sessionId: 'K7M2Q9XA', sessionKey: 'AbCdEfGhIjKlMnOpQrStUv', players: [{ id: 'p1', name: 'Макс', gender: 'guy' }, { id: 'p2', name: 'Аня', gender: 'girl' }], archivedIds: [], disabledIds: [], savedGame: null, updatedAt: Date.now() };

// ms — тривалість однієї історії (у застосунку 6,5 с; у тесті коротше), reduce — «зменшення руху» в системі
const boot = async (hash, { lang = 'ru', profile = null, seen = false, ms = 0, reduce = false } = {}) => {
  const E = makeEnv({ intro: true, lang }); const { w } = E;
  if (seen) w.localStorage.setItem('askme_intro_seen_v1', '1');
  if (profile) w.localStorage.setItem('askme_device_profile_v4', JSON.stringify(profile));
  if (reduce) w.matchMedia = (q) => ({ matches: /reduce/.test(String(q)), media: String(q), addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  w.history.replaceState(null, '', '/love-game/' + hash);
  const code = ms ? E.code.replace('const INTRO_MS = 6500;', 'const INTRO_MS = ' + ms + ';') : E.code;
  if (ms && code === E.code) throw new Error('не знайдено INTRO_MS у коді');
  w.eval(code); await E.sleep(1500);
  const D = E.D; const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
  const intro = () => D.querySelector('.intro[role="dialog"]');
  const title = () => norm((D.querySelector('.intro-title') || {}).textContent);
  const tap = async (el, wait = 250) => { if (!el) throw new Error('нет элемента'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await E.sleep(wait); };
  const key = async (k, wait = 250) => { D.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true })); await E.sleep(wait); };
  return Object.assign(E, { intro, title, tap, key, norm, seenFlag: () => w.localStorage.getItem('askme_intro_seen_v1') });
};
const done = (E) => { errs.push(...E.errors); E.w.close(); };

(async () => {
  try {
    let A = await boot('#/');
    T('новий гість без сесії: одразу відкривається вікно знайомства (діалог з aria-modal), шість смужок прогресу', !!A.intro() && A.intro().getAttribute('aria-modal') === 'true' && A.D.querySelectorAll('.intro-bars i').length === 6);
    T('вікно винесене в body (поверх верхньої панелі комп\'ютерної версії), а не всередині #root', A.intro().parentElement === A.D.body);
    T('перша історія: заголовок, підзаголовок і текст російською, кнопка «Начать» та хрестик «Закрыть»', A.title() === 'Разговоры, которых вам не хватало' && !!A.D.querySelector('.intro-kicker') && [...A.intro().querySelectorAll('button')].some(b => A.norm(b.textContent) === 'Начать') && !!A.intro().querySelector('button[aria-label="Закрыть"]'));
    T('для читалок: номер історії «История 1 из 6» і область aria-live', A.norm(A.D.querySelector('.intro-body .sr-only').textContent).startsWith('История 1 из 6') && A.D.querySelector('.intro-body').getAttribute('aria-live') === 'polite');
    T('під вікном привітання ще немає (воно з\'явиться після закриття)', !A.has('Добро пожаловать'));
    await A.tap(A.D.querySelector('.intro-zone.is-next'));
    T('торкання праворуч — наступна історія («Три глубины»), перша смужка заповнена', A.title() === 'От лёгкого — к искреннему' && A.D.querySelector('.intro-bars i:first-child b').classList.contains('is-done') && A.D.querySelectorAll('.ia-card').length === 3);
    await A.tap(A.D.querySelector('.intro-zone.is-prev'));
    T('торкання ліворуч — назад до першої', A.title() === 'Разговоры, которых вам не хватало');
    await A.key('ArrowRight'); await A.key('ArrowRight');
    T('клавіша → гортає: третя історія — жереб із п\'ятьма гравцями й «Отвечает Соня»', A.title() === 'Жребий решает, кто отвечает' && A.D.querySelectorAll('.ia-av').length === 5 && A.norm(A.D.querySelector('.ia-turn-name').textContent) === 'Отвечает Соня');
    await A.key('ArrowLeft');
    T('клавіша ← — назад', A.title() === 'От лёгкого — к искреннему');
    for (let k = 0; k < 8; k++) await A.key('ArrowRight', 60);
    T('гортання не виходить за останню історію: «Вечер начинается здесь», кнопки паузи вже немає', A.title() === 'Вечер начинается здесь' && !A.intro().querySelector('button[aria-label="Пауза"]') && !!A.D.querySelector('.intro-cta .btn-primary.is-final'));
    await A.key('Escape', 400);
    T('Esc закриває: вікна немає, видно привітання з формою «Создать сессию», позначка «бачив» збережена', !A.intro() && A.has('Добро пожаловать') && A.has('Создать сессию') && A.seenFlag() === '1');
    const replay = [...A.D.querySelectorAll('button')].find(b => A.norm(b.textContent) === 'Как играть — за 30 секунд');
    T('на привітанні є тиха кнопка «Как играть — за 30 секунд» (btn-text)', !!replay && /btn-text/.test(replay.className));
    await A.tap(replay, 300);
    T('вона знову відкриває історії з першої', !!A.intro() && A.title() === 'Разговоры, которых вам не хватало');
    await A.tap([...A.intro().querySelectorAll('button')].find(b => A.norm(b.textContent) === 'Начать'), 400);
    T('«Начать» закриває історії й веде до створення сесії (вкладка «Новая игра»)', !A.intro() && A.has('Создать сессию') && !!A.D.querySelector('input[placeholder="Игрок 1"]'));
    done(A);

    // повторний візит: уже бачив — одразу привітання
    A = await boot('#/', { seen: true });
    T('хто вже бачив історії, наступного разу потрапляє одразу на привітання', !A.intro() && A.has('Добро пожаловать'));
    done(A);

    // самостійне гортання і пауза
    A = await boot('#/', { ms: 1200 }); // boot чекає 1,5 с: перша історія вже минула, друга йде
    T('історії гортаються самі: за час однієї — вже друга', A.title() === 'От лёгкого — к искреннему');
    const pause = A.intro().querySelector('button[aria-label="Пауза"]');
    await A.tap(pause, 30);
    T('кнопка паузи: aria-pressed і підпис «Продолжить показ»', !!A.intro().querySelector('button[aria-label="Продолжить показ"][aria-pressed="true"]'));
    await A.sleep(1500);
    T('на паузі історія не перемикається', A.title() === 'От лёгкого — к искреннему');
    await A.key(' ', 50); await A.sleep(1300);
    T('пробіл знімає паузу — показ іде далі', A.title() === 'Жребий решает, кто отвечает');
    await A.tap(A.intro().querySelector('button[aria-label="Закрыть"]'), 400);
    T('хрестик закриває й запам\'ятовує', !A.intro() && A.seenFlag() === '1');
    done(A);

    // «зменшення руху»: без автогортання і без кнопки паузи
    A = await boot('#/', { ms: 300, reduce: true });
    await A.sleep(800);
    T('при «зменшенні руху» історії самі не гортаються, кнопки паузи немає', !!A.intro() && A.title() === 'Разговоры, которых вам не хватало' && !A.intro().querySelector('button[aria-label="Пауза"]'));
    done(A);

    // не показуємо: запрошення, стара ссилка-запрошення, документи, наявна сесія
    A = await boot('#/join?sid=K7M2Q9XA&key=AbCdEfGhIjKlMnOpQrStUv');
    T('гість, що прийшов за посиланням-запрошенням (#/join), історій не бачить — одразу сторінка підключення', !A.intro() && A.w.location.hash === '#/join');
    done(A);
    A = await boot('#/welcome?sid=K7M2Q9XA&key=AbCdEfGhIjKlMnOpQrStUv');
    T('стара ссилка-запрошення (#/welcome?sid=…&key=…) — теж без історій', !A.intro());
    done(A);
    A = await boot('#/privacy');
    T('прямий перехід на документ (#/privacy) — без історій', !A.intro() && !!A.D.querySelector('h1'));
    done(A);
    A = await boot('#/', { profile: PROFILE });
    T('гравець із сесією історій не бачить, а позначку «бачив» отримує (щоб не побачити після виходу з сесії)', !A.intro() && A.seenFlag() === '1');
    done(A);

    // українська (за замовчуванням)
    A = await boot('#/', { lang: 'uk' });
    T('українською: «Розмови, яких вам бракувало», кнопка «Почати», хрестик «Закрити»', A.title() === 'Розмови, яких вам бракувало' && [...A.intro().querySelectorAll('button')].some(b => A.norm(b.textContent) === 'Почати') && !!A.intro().querySelector('button[aria-label="Закрити"]'));
    done(A);
  } catch (e) { T('сценарій виконався без винятків: ' + (e && e.stack), false); }
  console.log(res.join('\n')); console.log('--- captured runtime errors: ' + errs.length); errs.slice(0, 5).forEach(e => console.log(e));
  process.exit(res.some(l => l.startsWith('FAIL')) || errs.length ? 1 : 0);
})();
