// Жизненный цикл живой игры на трёх «телефонах» с задержками сети: перезапуск хозяином, завершение «для всех»,
// устаревшие отметки устройств и лимит в 10 устройств. База в памяти с правилами Firebase (копия в fixtures).
const { joinGame, startGame, boot, waitFor, sleep, qn, pos, who, inGame, onSummary, devId, chip, closeRoulette, openGameMenu } = require('../live-helpers.js');
(async () => { const S = await boot(3, { latency: () => 30 + Math.random() * 220 }); const { devs, db, T } = S; const [A, B, C] = devs;
 try {
  const onMenu = (E) => E.D.title.startsWith('ASK ME —');
  await A.click('Начать игру', 700); await A.click('Обычный режим', 4200); await closeRoulette(A, 600);
  await waitFor(() => B.has('Присоединиться') && C.has('Присоединиться'), 9000);
  await joinGame(B); await joinGame(C); await closeRoulette(B, 300); await closeRoulette(C, 300);
  T('B и C в игре с хозяином (все три на экране игры)', devs.every(inGame));
  const r0 = db.room(), gid0 = r0.gid, dk0 = r0.dk;

  // хозяин выходит и начинает новую партию — остальные автоматически переходят на неё
  await openGameMenu(A); await A.click('Выйти, остальные продолжат', 1800);
  T('A вышел на главную, игра у B и C идёт дальше', onMenu(A) && inGame(B) && inGame(C) && db.room().status === 'active');
  await startGame(A, 700); await A.click('Обычный режим', 300);
  const sawB = await waitFor(() => B.has('Запущена новая игра'), 10000), sawC = await waitFor(() => C.has('Запущена новая игра'), 10000);
  T('B и C получили уведомление «Запущена новая игра»', sawB && sawC);
  await sleep(1500); const r1 = db.room();
  T('в комнате новая партия (другой идентификатор и другой набор вопросов — отпечаток колоды), статус active', r1.gid !== gid0 && r1.dk !== dk0 && r1.status === 'active');
  await waitFor(() => A.has('К вопросу') || A.has('Определяем'), 5000); await closeRoulette(A, 800);
  for (const E of [B, C]) await closeRoulette(E, 300);
  await sleep(2500);
  T('все три устройства снова на первом вопросе новой партии (' + pos(A) + ' / ' + pos(B) + ' / ' + pos(C) + ')', pos(A) === 1 && pos(B) === 1 && pos(C) === 1);
  T('и видят один и тот же вопрос и отвечающего (№' + qn(A) + ', ' + who(A) + ')', qn(A) && qn(B) === qn(A) && qn(C) === qn(A) && who(A) && who(B) === who(A) && who(C) === who(A));
  await sleep(9000);
  T('значок «👥 3» у всех после перезапуска (' + chip(A) + ', ' + chip(B) + ', ' + chip(C) + ')', chip(A) === '3' && chip(B) === '3' && chip(C) === '3');

  const snapActive = db.room(), deckActive = db.deck(); // «живая» партия — пригодится ниже, чтобы вернуть комнату в активное состояние вместе с колодой

  // «Для всех»: завершает партию на всех устройствах
  await openGameMenu(C); await C.click('Для всех', 1500);
  T('C завершил партию «Для всех»: он на итогах, в комнате статус ended', onSummary(C) && db.room().status === 'ended');
  const gotA = await waitFor(() => onSummary(A), 9000), gotB = await waitFor(() => onSummary(B), 9000);
  T('A и B тоже перешли на итоги', gotA && gotB);
  await A.click('В меню', 800); await sleep(4500);
  T('партия завершена — на главной приглашения «Присоединиться» нет', onMenu(A) && !A.has('Присоединиться'));

  // устаревшие отметки устройств не создают приглашений
  const room = db.roomId(); const now = () => Date.now();
  db.seed(room, ['p'], null); db.seed(room, ['status'], 'active'); db.seed(room, ['p', 'призрак'], now() - 200000);
  await sleep(4200);
  T('отметка давностью 200 с считается устаревшей: приглашения нет', !A.has('Присоединиться'));

  // лимит: 10 устройств в игре — одиннадцатое не пускаем
  db.seed(room, [], { ...snapActive, status: 'active' }); db.seed(room + '_d', [], deckActive); // после «Для всех» колоду удаляют вместе с партией: возвращаем и комнату, и колоду
  const ghosts = (n) => { db.seed(room, ['p'], null); for (let i = 1; i <= n; i++) db.seed(room, ['p', 'g' + i], now()); };
  ghosts(10);
  const saw10 = await waitFor(() => A.has('в ней 10 устройств'), 8000);
  T('приглашение показывает 10 устройств', saw10);
  await A.click('Присоединиться', 700); // отказ приходит сразу; сообщение живёт около трёх секунд, поэтому проверяем без долгого ожидания входа
  T('одиннадцатое устройство не пускают: «В игре уже 10 устройств», игра не открылась', A.has('В игре уже 10 устройств') && !inGame(A));
  T('причина показана сообщением: максимум для одной сессии', A.has('это максимум для одной сессии'));

  // девять устройств — десятое (последнее) входит
  ghosts(9); await waitFor(() => A.has('в ней 9 устройств'), 8000);
  await joinGame(A); await closeRoulette(A, 300);
  T('десятое устройство входит в игру', inGame(A));
  await sleep(2500);
  T('значок показывает «👥 10»', chip(A) === '10');

  T('ни одна запись не отклонена правилами базы', db.stats.denied === 0);
  S.finish(0);
 } catch (err) { S.crash(err); } })();
