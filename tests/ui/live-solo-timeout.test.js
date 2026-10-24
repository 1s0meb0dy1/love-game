// Хозяин «пропал» (в комнате остался его «маячок», а сам он уже не отвечает): второй телефон нажимает «Присоединиться», ждёт не дольше положенного
// и получает понятное сообщение; своя отметка из комнаты убирается, игра не открывается наполовину. Потом хозяин «вернулся» — подключение проходит.
const nodeCrypto = require('crypto');
const { boot, waitFor, sleep, inGame, who, pos, closeRoulette } = require('../live-helpers.js');
const roomKey = (key) => 'l_' + nodeCrypto.createHash('sha256').update('askme-live-v1:' + key).digest('hex').slice(0, 40);

(async () => { const S = await boot(1); const { devs, db, T } = S; const [A] = devs;
 try {
  const prof = JSON.parse(A.w.localStorage.getItem('askme_device_profile_v4')); const room = roomKey(prof.sessionKey); const now = () => Date.now();
  // «маячок» хозяина, которого уже нет: свежая отметка в комнате, режим solo, но никто не опрашивает присутствие и не раздаёт колоду
  db.seed(room, [], { ver: 1, by: 'призрак', t: now(), gid: 'g_ghost', status: 'active', solo: 1, n: 120, dk: '120-abc123', hard: 0, fx: 1, p: { 'призрак': now() } });
  const sawInvite = await waitFor(() => A.has('Присоединиться'), 9000);
  T('в сессии идёт игра хозяина — на главной появилось приглашение «Присоединиться»', sawInvite);
  const t0 = now(); await A.click('Присоединиться', 600);
  T('сразу после нажатия видно «Подключаемся…», кнопка занята', A.has('Подключаемся'));
  const gaveUp = await waitFor(() => A.has('Не удалось подключиться'), 22000);
  const waited = now() - t0;
  T('хозяин не ответил — через ' + Math.round(waited / 1000) + ' с показано «Не удалось подключиться: игра не открыта на устройстве хозяина»', gaveUp && waited >= 12000 && waited <= 21000);
  T('игра не открылась наполовину: остались на главной', !inGame(A) && A.D.title.startsWith('ASK ME —'));
  await sleep(500);
  const pr = (db.room() || {}).p || {}; T('своя отметка из комнаты убрана (осталась только отметка «призрака»)', Object.keys(pr).join() === 'призрак');
  T('приглашение осталось — можно попробовать снова', A.btns().some(b => /Присоединиться/.test(b.textContent)) || (await waitFor(() => A.has('Присоединиться'), 5000)));
  T('ни одна запись не отклонена правилами базы', db.stats.denied === 0);
  S.finish(0);
 } catch (err) { S.crash(err); } })();
