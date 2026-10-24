// Облачная копия сессии ограничена правилом базы (payload < 20000 знаков). Раньше при слишком большой копии база молча отклоняла запись
// (терялись и имена, и архив). Теперь: сначала пробуем с незавершённой партией, при превышении — без неё (партия остаётся на устройстве),
// а при полном провале или отказе базы показываем понятное сообщение. Здесь — база из 2000 вопросов, как в настоящей.
const nodeCrypto = require('crypto'); const webcrypto = nodeCrypto.webcrypto; const makeEnv = require('../harness.js');
const unb64u = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const decrypt = async (cipher, key) => { const all = unb64u(cipher); const k = await webcrypto.subtle.importKey('raw', unb64u(key), { name: 'AES-GCM' }, false, ['decrypt']); return JSON.parse(new TextDecoder().decode(await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: all.slice(0, 12) }, k, all.slice(12)))); };
const rules = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../fixtures/sessions-rules.json'), 'utf8')); // копия правила базы для узла sessions (предел длины payload)
const LIMIT = Number((JSON.stringify(rules).match(/payload[^}]*?length\s*<\s*(\d+)/) || [])[1]) || 20000;

(async () => { const A = makeEnv({ bigDb: 2000 }); const { w, D, sleep, errors, res, T } = A; const puts = []; const base = w.fetch; let failPut = false;
 w.fetch = async (url, init) => { url = String(url); const m = url.match(/\/sessions\/(s_[0-9a-f]+)\.json/); if (m && init && init.method === 'PUT') { const body = JSON.parse(init.body); puts.push({ key: m[1], body, len: body.payload.length }); if (failPut) return { ok: false, status: 401, json: async () => ({ error: 'Permission denied' }) }; if (body.payload.length >= LIMIT) return { ok: false, status: 401, json: async () => ({ error: 'Permission denied' }) }; } return base(url, init); };
 try {
  T('в копии правил базы найден предел payload: ' + LIMIT, LIMIT > 1000 && LIMIT <= 100000);
  w.eval(A.code); await sleep(1800);
  const inputs = [...D.querySelectorAll('input[type="text"]')]; A.setVal(inputs[0], 'Макс'); A.setVal(inputs[1], 'Аня'); await sleep(200);
  await A.click('Создать сессию', 1500); await A.click('Перейти к игре', 900);
  const prof0 = JSON.parse(w.localStorage.getItem('askme_device_profile_v4'));
  T('новая сессия записалась в облако целиком, предел не превышен (' + (puts.length && puts[puts.length - 1].len) + ' знаков)', puts.length >= 1 && puts.every(p => p.len < LIMIT));
  const key = prof0.sessionKey; const n0 = puts.length;
  await A.click('Начать игру', 700); await A.click('Обычный режим', 4200); await A.click('К вопросу', 800).catch(() => {});
  await sleep(900); // облачная копия обновляется через 350 мс после изменения профиля
  const prof1 = JSON.parse(w.localStorage.getItem('askme_device_profile_v4')); const nIds = prof1.savedGame && prof1.savedGame.questionIds ? prof1.savedGame.questionIds.length : 0;
  T('на устройстве сохранена партия со всей колодой (' + nIds + ' вопросов)', nIds > 1500);
  const last = puts[puts.length - 1];
  T('в облако ушла копия под предел базы (' + last.len + ' < ' + LIMIT + '), запись принята', puts.length > n0 && last.len < LIMIT);
  const dec = await decrypt(last.body.payload, key);
  T('в облачной копии сохранены имена игроков и архив, но без громоздкой партии (она осталась на устройстве)', dec.players.map(p => p.name).join() === 'Макс,Аня' && Array.isArray(dec.archivedIds) && (dec.savedGame === null || (dec.savedGame && JSON.stringify(dec.savedGame).length < 18000)));
  T('приложение не показало ложной ошибки: партия просто сохранилась без облачной копии партии, сообщений о сбое нет', !/слишком большой|Нет связи с облаком/.test(D.body.textContent));
  // отказ базы (правила не пустили запись): новое устройство создаёт сессию — понятное сообщение, данные на устройстве целы
  const E = makeEnv(); const eb = E.w.fetch; let putsE = 0;
  E.w.fetch = async (url, init) => { if (/\/sessions\/s_[0-9a-f]+\.json/.test(String(url)) && init && init.method === 'PUT') { putsE++; return { ok: false, status: 401, json: async () => ({ error: 'Permission denied' }) }; } return eb(url, init); };
  E.w.eval(E.code); await sleep(1800); const inE = [...E.D.querySelectorAll('input[type="text"]')]; E.setVal(inE[0], 'Макс'); E.setVal(inE[1], 'Аня'); await sleep(200);
  await E.click('Создать сессию', 1500); await sleep(800);
  T('если база отклонила запись — на экране «Нет связи с облаком…» (попыток записи: ' + putsE + '), прогресс на устройстве не потерян', putsE >= 1 && /Нет связи с облаком/.test(E.D.body.textContent) && JSON.parse(E.w.localStorage.getItem('askme_device_profile_v4')).players.length === 2);
  errors.push(...E.errors);
  // архив настолько вырос, что не помещается даже без партии: запись не отправляется (база всё равно отклонила бы), игрок видит причину
  const F = makeEnv(); let putsF = 0; const fb = F.w.fetch;
  F.w.fetch = async (url, init) => { if (/\/sessions\/s_[0-9a-f]+\.json/.test(String(url)) && init && init.method === 'PUT') { putsF++; return { ok: true, status: 200, json: async () => null }; } return fb(url, init); };
  const big = Array.from({ length: 6000 }, (_, i) => 'topic_q_' + i);
  F.w.localStorage.setItem('askme_device_profile_v4', JSON.stringify({ sessionId: 'K7M2Q9XA', sessionKey: 'AbCdEfGhIjKlMnOpQrStUv', players: [{ id: 'p1', name: 'Макс', gender: 'guy' }, { id: 'p2', name: 'Аня', gender: 'girl' }], archivedIds: big, disabledIds: [], savedGame: null, updatedAt: Date.now() }));
  F.w.eval(F.code); await sleep(3000);
  T('слишком большой архив: запрос в облако не отправляется, на экране «Сессия стала слишком большой…», данные на устройстве целы', putsF === 0 && /слишком большой для облака/.test(F.D.body.textContent) && JSON.parse(F.w.localStorage.getItem('askme_device_profile_v4')).archivedIds.length === 6000);
  errors.push(...F.errors);
  console.log(res.join('\n')); console.log('--- captured runtime errors:', errors.length); errors.slice(0, 6).forEach(e => console.log(' ', e)); process.exit(0);
 } catch (err) { console.log(res.join('\n')); console.log('TEST CRASH:', err.stack.split('\n').slice(0, 3).join(' | '), '|', D.title, D.body.textContent.replace(/\s+/g, ' ').slice(0, 200)); process.exit(1); } })();
