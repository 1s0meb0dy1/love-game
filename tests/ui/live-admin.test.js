// Тестовый режим владельца не синхронизируется и ничего не пишет в общую комнату, а обычная игра владельца — синхронизируется как у всех.
const { joinGame, boot, waitFor, sleep, pos, who, inGame, closeRoulette, openGameMenu, chip, devId } = require('../live-helpers.js');
(async () => { const S = await boot(2, {}, { setupA: (A) => A.w.localStorage.setItem('askme_auth_v2', JSON.stringify({ owner: { idToken: 't', refreshToken: 'r', expiresAt: Date.now() + 3.6e6 } })) });
 const { devs, db, T } = S; const [A, B] = devs;
 try {
  const onMenu = (E) => E.D.title.startsWith('ASK ME —');
  await A.click('Начать игру', 700);
  T('владелец видит «Тестовый режим» на странице выбора режима', A.has('Тестовый режим'));
  let aLive = 0; const f0 = A.w.fetch; A.w.fetch = (u, i) => { if (/\/live\//.test(String(u))) aLive++; return f0(u, i); };
  const before = aLive;
  await A.click('Тестовый режим', 3500);
  T('тестовая игра владельца запущена', inGame(A));
  await closeRoulette(A, 500); await A.click('Далее', 800); await A.click('Далее', 800);
  await sleep(9500);
  T('в тестовом режиме в общую комнату не записано ничего (записей: ' + db.stats.writes + ', комнат: ' + Object.keys(db.rooms()).length + ')', db.stats.writes === 0 && Object.keys(db.rooms()).length === 0);
  T('в тестовом режиме значка «👥» нет', chip(A) === '');
  T('другое устройство той же сессии приглашения не получает', !B.has('Присоединиться'));
  T('и сам телефон владельца в тестовой игре не обращается к базе живой игры (обращений: ' + (aLive - before) + ')', aLive - before === 0);
  await openGameMenu(A); const yes = A.btns().find(b => b.textContent.trim() === 'Выйти'); yes.dispatchEvent(new A.w.MouseEvent('click', { bubbles: true })); await sleep(1200);
  T('тестовую игру можно завершить: владелец на главной', onMenu(A));

  // обычная игра того же владельца — как у всех, синхронизируется
  await A.click('Начать игру', 700); await A.click('Обычный режим', 4000); await closeRoulette(A, 500);
  const ok = await waitFor(() => B.has('Присоединиться'), 9000);
  T('обычная игра владельца синхронизируется: второе устройство получило приглашение', ok && !!db.room() && db.room().status === 'active');
  await joinGame(B); await closeRoulette(B, 300); await sleep(500);
  T('и присоединилось к той же партии (одинаковый вопрос и отвечающий)', inGame(B) && pos(B) === pos(A) && who(B) === who(A));
  T('ни одна запись не отклонена правилами базы', db.stats.denied === 0);
  S.finish(0);
 } catch (err) { S.crash(err); } })();
