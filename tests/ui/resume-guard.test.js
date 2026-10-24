// Возврат в партию после перезагрузки страницы, когда в сессии уже идёт игра на другом устройстве.
// 1) та же колода — устройство возвращается в живую игру (его отметка появляется в комнате, а не уходит играть в одиночку);
// 2) другая колода (устаревшее сохранение) — идущую игру не затирают: устройство уходит на главную, игра хозяина продолжается без «Запущена новая игра».
const makeEnv = require('../harness.js');
const { boot, waitFor, sleep, inGame, closeRoulette, devId } = require('../live-helpers.js');

(async () => { const S = await boot(1, {}, { players: 2 }); const { devs, db, T } = S; const [A] = devs; const extra = [];
 try {
  await A.click('Начать игру', 700); await A.click('Обычный режим', 4200); await closeRoulette(A, 600); await sleep(800);
  const profA = A.w.localStorage.getItem('askme_device_profile_v4'); const gid0 = (db.room() || {}).gid;
  T('хозяин играет, в комнате его партия (gid)', inGame(A) && !!gid0);

  // перезагрузка устройства, у которого сохранена ТА ЖЕ партия: возвращается в живую игру
  const reload = async (profile, hash = '#/play') => { const E = makeEnv(); db.attach(E); extra.push(E); E.w.localStorage.setItem('askme_device_profile_v4', profile); E.w.history.replaceState(null, '', hash); E.w.eval(E.code); return E; };
  const E1 = await reload(profA);
  const back = await waitFor(() => inGame(E1), 20000); await sleep(800);
  T('та же партия: устройство вернулось в игру на экране #/play', back && E1.w.location.hash === '#/play');
  const p1 = Object.keys((db.room() || {}).p || {});
  T('и вошло в общую комнату (его отметка рядом с хозяйской), а не играет в одиночку', p1.length === 2 && p1.includes(devId(E1)));
  T('партия хозяина та же: gid не менялся', (db.room() || {}).gid === gid0 && inGame(A));
  try { E1.w.close(); } catch (e) {}
  await sleep(300);

  // устаревшее сохранение ДРУГОЙ колоды: чужую идущую игру затирать нельзя
  const prof = JSON.parse(profA); const ids = Object.values(A.exp).slice(0, 40).map(q => q.id);
  prof.savedGame = { questionIds: ids, currentIndex: 5, maxReachedIndex: 5, turnHistory: {} };
  const E2 = await reload(JSON.stringify(prof));
  await sleep(6000);
  T('другая колода: устройство не вошло в чужую партию и не начало свою — открылась главная', E2.w.location.hash === '#/' && E2.D.title.startsWith('ASK ME —') && !inGame(E2));
  T('идущая игра хозяина не затёрта: gid прежний, хозяин остался в игре без «Запущена новая игра»', (db.room() || {}).gid === gid0 && inGame(A) && !A.has('Запущена новая игра'));
  T('в истории нет лишней записи #/play: «Назад» не вернёт в игру (адрес заменён)', E2.w.history.length <= 2);
  T('на главной видно приглашение вернуться в идущую игру', await waitFor(() => E2.has('Присоединиться'), 9000));
  T('ни одна запись не отклонена правилами базы', db.stats.denied === 0);
  extra.forEach(E => errs(E)); function errs(E) { E.errors.forEach(e => S.devs[0].errors.push('[x] ' + e)); }
  extra.forEach(E => { try { E.w.close(); } catch (e) {} });
  S.finish(0);
 } catch (err) { S.crash(err); } })();
