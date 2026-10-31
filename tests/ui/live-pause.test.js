// Общая пауза: один игрок вышел из игры на другие страницы — у остальных игра встаёт на паузу (окно, отсчёт, шутка по режиму);
// вернулся — пауза снимается сама; закрыл вкладку или пропал интернет (метка устарела) — устройство исключено, пауза снята, вернуться можно позже.
const { joinGame, boot, waitFor, sleep, inGame, closeRoulette, openGameMenu } = require('../live-helpers.js');
(async () => { const S = await boot(2, { latency: () => 20 + Math.random() * 60 }, { players: 2 }); const { devs, db, T } = S; const [A, B] = devs;
 try {
  const ov = (E) => E.D.querySelector('.pause-ov');
  const pKeys = () => Object.keys((db.room() && db.room().p) || {});
  const awayKeys = () => pKeys().filter(k => k.startsWith('away~'));
  const press = async (E, t, ms = 300) => { const b = E.btns().find(x => x.textContent.replace(/\s+/g, ' ').includes(t) && !x.disabled); if (!b) throw new Error('нет кнопки ' + t); b.dispatchEvent(new E.w.MouseEvent('click', { bubbles: true })); await sleep(ms); };
  await A.click('Начать игру', 700); await A.click('Обычный режим', 4200); await closeRoulette(A, 600);
  await waitFor(() => B.has('Присоединиться'), 9000); await joinGame(B); await closeRoulette(B, 300);
  await sleep(9500); // обе отметки «я здесь» уже в базе, у A известно, что в игре два устройства
  T('оба устройства в игре, окна паузы нет', inGame(A) && inGame(B) && !ov(A) && !ov(B) && awayKeys().length === 0);

  // A выходит в меню («Поставить на паузу») — у B пауза
  await openGameMenu(A); await press(A, 'Поставить на паузу', 800);
  T('A вышел на главную; в комнате метка «отошёл» (away~устройство~время)', A.D.title.startsWith('ASK ME —') && awayKeys().length === 1 && awayKeys()[0].startsWith('away~' + A.w.sessionStorage.getItem('askme_dev_v1') + '~'));
  const seen = await waitFor(() => !!ov(B), 8000);
  T('у B появилось окно «Игра на паузе» с отсчётом и шуткой', seen && /Игра на паузе/.test(ov(B).textContent) && /\d\d:\d\d/.test(ov(B).querySelector('.pause-clock b').textContent) && ov(B).querySelector('.pause-joke').textContent.length > 15 && /устройств: 1/.test(ov(B).textContent));
  T('шутка из набора обычного режима, кнопки «Продолжить без них» и «В меню»', !!B.btns().find(b => b.textContent.includes('Продолжить без них')) && !!B.btns().find(b => b.textContent.trim() === 'В меню'));
  await sleep(2200); const c1 = ov(B).querySelector('.pause-clock b').textContent; await sleep(2200);
  T('отсчёт паузы идёт (' + c1 + ' → ' + ov(B).querySelector('.pause-clock b').textContent + ')', ov(B).querySelector('.pause-clock b').textContent > c1);
  T('у A окна паузы нет (он вышел)', !ov(A));

  // метка «отошёл» держится, пока A на странице: ждём больше 30 с
  await sleep(11000); const k0 = awayKeys()[0], v0 = db.room().p[k0];
  await sleep(9500);
  T('пока A на странице, метка обновляется («я отошёл») и пауза не снимается', db.room().p[k0] > v0 && !!ov(B));

  // A возвращается — пауза снимается сама
  await A.click('Продолжить игру', 2500); await waitFor(() => inGame(A), 8000); await closeRoulette(A, 300);
  const gone = await waitFor(() => !ov(B), 8000);
  T('A вернулся в игру: метка «отошёл» стёрта, у B окно паузы исчезло само', inGame(A) && gone && awayKeys().length === 0);

  // «Продолжить без них»
  await openGameMenu(A); await press(A, 'Поставить на паузу', 800); await waitFor(() => !!ov(B), 8000);
  await press(B, 'Продолжить без них', 600);
  T('«Продолжить без них»: окно закрыто, метки погашены (0), игра у B идёт', !ov(B) && inGame(B) && awayKeys().every(k => db.room().p[k] === 0));
  await sleep(1500);
  T('после «без них» пауза не возвращается', !ov(B));
  await waitFor(() => A.has('Присоединиться') || A.has('Продолжить игру'), 5000);

  // закрытие вкладки: pagehide стирает метку сразу
  await joinGame(A).catch(() => {}); await closeRoulette(A, 300); await sleep(9500);
  await openGameMenu(A); await press(A, 'Поставить на паузу', 800); const again = await waitFor(() => !!ov(B), 8000);
  A.w.dispatchEvent(new A.w.Event('pagehide')); const lifted = await waitFor(() => !ov(B), 8000);
  T('вкладка A закрыта (pagehide): метка стёрта, пауза у B снята, A исключён из игры', again && lifted && awayKeys().length === 0);

  // пропал интернет: метка устарела (старше 30 с) — пауза не включается; свежая — включается
  const now = Date.now(); const rid = db.roomId();
  db.seed(rid, ['p', 'away~zz9~' + (now - 90000)], now - 45000);
  await sleep(4000);
  T('устаревшая метка «отошёл» (45 с без обновления: нет сети) пауз не вызывает', !ov(B));
  db.seed(rid, ['p', 'away~zz8~' + (now - 5000)], Date.now());
  const fresh = await waitFor(() => !!ov(B), 8000);
  T('свежая метка другого устройства включает паузу, а «Продолжить без них» гасит её', fresh && (await press(B, 'Продолжить без них', 500), !ov(B)));
  S.finish();
 } catch (e) { S.crash(e); } })();
