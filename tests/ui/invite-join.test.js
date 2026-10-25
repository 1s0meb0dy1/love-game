// Приглашение и быстрое подключение: страница «Пригласить игроков» (QR + ссылка), страница #/join во всех состояниях
// (новое устройство, та же сессия, другая сессия, сессия не найдена, битая ссылка, старая ссылка #/welcome), секрет не остаётся в адресной строке,
// и «Удалить мои данные» стирает облако и локальное хранилище (а при сбое облака ничего не теряет).
const makeEnv = require('../harness.js'); const nodeCrypto = require('crypto'); const webcrypto = nodeCrypto.webcrypto; const qrcode = require('qrcode-generator');
const res = []; const T = (n, ok) => res.push((ok ? 'PASS ' : 'FAIL ') + n); const allErrors = [];
const SID = 'K7M2Q9XA', KEY = 'AbCdEfGhIjKlMnOpQrStUv', SID2 = 'ZZZZ1111', KEY2 = 'Zz9Yy8Xx7Ww6Vv5Uu4Tt3S';
const PROFILE = (sid, key, names) => ({ sessionId: sid, sessionKey: key, players: names.map((n, i) => ({ id: 'p' + (i + 1), name: n, gender: i % 2 ? 'girl' : 'guy' })), archivedIds: [], disabledIds: [], savedGame: null, updatedAt: Date.now() });
// те же шифр и ключ базы, что в приложении (AES-GCM, 12 байт IV перед шифртекстом, base64url; узел sessions/s_<sha256>)
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); const unb64u = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const encrypt = async (obj, key) => { const iv = webcrypto.getRandomValues(new Uint8Array(12)); const k = await webcrypto.subtle.importKey('raw', unb64u(key), { name: 'AES-GCM' }, false, ['encrypt']); const ct = new Uint8Array(await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(JSON.stringify(obj)))); return b64u(Buffer.concat([Buffer.from(iv), Buffer.from(ct)])); };
const dbKey = (key) => 's_' + nodeCrypto.createHash('sha256').update('askme-session-v1:' + key).digest('hex');
const cloudSession = async (key, names, extra = {}) => ({ payload: await encrypt({ players: PROFILE('X', key, names).players, archivedIds: ['a1', 'a2'], disabledIds: [], savedGame: null, updatedAt: Date.now(), ...extra }, key), updatedAt: Date.now() });

// запускает приложение на нужной странице; store — «облако» узла sessions, log — все запросы к sessions/analytics/live
const boot = async (hash, { profile, store = {}, failDeleteSessions = false, aid, getDelay = 0 } = {}) => {
  const A = makeEnv(); const { w, sleep, D } = A; const log = []; const base = w.fetch;
  w.fetch = async (url, init) => { url = String(url); const method = ((init && init.method) || 'GET').toUpperCase(); const m = url.match(/\/(sessions|analytics\/anon|analytics\/full|live)\/([^?]*?)\.json/); const ok = (o, good = true) => ({ ok: good, status: good ? 200 : 500, json: async () => o, text: async () => JSON.stringify(o) });
    if (!m) return base(url, init); log.push({ method, kind: m[1], path: m[2], body: init && init.body });
    if (m[1] === 'sessions') { if (method === 'GET') { if (getDelay) await sleep(getDelay); return ok(store[m[2]] === undefined ? null : store[m[2]]); } if (method === 'DELETE') { if (failDeleteSessions) return ok(null, false); delete store[m[2]]; return ok(null); } if (failDeleteSessions && JSON.parse(init.body)?.deleted) return ok(null, false); store[m[2]] = JSON.parse(init.body); return ok(store[m[2]]); }
    return base(url, init); };
  if (profile) w.localStorage.setItem('askme_device_profile_v4', JSON.stringify(profile));
  if (aid) w.localStorage.setItem('askme_aid_' + profile.sessionId, aid);
  w.history.replaceState(null, '', '/love-game/' + hash);
  const copied = [], shared = []; Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async (t) => { copied.push(t); } }, configurable: true });
  w.eval(A.code); await sleep(1800);
  const c = async (el, ms = 300) => { if (!el) throw new Error('нет элемента'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await sleep(ms); };
  const btn = (t) => [...D.querySelectorAll('button')].find(b => b.textContent.replace(/\s+/g, ' ').includes(t) && !b.disabled);
  const prof = () => { try { return JSON.parse(w.localStorage.getItem('askme_device_profile_v4')); } catch (e) { return null; } };
  const wait = async (fn, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch (e) {} await sleep(100); } return false; };
  return Object.assign(A, { log, copied, shared, c, btn, prof, wait, store });
};
const finish = (E) => { allErrors.push(...E.errors); E.w.close(); };

(async () => { let A; try {
  // ---------- страница «Пригласить игроков» ----------
  A = await boot('#/more', { profile: PROFILE(SID, KEY, ['Макс', 'Аня']) }); let { w, D, sleep, c, btn, has } = A;
  const invBtn = btn('Пригласить игроков');
  T('в меню кнопка «Пригласить игроков» — обычная кнопка по UI-киту (btn-secondary) на всю ширину, не маленькая (btn-sm)', !!invBtn && /btn-secondary/.test(invBtn.className) && /\bw-full\b/.test(invBtn.className) && !/btn-sm/.test(invBtn.className));
  await c(invBtn, 600);
  T('кнопка ведёт на страницу приглашения: заголовок, вкладка, адрес', D.title === 'Пригласить игроков — ASK ME' && w.location.hash === '#/invite' && D.querySelector('h1').textContent === 'Пригласить игроков');
  const svg = D.querySelector('svg.qr-svg'); const url = 'https://example.test/love-game/#/join?sid=' + SID + '&key=' + KEY;
  const qr = qrcode(0, 'M'); qr.addData(url); qr.make(); const n = qr.getModuleCount(); let d = ''; for (let r = 0; r < n; r++) { let cc = 0; while (cc < n) { if (!qr.isDark(r, cc)) { cc++; continue; } let e = cc; while (e < n && qr.isDark(r, e)) e++; d += `M${cc + 4} ${r + 4}h${e - cc}v1h-${e - cc}z`; cc = e; } }
  T('QR-код нарисован прямо в странице (векторно) и кодирует полную ссылку-приглашение (' + n + '×' + n + ' модулей)', !!svg && svg.getAttribute('role') === 'img' && Number(svg.getAttribute('data-qr-modules')) === n && svg.querySelector('path').getAttribute('d') === d);
  T('на странице нет внешних картинок для QR (ничего не уходит в интернет)', !D.querySelector('main img') && !/api\.qrserver|chart\.googleapis|qr-code-generator/i.test(D.body.innerHTML));
  const shownLink = D.querySelector('.invite-link').textContent; T('на экране ссылка показана с замаскированным ключом, сам ключ не виден', shownLink.includes('sid=' + SID) && !shownLink.includes(KEY) && !D.body.textContent.includes(KEY));
  T('есть предупреждение «Берегите ссылку» и подсказка из трёх шагов', !!D.querySelector('.invite-warn') && /Берегите ссылку/.test(D.querySelector('.invite-warn').textContent) && D.querySelectorAll('.about-steps li').length === 3);
  await c(btn('Скопировать ссылку'), 400);
  T('«Скопировать ссылку» кладёт в буфер полную ссылку #/join?sid=…&key=… и меняет подпись', A.copied[0] === url && /Скопировано/.test(D.body.textContent));
  await c(btn('Поделиться ссылкой'), 400);
  T('«Поделиться ссылкой» без системного меню копирует ту же ссылку', A.copied[1] === url);
  await c(D.querySelector('[aria-label="Назад"]'), 500); T('«Назад» возвращает в меню', D.title === 'Меню — ASK ME');
  // системное меню «Поделиться»
  await c(btn('Пригласить игроков'), 500); let sharedArg = null; w.navigator.share = async (a) => { sharedArg = a; }; await c(btn('Поделиться ссылкой'), 400);
  T('если у телефона есть системное «Поделиться», ссылка уходит в него (с названием игры)', !!sharedArg && sharedArg.url === url && /ASK ME/.test(sharedArg.title));
  finish(A);

  // без сессии страница приглашения недоступна
  A = await boot('#/invite', {}); T('без сессии #/invite не открывается — показан экран создания сессии', A.D.title === 'ASK ME — начните игру'); finish(A);

  // ---------- подключение: новое устройство ----------
  const store = { [dbKey(KEY)]: await cloudSession(KEY, ['Макс', 'Аня']) };
  A = await boot('#/join?sid=' + SID + '&key=' + KEY, { store, getDelay: 700 }); ({ w, D, sleep, c, btn } = A);
  T('новое устройство видит «Вас пригласили» с кодом сессии и кнопками «Присоединиться» / «Что это за игра»', D.title === 'Присоединиться к игре — ASK ME' && /Вас пригласили в ASK ME/.test(D.querySelector('h1').textContent) && /Сессия K7M2Q9XA/.test(D.body.textContent) && !!btn('Присоединиться') && !!btn('Что это за игра'));
  T('секретный ключ сразу убран из адресной строки (остался только #/join)', w.location.hash === '#/join' && !w.location.href.includes(KEY));
  T('страница приглашения без сессии не показывает меню и не просит имена', !D.querySelector('input[type="text"]'));
  await c(btn('Присоединиться'), 100); const busyBtn = [...D.querySelectorAll('main button')].find(b => /Подключаемся/.test(b.textContent)); const getsBefore = A.log.filter(r => r.method === 'GET' && r.kind === 'sessions').length; if (busyBtn) await c(busyBtn, 50);
  T('во время подключения кнопка занята («Подключаемся…»), недоступна и повторное нажатие не шлёт второй запрос', !!busyBtn && busyBtn.disabled && A.log.filter(r => r.method === 'GET' && r.kind === 'sessions').length === getsBefore);
  await A.wait(() => D.title.startsWith('ASK ME — откровенные'), 6000);
  const p1 = A.prof(); T('сессия восстановлена из облака: тот же ID и ключ, имена игроков, архив (' + (p1 && p1.players.map(x => x.name).join('+')) + ')', D.title.startsWith('ASK ME — откровенные') && !!p1 && p1.sessionId === SID && p1.sessionKey === KEY && p1.players.map(x => x.name).join() === 'Макс,Аня' && (p1.archivedIds || []).length === 2);
  T('после подключения ключа нет в адресной строке, показана подтверждающая подсказка', !w.location.href.includes(KEY) && /успешно восстановлена/.test(D.body.textContent));
  T('запрос к облаку шёл по защищённому ключу узла (s_<sha256>), без ключа шифрования и ID в адресе', A.log.some(r => r.method === 'GET' && r.kind === 'sessions' && r.path === dbKey(KEY)) && !A.log.some(r => r.path.includes(KEY)));
  finish(A);

  // ---------- подключение: сессия не найдена ----------
  A = await boot('#/join?sid=' + SID + '&key=' + KEY, { store: {} }); ({ w, D, sleep, c, btn } = A);
  await c(btn('Присоединиться'), 100); await A.wait(() => /Сессия не найдена/.test(D.body.textContent), 6000);
  const al = D.querySelector('[role="alert"]'); T('если сессии в облаке нет — понятная ошибка под кнопкой, остаёмся на странице, кнопка снова нажимается', !!al && /Сессия не найдена/.test(al.textContent) && D.title === 'Присоединиться к игре — ASK ME' && !!btn('Присоединиться') && !A.prof());
  finish(A);

  // ---------- подключение: битая ссылка ----------
  A = await boot('#/join?sid=ABC&key=short', {}); ({ w, D, sleep, c, btn } = A);
  T('обрезанная ссылка: «Ссылка не подошла», нет кнопки «Присоединиться»', /Ссылка не подошла/.test(D.querySelector('h1').textContent) && !btn('Присоединиться') && !!btn('Ввести вручную'));
  await c(btn('Ввести вручную'), 500); T('«Ввести вручную» без сессии открывает вкладку восстановления с полем «Ссылка из игры или ID»', D.title === 'ASK ME — начните игру' && !!D.querySelector('input[placeholder="Ссылка из игры или ID"]'));
  finish(A);
  A = await boot('#/join', {}); T('#/join без параметров — тоже «Ссылка не подошла», а не пустой экран', /Ссылка не подошла/.test(A.D.querySelector('h1').textContent)); finish(A);

  // ---------- подключение: уже в этой сессии / в другой ----------
  A = await boot('#/join?sid=' + SID + '&key=' + KEY, { profile: PROFILE(SID, KEY, ['Макс', 'Аня']), store }); ({ w, D, sleep, c, btn } = A);
  T('та же сессия: «Вы уже в этой сессии» и кнопка «К игре», без «Присоединиться»', /Вы уже в этой сессии/.test(D.querySelector('h1').textContent) && !btn('Присоединиться') && !!btn('К игре'));
  await c(btn('К игре'), 600); T('«К игре» открывает меню, сессия не менялась', D.title.startsWith('ASK ME — откровенные') && A.prof().sessionId === SID); finish(A);

  const store2 = { [dbKey(KEY2)]: await cloudSession(KEY2, ['Ира', 'Олег']) };
  A = await boot('#/join?sid=' + SID2 + '&key=' + KEY2, { profile: PROFILE(SID, KEY, ['Макс', 'Аня']), store: store2 }); ({ w, D, sleep, c, btn } = A);
  T('другая сессия: спрашивает «Перейти в другую сессию?», предупреждает, что прежняя остаётся в облаке', /Перейти в другую сессию/.test(D.querySelector('h1').textContent) && /останется в облаке/.test(D.body.textContent) && !!btn('Остаться в своей сессии'));
  await c(btn('Остаться в своей сессии'), 600); T('«Остаться в своей сессии» — прежний профиль не тронут', D.title.startsWith('ASK ME — откровенные') && A.prof().sessionId === SID && A.prof().players[0].name === 'Макс' && !w.location.href.includes(KEY2)); finish(A);
  A = await boot('#/join?sid=' + SID2 + '&key=' + KEY2, { profile: PROFILE(SID, KEY, ['Макс', 'Аня']), store: store2 }); ({ w, D, sleep, c, btn } = A);
  await c(btn('Присоединиться'), 100); await A.wait(() => A.prof() && A.prof().sessionId === SID2, 6000);
  T('«Присоединиться» переключает устройство на приглашённую сессию (' + (A.prof() && A.prof().players.map(x => x.name).join('+')) + ')', A.prof().sessionId === SID2 && A.prof().sessionKey === KEY2 && A.prof().players.map(x => x.name).join() === 'Ира,Олег'); finish(A);

  // ---------- старая ссылка #/welcome?sid=…&key=… ----------
  A = await boot('#/welcome?sid=' + SID + '&key=' + KEY, {}); ({ w, D } = A);
  const inp = D.querySelector('input[placeholder="Ссылка из игры или ID"]');
  T('старая ссылка на новом устройстве: открыта вкладка «Восстановить», поле заполнено, ключ убран из адреса', !!inp && inp.value.includes('key=' + KEY) && w.location.hash === '#/welcome' && !w.location.href.includes(KEY)); finish(A);
  A = await boot('#/welcome?sid=' + SID2 + '&key=' + KEY2, { profile: PROFILE(SID, KEY, ['Макс', 'Аня']) });
  T('старая ссылка на устройстве с другой сессией ведёт на ту же страницу подключения', /Перейти в другую сессию/.test(A.D.querySelector('h1').textContent)); finish(A);

  // ---------- удаление всех данных ----------
  const st3 = { [dbKey(KEY)]: await cloudSession(KEY, ['Макс', 'Аня']) };
  A = await boot('#/profile', { profile: PROFILE(SID, KEY, ['Макс', 'Аня']), store: st3, aid: 'abc123' }); ({ w, D, sleep, c, btn } = A);
  w.localStorage.setItem('askme_game_settings_v1', '{"x":1}'); w.localStorage.setItem('askme_analytics_v1', '1'); w.localStorage.setItem('askme_seen_topics_v1', '[]'); w.localStorage.setItem('askme_sess_' + SID, '{}');
  await c(btn('Удалить мои данные'), 400); const pop = D.querySelector('.viewport-popup-box');
  T('«Удалить мои данные» сначала спрашивает подтверждение и объясняет, что будет стёрто', !!pop && /Удалить данные этой сессии/.test(pop.textContent) && /без возможности восстановления/.test(pop.textContent) && !!btn('Отмена') && A.log.every(r => r.method !== 'DELETE'));
  await c(btn('Отмена'), 400); T('«Отмена» ничего не удаляет', !D.querySelector('.viewport-popup-box') && A.log.every(r => r.method !== 'DELETE') && !!A.prof() && !!st3[dbKey(KEY)]);
  await c(btn('Удалить мои данные'), 400); const nBefore = A.log.length; await c([...D.querySelectorAll('.viewport-popup-box button')].find(b => b.textContent.trim() === 'Удалить'), 1500);
  const dels = A.log.filter(r => r.method === 'DELETE' || (r.body && JSON.parse(r.body).deleted === true)).map(r => r.kind + '/' + r.path);
  T('удалены: облачная копия сессии и обе записи статистики этого устройства (' + dels.join(', ') + ')', dels.includes('sessions/' + dbKey(KEY)) && dels.includes('analytics/anon/abc123') && dels.includes('analytics/full/abc123') && st3[dbKey(KEY)]?.deleted === true && st3[dbKey(KEY)].payload === '');
  T('данные текущей сессии стёрты, общие настройки устройства сохранены', !A.prof() && !w.localStorage.getItem('askme_sess_' + SID) && !w.localStorage.getItem('askme_aid_' + SID) && !!w.localStorage.getItem('askme_game_settings_v1'));
  T('подсказка об удалении — уведомление «ok» (зелёное, role="status")', !!D.querySelector('.toast.toast-ok[role="status"]') && /Данные этой сессии удалены/.test(D.querySelector('.toast').textContent));
  T('после удаления открыт экран создания сессии и показана подсказка «Данные этой сессии удалены»', D.title === 'ASK ME — начните игру' && /Данные этой сессии удалены/.test(D.body.textContent) && !A.prof());
  finish(A);

  // сбой облака: данные не теряются
  const st4 = { [dbKey(KEY)]: await cloudSession(KEY, ['Макс', 'Аня']) };
  A = await boot('#/profile', { profile: PROFILE(SID, KEY, ['Макс', 'Аня']), store: st4, failDeleteSessions: true }); ({ w, D, sleep, c, btn } = A);
  await c(btn('Удалить мои данные'), 400); await c([...D.querySelectorAll('.viewport-popup-box button')].find(b => b.textContent.trim() === 'Удалить'), 1500);
  T('если облако не ответило — ничего не стёрто локально, показана понятная ошибка, можно повторить', !!A.prof() && A.prof().sessionId === SID && /Не удалось удалить данные из облака/.test(D.body.textContent) && D.title === 'Игроки и сессия — ASK ME');
  T('ошибка облака — уведомление «warn» (янтарное, role="alert"), а не зелёная галочка', !!D.querySelector('.toast.toast-warn[role="alert"]') && /Не удалось удалить данные из облака/.test(D.querySelector('.toast').textContent));
  finish(A);

  console.log(res.join('\n')); console.log('--- captured runtime errors:', allErrors.length); allErrors.slice(0, 6).forEach(e => console.log(' ', e)); process.exit(0);
 } catch (err) { console.log(res.join('\n')); console.log('TEST CRASH:', err.stack.split('\n').slice(0, 3).join(' | '), '|', A && A.D.title, A && A.D.body.textContent.replace(/\s+/g, ' ').slice(0, 200)); process.exit(1); } })();
