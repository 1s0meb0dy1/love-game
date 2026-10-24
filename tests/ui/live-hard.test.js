// Усложнённый режим на трёх «телефонах»: таймер и наказания одинаковы у всех, наказание выдаётся один раз на ход,
// а если хозяин хода пропал — его подхватывает ровно одно из оставшихся устройств. Настройки гостей выключены нарочно:
// таймер и наказания должны прийти от хозяина партии, а не из локальных настроек.
const { joinGame, boot, waitFor, sleep, pos, who, inGame, tap, closeRoulette, devId } = require('../live-helpers.js');
const HARD = { timerOn: true, timerSec: 6, punishOn: true, punishments: [{ id: 'x', text: 'Спой припев', level: 'any', icon: '🎤', custom: true }], hiddenTemplates: [] }; // наказание выбирается случайно: из своих и встроенных шаблонов
const OFF = { timerOn: false, timerSec: 30, punishOn: false, punishments: [], hiddenTemplates: [] };
const punText = (E) => { const d = [...E.D.querySelectorAll('div')].find(x => x.textContent.trim() === 'Наказание'); return d && d.nextElementSibling ? d.nextElementSibling.textContent.trim() : null; };
const timeUp = (E) => E.has('Время вышло'), skipPun = (E) => E.has('Пропуск вопроса'), timerShown = (E) => !!E.D.querySelector('[role="timer"]');
(async () => { const S = await boot(3, { latency: () => 20 + Math.random() * 120 }, { setupA: (A) => A.w.localStorage.setItem('askme_game_settings_v1', JSON.stringify(HARD)), setupB: (E) => E.w.localStorage.setItem('askme_game_settings_v1', JSON.stringify(OFF)) });
 const { devs, db, T } = S; const [A, B, C] = devs; const puns = () => new Set(db.log.filter(l => l.body && l.body.pun && l.body.pun.id).map(l => l.body.pun.id)).size;
 try {
  await A.click('Начать игру', 700); await A.click('Усложнённый режим', 900);
  const sb = A.btns().reverse().find(b => b.textContent.trim() === 'Начать игру'); sb.dispatchEvent(new A.w.MouseEvent('click', { bubbles: true })); await sleep(4200);
  const r0 = db.room();
  T('A: усложнённая партия запущена, в комнате таймер 6 с и наказания включены', inGame(A) && r0 && r0.hard === 1 && r0.fx && r0.fx.timerOn === true && r0.fx.timerSec === 6 && r0.fx.punishOn === true);
  await closeRoulette(A, 500);
  // хозяин не отвечает — время вышло, наказание выпало у хозяина ещё до прихода гостей
  const expired = await waitFor(() => timeUp(A), 14000);
  T('A: время вышло — окно наказания с текстом (наказание выбирается случайно из шаблонов)', expired && !!punText(A));
  await sleep(700);
  await waitFor(() => B.has('Присоединиться') && C.has('Присоединиться'), 8000);
  await joinGame(B); await joinGame(C);
  T('B и C присоединились к усложнённой партии', inGame(B) && inGame(C));
  const n1 = puns(); // хозяинское наказание при подключении передаётся гостям одним событием (с номером хода) — новых после этого быть не должно
  T('гости не показывают старое наказание как новое (окно наказания открыто только у хозяина)', timeUp(A) && !timeUp(B) && !timeUp(C));
  // главная проверка №1: хозяин ещё выполняет наказание, а у гостей по их таймеру не должно выпасть второе
  await sleep(14000);
  T('пока хозяин выполняет наказание, у гостей второго наказания нет (событий наказания: ' + puns() + ', было ' + n1 + ')', puns() === n1 && !timeUp(B) && !timeUp(C));
  T('хозяин по-прежнему видит своё окно наказания', timeUp(A));
  const w0 = who(A), p0 = pos(A);
  await A.click('Выполнено', 3000);
  T('A выполнил наказание → ход перешёл дальше у всех (' + who(A) + ' = ' + who(B) + ' = ' + who(C) + ')', who(A) !== w0 && who(B) === who(A) && who(C) === who(A) && pos(A) === p0);
  T('у гостей таймер взят от хозяина: у B и C виден обратный отсчёт нового хода', await waitFor(() => timerShown(B) && timerShown(C), 3000));

  // пропуск с наказанием на гостевом устройстве: у остальных то же окно с пометкой «Пропуск вопроса»
  const n2 = puns();
  await C.click('Пропустить', 600); await C.click('Только', 1500);
  const seen = await waitFor(() => skipPun(A) && skipPun(B), 6000);
  T('C пропустил ход с наказанием: A и B видят то же окно «Пропуск вопроса» с тем же текстом', seen && punText(A) === punText(C) && punText(B) === punText(C) && !!punText(C));
  T('наказание за пропуск выдано один раз', puns() === n2 + 1);
  await C.click('Выполнено', 3000);
  T('C выполнил наказание → окна закрылись у всех, оба игрока пропустили — вопрос пропущен', [A, B, C].every(E => !skipPun(E) && E.has('Вопрос пропущен')));

  // следующий вопрос запускает B — значит, хозяин хода теперь B. Затем B «пропадает»
  await B.click('Далее', 4200); await closeRoulette(B, 400);
  const nxt = await waitFor(() => pos(A) === pos(B) && pos(C) === pos(B) && timerShown(A) && timerShown(C), 8000);
  T('начался следующий вопрос: у A и C идёт таймер (вопрос ' + pos(A) + ' = ' + pos(C) + ')', nxt);
  const n3 = puns(), w1 = who(A); B.w.close();
  // главная проверка №2: наказание выдаёт ровно одно из оставшихся устройств
  const fired = await waitFor(() => timeUp(A) && timeUp(C), 30000);
  T('хозяин хода пропал → через время подхвата у A и C одинаково выпало наказание', fired && punText(A) === punText(C) && !!punText(A));
  await sleep(6000);
  T('наказание выдало ровно одно устройство (новых событий наказания: ' + (puns() - n3) + ')', puns() === n3 + 1);
  // закрывает наказание то устройство, на котором оно «настоящее»; на остальных окно только показывает его
  await A.click('Выполнено', 600); await C.click('Выполнено', 600); await sleep(3000);
  T('после «Выполнено» ход перешёл дальше, окна закрылись и у A, и у C (' + who(A) + ' = ' + who(C) + ')', !timeUp(A) && !timeUp(C) && ((who(A) && who(A) === who(C) && who(A) !== w1) || (A.has('Вопрос пропущен') && C.has('Вопрос пропущен')) || (A.has('Вопрос пройден') && C.has('Вопрос пройден'))));
  T('ни одна запись не отклонена правилами базы', db.stats.denied === 0);
  S.finish(0);
 } catch (err) { S.crash(err); } })();
