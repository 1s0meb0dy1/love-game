// «Продолжить» сохранённую партию при синхронизации: вернуться в идущую партию, а если других устройств уже нет — взять самое свежее состояние из комнаты.
const { joinGame, boot, waitFor, sleep, pos, who, qn, inGame, onSummary, closeRoulette, openGameMenu, devId } = require('../live-helpers.js');
(async () => { const S = await boot(2, { latency: () => 20 + Math.random() * 100 }); const { devs, db, T } = S; const [A, B] = devs;
 try {
  const onMenu = (E) => E.D.title.startsWith('ASK ME —');
  const leave = async (E) => { await openGameMenu(E); await E.click('Выйти, остальные продолжат', 1500); };
  await A.click('Начать игру', 700); await A.click('Обычный режим', 4200); await closeRoulette(A, 500);
  await waitFor(() => B.has('Присоединиться'), 9000); await joinGame(B); await closeRoulette(B, 300);
  await B.click('Далее', 2500);
  const wB = who(B), pB = pos(B), gid0 = db.room().gid;
  T('B продвинул партию: отвечающий сменился и у A (' + who(A) + ')', who(A) === wB);

  // A выходит, но B ещё в игре: «Продолжить» возвращает в идущую партию, а не затирает её старым сохранением
  await leave(A);
  T('A на главной, видна кнопка «Продолжить» (и приглашение)', onMenu(A) && A.has('Продолжить игру'));
  await A.click('Продолжить игру', 300); await waitFor(() => inGame(A), 15000); await sleep(500);
  T('«Продолжить» вернуло A в ту же партию с актуальным ходом (' + who(A) + ' = ' + wB + ', вопрос ' + pos(A) + ' = ' + pB + ')', inGame(A) && who(A) === wB && pos(A) === pB);
  T('партия в комнате не перезапущена (идентификатор прежний)', db.room().gid === gid0);

  // обе стороны вышли — в комнате никого нет, но партия активна: у A сохранение старое, в комнате ход B новее
  await leave(B); await leave(A); await sleep(800);
  T('оба на главной, в комнате ни одного устройства, партия числится активной', onMenu(A) && onMenu(B) && !Object.keys(db.room().p || {}).length && db.room().status === 'active');
  await B.click('Продолжить игру', 300); await waitFor(() => inGame(B), 15000); await sleep(500); await closeRoulette(B, 300);
  T('B продолжает партию с того места, где остановились (' + who(B) + ' = ' + wB + ')', inGame(B) && who(B) === wB && pos(B) === pB);
  T('и это та же партия (комната не пересоздана): идентификатор прежний', db.room().gid === gid0);
  await sleep(4200);
  T('A видит приглашение и присоединяется к B', A.has('Присоединиться') || inGame(A));
  if (!inGame(A)) await joinGame(A); await closeRoulette(A, 300);
  T('A снова в игре, состояние то же', inGame(A) && who(A) === who(B) && pos(A) === pos(B));
  T('ни одна запись не отклонена правилами базы', db.stats.denied === 0);
  S.finish(0);
 } catch (err) { S.crash(err); } })();
