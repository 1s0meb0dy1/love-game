// Синхронная игра по приглашению и со ВСЕЙ базой вопросов: хозяин играет один, второй телефон без сессии открывает ссылку-приглашение,
// нажимает «Присоединиться» — получает сессию из облака, сам входит в идущую партию и видит ту же колоду целиком (не только первые 400 вопросов).
const nodeCrypto = require('crypto'); const webcrypto = nodeCrypto.webcrypto;
const makeEnv = require('../harness.js'); const makeDb = require('../fake-rtdb.js');
const { boot, waitFor, sleep, inGame, who, pos, closeRoulette } = require('../live-helpers.js');
const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); const unb64u = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const encrypt = async (obj, key) => { const iv = webcrypto.getRandomValues(new Uint8Array(12)); const k = await webcrypto.subtle.importKey('raw', unb64u(key), { name: 'AES-GCM' }, false, ['encrypt']); const ct = new Uint8Array(await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(JSON.stringify(obj)))); return b64u(Buffer.concat([Buffer.from(iv), Buffer.from(ct)])); };
const dbKey = (key) => 's_' + nodeCrypto.createHash('sha256').update('askme-session-v1:' + key).digest('hex');
const total = (E) => { const d = [...E.D.querySelectorAll('header div')].find(x => /^\s*\d+\s*\/\s*\d+\s*$/.test(x.textContent)); return d ? +d.textContent.split('/')[1] : null; };

(async () => { const BIG = 2000; const S = await boot(1, {}, { env: { bigDb: BIG } }); const { devs, db, T } = S; const [A] = devs; let B;
 try {
  // A играет один
  await A.click('Начать игру', 700); await A.click('Обычный режим', 4200); await closeRoulette(A, 500);
  const tA = total(A);
  T('в партии у хозяина ВСЯ база: ' + tA + ' вопросов из ' + BIG + ' (раньше было не больше 400)', tA > 1500 && tA <= BIG);
  await sleep(2500);
  const room = db.room();
  T('пока хозяин один — в комнате только служебная отметка (solo), без имён игроков и без списка вопросов', !!room && room.solo === 1 && room.n === tA && !room.ids && !room.hist && !room.pl && !db.deck());
  T('в отметке есть «отпечаток» колоды dk вида <число>-<хеш>', /^\d+-[0-9a-z]+$/.test(String(room.dk)));

  // B — новое устройство без сессии: облачная копия сессии A лежит в «базе»
  const prof = JSON.parse(A.w.localStorage.getItem('askme_device_profile_v4'));
  const store = { [dbKey(prof.sessionKey)]: { payload: await encrypt({ players: prof.players, archivedIds: prof.archivedIds || [], disabledIds: prof.disabledIds || [], savedGame: null, updatedAt: Date.now() }, prof.sessionKey), updatedAt: Date.now() } };
  B = makeEnv({ bigDb: BIG }); db.attach(B); const base = B.w.fetch;
  B.w.fetch = async (url, init) => { const m = String(url).match(/\/sessions\/([^?]*?)\.json/); if (m && (!init || !init.method || init.method === 'GET')) { const v = store[m[1]]; return { ok: true, status: 200, json: async () => (v === undefined ? null : v) }; } return base(url, init); };
  devs.push(B);
  B.w.history.replaceState(null, '', '/love-game/#/join?sid=' + prof.sessionId + '&key=' + prof.sessionKey); B.w.eval(B.code); await sleep(2000);
  T('второй телефон без сессии открывает ссылку-приглашение и видит «Вас пригласили»', /Вас пригласили/.test(B.D.body.textContent) && !B.w.location.href.includes(prof.sessionKey));
  await B.click('Присоединиться', 300);
  const joined = await waitFor(() => inGame(B), 30000); await sleep(1500); await closeRoulette(B, 300); await closeRoulette(A, 300);
  T('B сам вошёл в идущую партию (после «Присоединиться» дополнительных нажатий не потребовалось)', joined);
  T('у B та же колода целиком: ' + total(B) + ' из ' + tA + ' вопросов', total(B) === tA);
  T('у обоих один и тот же вопрос и тот же отвечающий (' + who(A) + ' / ' + who(B) + ', вопрос ' + pos(A) + ' / ' + pos(B) + ')', who(A) === who(B) && pos(A) === pos(B) && !!who(A));
  const r2 = db.room(), deck = db.deck();
  T('при втором устройстве синхронизация включилась: в комнате список игроков и ход, отметка solo снята', !!r2 && !r2.solo && !!r2.pl && !!r2.idx !== undefined && !!deck);
  T('колода лежит отдельным узлом целиком (' + (deck ? deck.d.split(',').length : 0) + ' номеров), в самой комнате она не дублируется', !!deck && deck.d.split(',').length === tA && !r2.ids);
  T('ни одна запись не отклонена правилами базы', db.stats.denied === 0);
  // дальше идём вместе: «Далее» у B двигает обоих
  const w0 = who(A); await B.click('Далее', 2500); await closeRoulette(A, 200); await closeRoulette(B, 200);
  T('после «Далее» у B очередь перешла к другому игроку у обоих (' + w0 + ' → ' + who(A) + ' / ' + who(B) + ')', who(A) === who(B) && who(A) !== w0 && pos(A) === pos(B));
  const errs = devs.flatMap((E, i) => E.errors.map(e => `[${i}] ${e}`));
  console.log(S.res.join('\n')); console.log('--- captured runtime errors:', errs.length); errs.slice(0, 6).forEach(e => console.log(' ', e)); process.exit(0);
 } catch (err) { console.log(S.res.join('\n')); console.log('TEST CRASH:', err.stack.split('\n').slice(0, 3).join(' | '), '|', devs.map((E, i) => `[${i}] ${E.D.title} ${E.D.body.textContent.replace(/\s+/g, ' ').slice(0, 110)}`).join(' | ')); process.exit(1); } })();
