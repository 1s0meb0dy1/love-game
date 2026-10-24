// Лимит устройств в одной партии: не больше, чем игроков в сессии (и не больше 10). Лишнее устройство не пускают с понятным объяснением,
// а когда одно из устройств выходит, место освобождается. База в памяти с правилами Firebase (копия в fixtures).
const { joinGame, boot, waitFor, sleep, who, inGame, devId, chip, closeRoulette, openGameMenu } = require('../live-helpers.js');

(async () => { const res = []; const errs = []; const T = (n, ok) => res.push((ok ? 'PASS ' : 'FAIL ') + n);
 try {
  // ---------- два игрока в сессии → два устройства ----------
  { const S = await boot(3, {}, { players: 2 }); const { devs, db } = S; const [A, B, C] = devs;
    await A.click('Начать игру', 700); await A.click('Обычный режим', 4200); await closeRoulette(A, 600);
    await waitFor(() => B.has('Присоединиться'), 9000);
    await joinGame(B); await closeRoulette(B, 300); await sleep(500);
    T('при двух игроках второе устройство входит в игру', inGame(A) && inGame(B));
    await waitFor(() => C.has('2 устройства'), 9000);
    T('третье устройство видит приглашение (в игре 2 устройства)', C.has('В вашей сессии уже идёт игра') && C.has('2 устройства'));
    await C.click('Присоединиться', 700);
    T('третье устройство не пускают: «В игре уже 2 устройства — по числу игроков в сессии», игра не открылась', C.has('В игре уже 2 устройства') && C.has('по числу игроков') && !inGame(C));
    T('в сообщении подсказано, как увеличить лимит: добавить игроков в «Игроки и сессия»', C.has('добавьте игроков'));
    T('отметка отказавшегося устройства в комнату не попала', Object.keys((db.room() || {}).p || {}).length === 2 && !((db.room() || {}).p || {})[devId(C)]);
    await openGameMenu(B); await B.click('Выйти, остальные продолжат', 1500);
    await waitFor(() => C.has('1 устройство'), 12000); await sleep(500);
    await joinGame(C); await closeRoulette(C, 300);
    T('когда второе устройство вышло, место освободилось: третье входит в игру', inGame(C) && inGame(A));
    T('ни одна запись не отклонена правилами базы', db.stats.denied === 0);
    errs.push(...devs.flatMap(E => E.errors)); devs.forEach(E => { try { E.w.close(); } catch (e) {} }); }

  // ---------- десять игроков → до десяти устройств ----------
  { const S = await boot(2, {}, { players: 10 }); const { devs, db } = S; const [A, B] = devs; const now = () => Date.now();
    await A.click('Начать игру', 700); await A.click('Обычный режим', 4200); await closeRoulette(A, 600);
    await waitFor(() => B.has('Присоединиться'), 9000);
    const room = db.roomId(); const ghosts = (n) => { for (let i = 1; i <= 12; i++) db.seed(room, ['p', 'g' + i], i <= n ? now() : null); };
    ghosts(9); // хозяин + 9 «призраков» = 10 устройств: одиннадцатому места нет
    await waitFor(() => B.has('в ней 10 устройств'), 9000);
    T('приглашение показывает 10 устройств', B.has('в ней 10 устройств'));
    await B.click('Присоединиться', 700);
    T('одиннадцатое устройство не пускают: «В игре уже 10 устройств», игра не открылась', B.has('В игре уже 10 устройств') && !inGame(B));
    ghosts(8); await waitFor(() => B.has('в ней 9 устройств'), 9000);
    await joinGame(B); await closeRoulette(B, 300);
    T('девять устройств в игре — десятое (последнее) входит', inGame(B));
    await sleep(2500); T('значок показывает «👥 10»', chip(B) === '10');
    T('ни одна запись не отклонена правилами базы', db.stats.denied === 0);
    errs.push(...devs.flatMap(E => E.errors)); devs.forEach(E => { try { E.w.close(); } catch (e) {} }); }

  // ---------- у присоединяющегося устарела копия сессии: лимит считается по игрокам в комнате, а не только по своим ----------
  { let k = 0; const stale = (E) => { if (++k === 2) { const pr = JSON.parse(E.w.localStorage.getItem('askme_device_profile_v4')); pr.players = pr.players.slice(0, 2); E.w.localStorage.setItem('askme_device_profile_v4', JSON.stringify(pr)); } };
    const S = await boot(3, {}, { players: 4, setupB: stale }); const { devs, db } = S; const [A, B, C] = devs;
    await A.click('Начать игру', 700); await A.click('Обычный режим', 4200); await closeRoulette(A, 600);
    await waitFor(() => B.has('Присоединиться'), 9000); await joinGame(B); await closeRoulette(B, 300); await sleep(500);
    T('хозяин (4 игрока) и устройство B в игре', inGame(A) && inGame(B));
    await waitFor(() => C.has('Присоединиться'), 9000);
    T('у устройства C в копии сессии только 2 игрока (устарела)', JSON.parse(C.w.localStorage.getItem('askme_device_profile_v4')).players.length === 2);
    await joinGame(C); await closeRoulette(C, 300);
    T('но в комнате 4 игрока — третье устройство пускают (лимит 4), а не отказывают по своей устаревшей копии', inGame(C) && !C.has('В игре уже'));
    T('ни одна запись не отклонена правилами базы', db.stats.denied === 0);
    errs.push(...devs.flatMap(E => E.errors)); devs.forEach(E => { try { E.w.close(); } catch (e) {} }); }

  console.log(res.join('\n')); console.log('--- captured runtime errors:', errs.length); errs.slice(0, 6).forEach(e => console.log(' ', e)); process.exit(0);
 } catch (err) { console.log(res.join('\n')); console.log('TEST CRASH:', err.stack.split('\n').slice(0, 3).join(' | ')); process.exit(1); } })();
