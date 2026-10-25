// Вход по 8-значному ID. Раньше новая сессия лежала в облаке только под ключом из ссылки, и по одному ID её было не найти («Сессия не найдена»).
// Теперь устройство кладёт в облако «замок» sessions/j_…: ключ сессии, зашифрованный ключом из ID (PBKDF2). Здесь схема проверяется независимо от приложения —
// теми же формулами на Node: адрес замка и шифр считаем сами, ключ в открытом виде в облаке не лежит, а вход по ID с другого устройства работает.
const makeEnv = require('../harness.js'); const nodeCrypto = require('crypto'); const webcrypto = nodeCrypto.webcrypto;
const res = []; const T = (n, ok) => res.push((ok ? 'PASS ' : 'FAIL ') + n); const allErrors = [];
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); const unb64u = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const encrypt = async (obj, key) => { const iv = webcrypto.getRandomValues(new Uint8Array(12)); const k = await webcrypto.subtle.importKey('raw', unb64u(key), { name: 'AES-GCM' }, false, ['encrypt']); const ct = new Uint8Array(await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(JSON.stringify(obj)))); const out = new Uint8Array(12 + ct.length); out.set(iv, 0); out.set(ct, 12); return b64u(out); };
const decrypt = async (cipher, key) => { try { const all = unb64u(cipher); const k = await webcrypto.subtle.importKey('raw', unb64u(key), { name: 'AES-GCM' }, false, ['decrypt']); return JSON.parse(new TextDecoder().decode(await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, k, all.slice(12)))); } catch (e) { return null; } };
const dbKey = (key) => 's_' + nodeCrypto.createHash('sha256').update('askme-session-v1:' + key).digest('hex');
const joinParts = (sid) => { const bits = nodeCrypto.pbkdf2Sync(sid, 'askme-join-v1', 300000, 48, 'sha256'); return { path: 'j_' + bits.subarray(0, 32).toString('hex'), lock: b64u(bits.subarray(32, 48)) }; };
// старый формат сессий (до ключей): путь sess_<хеш ID>, шифр XOR с ID
const legacyHash = (sid) => { const clean = sid.toUpperCase(); let h1 = 0x811c9dc5, h2 = 0x1b873593; const s1 = 'askme_vault_k1_' + clean + '_2026', s2 = 'askme_vault_k2_' + clean + '_secure'; for (let i = 0; i < s1.length; i++) { h1 ^= s1.charCodeAt(i); h1 = Math.imul(h1, 0x01000193); } for (let i = 0; i < s2.length; i++) { h2 ^= s2.charCodeAt(i); h2 = Math.imul(h2, 0x85ebca6b); } return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0'); };
const legacyPayload = (obj, pwd) => { const pt = encodeURIComponent(JSON.stringify(obj)); return Buffer.from(Array.from(pt).map((ch, i) => ch.charCodeAt(0) ^ pwd.charCodeAt(i % pwd.length))).toString('base64'); };
const PROFILE = (sid, key, names, extra = {}) => ({ sessionId: sid, sessionKey: key, players: names.map((n, i) => ({ id: 'p' + (i + 1), name: n, gender: i % 2 ? 'girl' : 'guy' })), archivedIds: [], disabledIds: [], savedGame: null, updatedAt: Date.now(), ...extra });

// устройство: общее «облако» store (узел sessions), log — все записи в него
const boot = async (store, { profile, hash = '/', getDelay = 0 } = {}) => {
  const A = makeEnv(); const { w, sleep, D } = A; const log = []; const base = w.fetch;
  w.fetch = async (url, init) => { url = String(url); const method = ((init && init.method) || 'GET').toUpperCase(); const m = url.match(/\/sessions\/([^?]*?)\.json/); const ok = (o, good = true) => ({ ok: good, status: good ? 200 : 500, json: async () => o, text: async () => JSON.stringify(o) });
    if (!m) return base(url, init); log.push({ method, path: m[1], body: init && init.body });
    if (method === 'GET') { if (getDelay) await sleep(getDelay); return ok(store[m[1]] === undefined ? null : store[m[1]]); } if (method === 'DELETE') { delete store[m[1]]; return ok(null); } store[m[1]] = JSON.parse(init.body); return ok(store[m[1]]); };
  if (profile) w.localStorage.setItem('askme_device_profile_v4', JSON.stringify(profile));
  w.history.replaceState(null, '', '/love-game/#' + hash); w.eval(A.code); await sleep(1800);
  const c = async (el, ms = 300) => { if (!el) throw new Error('нет элемента'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await sleep(ms); };
  const btn = (t) => [...D.querySelectorAll('button')].find(b => b.textContent.replace(/\s+/g, ' ').includes(t) && !b.disabled);
  const prof = () => { try { return JSON.parse(w.localStorage.getItem('askme_device_profile_v4')); } catch (e) { return null; } };
  const wait = async (fn, ms = 6000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (fn()) return true; } catch (e) {} await sleep(100); } return false; };
  const type = async (v) => { A.setVal(D.querySelector('input[placeholder*="ID"]'), v); await sleep(150); };
  return Object.assign(A, { log, c, btn, prof, wait, type, store });
};
const finish = (E) => { allErrors.push(...E.errors); E.w.close(); };

(async () => { try {
  const store = {};
  // ---------- устройство 1 создаёт сессию ----------
  let A = await boot(store); let { w, D, sleep, c, btn } = A;
  const inputs = [...D.querySelectorAll('input[type="text"]')]; A.setVal(inputs[0], 'Макс'); A.setVal(inputs[1], 'Аня'); await sleep(200); await c(btn('Создать сессию'), 1500);
  const p1 = A.prof(); const SID = p1.sessionId, KEY = p1.sessionKey; const { path, lock } = joinParts(SID);
  await A.wait(() => store[path]);
  T('новая сессия: в облаке есть сама сессия (s_…) и «замок» для входа по ID (j_…)', !!store[dbKey(KEY)] && !!store[path]);
  const lockJson = JSON.stringify(store[path]);
  T('адрес замка и шифр совпадают с независимым расчётом PBKDF2 (300 000 кругов): замок открывается ключом из ID и содержит ключ сессии', (await decrypt(store[path].payload, lock) || {}).k === KEY);
  T('ключ сессии и ID в облаке открытым текстом не лежат (ни в замке, ни в его адресе)', !lockJson.includes(KEY) && !path.includes(SID) && !lockJson.includes(SID));
  T('замок записан по правилам узла sessions: payload — строка, есть updatedAt', typeof store[path].payload === 'string' && typeof store[path].updatedAt === 'number' && store[path].payload.length < 500);
  T('у устройства запомнено время публикации замка (joinAt), чтобы не писать его при каждом запуске', Number(A.prof().joinAt) > 0);
  const putsJ = A.log.filter(r => r.method === 'PUT' && r.path === path).length; T('замок записан один раз, а не после каждого изменения профиля (' + putsJ + ')', putsJ === 1);
  finish(A);

  // ---------- устройство 2 входит только по ID ----------
  A = await boot(store, { hash: '/welcome' }); ({ w, D, sleep, c, btn } = A);
  await c(btn('Войти по ID'), 300); await A.type(' ' + SID.slice(0, 4).toLowerCase() + ' ' + SID.slice(4).toLowerCase() + ' '); await c(btn('Восстановить прогресс'), 400);
  T('после нажатия видно «Поиск…» (обмен ключа занимает долю секунды) или вход уже выполнен', await A.wait(() => /Поиск/.test(D.body.textContent) || A.prof() !== null, 3000));
  const okIn = await A.wait(() => A.prof() && A.prof().sessionId === SID, 8000);
  T('вход по одному ID (строчными, с пробелами) работает: сессия открыта', okIn);
  const p2 = A.prof() || {}; T('на втором устройстве те же ID и ключ, имена игроков и архив из облака', p2.sessionKey === KEY && p2.players && p2.players.map(p => p.name).join() === 'Макс,Аня');
  T('после входа открыта главная, на экране нет ошибок', D.title.startsWith('ASK ME —') && !/не найдена/.test(D.body.textContent));
  await A.wait(() => Number((A.prof() || {}).joinAt) > 0, 5000); T('второе устройство тоже подтвердило замок (вход по ID останется, даже если первое устройство пропадёт)', Number((A.prof() || {}).joinAt) > 0);
  finish(A);

  // ---------- чужой/несуществующий/испорченный ID ----------
  A = await boot(store, { hash: '/welcome' }); ({ w, D, sleep, c, btn } = A);
  await c(btn('Войти по ID'), 300); await A.type('ZZZZ9999'); await c(btn('Восстановить прогресс'), 400);
  await A.wait(() => /не найдена/.test(D.body.textContent), 8000);
  T('несуществующий ID: понятная ошибка с подсказкой, сессия не открыта', /Сессия с таким ID не найдена/.test(D.body.textContent) && /Проверьте ID/.test(D.body.textContent) && A.prof() === null);
  const nBefore = A.log.length; await A.type('K7M2'); await c(btn('Восстановить прогресс'), 300);
  T('слишком короткий ID: ошибка про формат, в облако не ходим', /8-значный ID/.test(D.body.textContent) && A.log.length === nBefore);
  const bad = joinParts('QQQQ2222'); store[bad.path] = { payload: 'мусор-вместо-шифра', updatedAt: Date.now() };
  await A.type('QQQQ2222'); await c(btn('Восстановить прогресс'), 400); await A.wait(() => /не найдена/.test(D.body.textContent), 8000);
  T('испорченный замок не ломает приложение: просто «не найдена»', A.prof() === null && /Сессия с таким ID не найдена/.test(D.body.textContent));
  const other = joinParts('RRRR3333'); store[other.path] = { payload: await encrypt({ k: KEY }, joinParts('SSSS4444').lock), updatedAt: Date.now() }; // замок, закрытый чужим ID
  await A.type('RRRR3333'); await c(btn('Восстановить прогресс'), 400); await A.wait(() => /не найдена/.test(D.body.textContent), 8000);
  T('замок, зашифрованный другим ID, не открывается — вход не происходит', A.prof() === null);
  // замок есть, а сессии под этим ключом уже нет (удалена)
  const gone = joinParts('GGGG5555'); store[gone.path] = { payload: await encrypt({ k: 'Zz9Yy8Xx7Ww6Vv5Uu4Tt3S' }, gone.lock), updatedAt: Date.now() };
  await A.type('GGGG5555'); await c(btn('Восстановить прогресс'), 400); await A.wait(() => /не найдена/.test(D.body.textContent), 8000);
  T('замок есть, а самой сессии нет: «не найдена», ничего не создаётся', A.prof() === null);
  // облако не ответило (сеть пропала / база отказала) — это не «ID не найден»: сообщаем про связь, а не отправляем искать старое устройство
  { const f0 = w.fetch; let mode = 'throw'; w.fetch = async (u, i) => { if (/\/sessions\//.test(String(u)) && mode) { if (mode === 'throw') throw new Error('offline'); return { ok: false, status: 401, json: async () => ({ error: 'Permission denied' }) }; } return f0(u, i); };
    for (const m of ['throw', 'denied']) { mode = m; await A.type('ZZZZ9999'); await c(btn('Восстановить прогресс'), 400); await A.wait(() => /Нет связи с облаком|не найдена/.test(D.body.textContent), 8000);
      T('облако недоступно (' + (m === 'throw' ? 'нет сети' : 'отказ базы') + '): «Нет связи с облаком», а не «ID не найден»', /Нет связи с облаком/.test(D.body.textContent) && !/Сессия с таким ID не найдена/.test(D.body.textContent) && A.prof() === null); }
    mode = null; w.fetch = f0; }
  // облачная копия с неверными типами (players — строка): приложение не падает и не кладёт мусор в хранилище
  const hk = 'Hh1Gg2Ff3Dd4Ss5Aa6Pp7O', hj = joinParts('HHHH6666'); store[hj.path] = { payload: await encrypt({ k: hk }, hj.lock), updatedAt: Date.now() };
  store[dbKey(hk)] = { payload: await encrypt({ players: 'не-массив', archivedIds: 'x', savedGame: 'y', updatedAt: 1 }, hk), updatedAt: Date.now() };
  await A.type('HHHH6666'); await c(btn('Восстановить прогресс'), 400); await A.wait(() => /не найдена/.test(D.body.textContent), 8000);
  T('облачная копия с players-строкой не принимается: «не найдена», профиль не создан, страница жива', A.prof() === null && /Сессия с таким ID не найдена/.test(D.body.textContent));
  // ID, набранный на украинской/русской раскладке: «КЕНТ2345» кириллицей выглядит как латинские K, E, H, T — это те же буквы
  const hl = joinParts('KEHT2345'); store[hl.path] = { payload: await encrypt({ k: KEY }, hl.lock), updatedAt: Date.now() };
  await A.type('КЕНТ2345'); await c(btn('Восстановить прогресс'), 400);
  T('ID с кириллическими буквами-двойниками (К, Е, Н, Т) распознаётся как латинский: вход работает', await A.wait(() => A.prof() && A.prof().sessionId === 'KEHT2345' && A.prof().sessionKey === KEY, 8000));
  finish(A);

  // сессия с нормальными игроками, но «партией» не того типа: вход проходит, мусорная партия отбрасывается
  { const sk = 'Jj1Kk2Ll3Mm4Nn5Pp6Qq7R', sj = joinParts('JJJJ7777'); const st5 = { [sj.path]: { payload: await encrypt({ k: sk }, sj.lock), updatedAt: Date.now() }, [dbKey(sk)]: { payload: await encrypt({ players: PROFILE('JJJJ7777', sk, ['Ян', 'Ева']).players.concat([{ id: 7, name: 'Ф'.repeat(60), gender: 'x' }, null, 'строка']), archivedIds: ['a', { x: 1 }, 5], savedGame: { questionIds: 'нет' }, updatedAt: 5 }, sk), updatedAt: Date.now() } };
    A = await boot(st5, { hash: '/welcome' }); ({ w, D, sleep, c, btn } = A); await c(btn('Войти по ID'), 300); await A.type('JJJJ7777'); await c(btn('Восстановить прогресс'), 400);
    T('копия со «странной» партией и игроками: вход проходит', await A.wait(() => A.prof() && A.prof().sessionId === 'JJJJ7777', 8000));
    const pj = A.prof() || {}; T('мусорная партия отброшена (savedGame = null), игроки очищены (3 нормальных, имя ≤25 знаков, пол guy/girl), в архиве только строки и числа', pj.savedGame === null && pj.players && pj.players.length === 3 && pj.players.every(p => typeof p.id === 'string' && p.name.length <= 25 && (p.gender === 'guy' || p.gender === 'girl')) && pj.archivedIds.length === 2);
    finish(A); }

  // ---------- старый формат (до ключей) и ссылка с ключом по-прежнему работают ----------
  const OLD = 'OLDS7777'; const st2 = { ['sess_' + legacyHash(OLD)]: { payload: legacyPayload({ players: PROFILE(OLD, 'x', ['Олег', 'Ира']).players, archivedIds: [], disabledIds: [] }, OLD), updatedAt: Date.now() } };
  A = await boot(st2, { hash: '/welcome' }); ({ w, D, sleep, c, btn } = A);
  await c(btn('Войти по ID'), 300); await A.type(OLD); await c(btn('Восстановить прогресс'), 400);
  T('сессия старого формата входит по ID и переезжает под новый ключ (старая запись удалена)', await A.wait(() => A.prof() && A.prof().sessionId === OLD && A.prof().sessionKey && !st2['sess_' + legacyHash(OLD)], 8000));
  finish(A);
  const st3 = { [dbKey(KEY)]: store[dbKey(KEY)] };
  A = await boot(st3, { hash: '/welcome' }); ({ w, D, sleep, c, btn } = A);
  await c(btn('Войти по ID'), 300); await A.type('https://x.test/love-game/#/join?sid=' + SID + '&key=' + KEY); await c(btn('Восстановить прогресс'), 400);
  T('ссылка с ключом работает и без замка в облаке', await A.wait(() => A.prof() && A.prof().sessionKey === KEY, 8000));
  finish(A);

  // ---------- вход из профиля, когда уже есть другая сессия ----------
  A = await boot(store, { profile: PROFILE('ABCD2345', 'Aa1Bb2Cc3Dd4Ee5Ff6Gg7H', ['Том', 'Лиз'], { joinAt: Date.now() }), hash: '/profile' }); ({ w, D, sleep, c, btn } = A);
  A.setVal(D.querySelector('input[placeholder="Ссылка или ID"]'), SID); await sleep(150); await c(btn('Войти'), 400);
  T('на странице «Игроки и сессия» вход по ID тоже работает и заменяет текущую сессию', await A.wait(() => A.prof() && A.prof().sessionId === SID && A.prof().sessionKey === KEY, 8000));
  finish(A);

  // ---------- старые сессии получают замок при первом запуске после обновления; он обновляется раз в неделю ----------
  const st4 = {}; const OLDID = 'HELD8888'; const OLDKEY = 'Qq1Ww2Ee3Rr4Tt5Yy6Uu7I'; const jp = joinParts(OLDID).path;
  A = await boot(st4, { profile: PROFILE(OLDID, OLDKEY, ['Нина', 'Юра']) });
  T('сессия, созданная до обновления (без joinAt), сама публикует замок при запуске', await A.wait(() => st4[jp], 6000)); finish(A);
  const t1 = st4[jp].updatedAt; A = await boot(st4, { profile: PROFILE(OLDID, OLDKEY, ['Нина', 'Юра'], { joinAt: Date.now() - 2 * 864e5 }) }); await A.sleep(1500);
  T('замок свежий (2 дня) — повторно не пишется', !A.log.some(r => r.method === 'PUT' && r.path === jp)); finish(A);
  A = await boot(st4, { profile: PROFILE(OLDID, OLDKEY, ['Нина', 'Юра'], { joinAt: Date.now() - 8 * 864e5 }) });
  T('замок старше недели — обновляется (иначе он мог бы устареть и быть удалён)', await A.wait(() => A.log.some(r => r.method === 'PUT' && r.path === jp), 6000) && st4[jp].updatedAt >= t1); finish(A);

  // ---------- «Удалить мои данные» стирает и замок ----------
  A = await boot(st4, { profile: PROFILE(OLDID, OLDKEY, ['Нина', 'Юра'], { joinAt: Date.now() }), hash: '/profile' }); ({ w, D, sleep, c, btn } = A);
  st4[dbKey(OLDKEY)] = { payload: 'x', updatedAt: 1 };
  await c(btn('Удалить мои данные'), 400); await c([...D.querySelectorAll('button')].filter(b => /Удалить/.test(b.textContent)).pop(), 1500);
  T('«Удалить мои данные» удаляет содержимое сессии и замка, оставляя запрет повторной записи', st4[dbKey(OLDKEY)]?.deleted === true && st4[jp]?.deleted === true && st4[dbKey(OLDKEY)].payload === '' && st4[jp].payload === '');
  finish(A);

  console.log(res.join('\n')); console.log('--- captured runtime errors:', allErrors.length); allErrors.slice(0, 6).forEach(e => console.log(' ', e)); process.exit(0);
 } catch (err) { console.log(res.join('\n')); console.log('TEST CRASH:', err.stack.split('\n').slice(0, 3).join(' | ')); process.exit(1); } })();
