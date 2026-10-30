// Режим «Правда или действие»: экран итогов #/tod/results — «Зал позора», добрые титулы, таблица, «Сыграть ещё», «В меню».
const { boot } = require('../tod-ui.js');
const res = []; const T = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n); const errs = [];
const done = (A) => { errs.push(...A.errors); A.close(); };
const step = async (A, t) => { await A.sleep(520); await A.press(t, 420); };
const finishGame = async (A) => { await step(A, 'Меню'); await A.press('Завершить для всех', 500); };

(async () => {
  try {
    let A = await boot(); await A.toLobby();
    await A.tap(A.btns().find(b => b.textContent.trim() === 'Острый' && b.hasAttribute('aria-pressed')));
    await A.startGame();
    for (let i = 0; i < 2; i++) { await step(A, 'Правда'); await step(A, 'Пропустить'); }
    await step(A, 'Действие'); await step(A, 'Легко'); await step(A, 'Пропустить'); // третий пропуск подряд: дальше «Правда» не больше трёх раз подряд
    await step(A, 'Правда'); await step(A, 'Ответил(а)');
    await step(A, 'Действие'); await step(A, 'Средне'); await step(A, 'Выполнено');
    await finishGame(A);
    const txt = A.text();
    const shame = [...A.D.querySelectorAll('.tod-title-shame')].map(x => x.textContent);
    T('три пропуска подряд у Макса -> «Серийный дезертир» и «Главный трус вечера» в «Зале позора»', shame.some(t => t.includes('Главный трус вечера: Макс')) && shame.some(t => t.includes('Серийный дезертир: Макс')));
    const all = [...A.D.querySelectorAll('.tod-title')]; const firstCheer = all.findIndex(x => !x.className.includes('tod-title-shame'));
    T('позорные титулы стоят выше добрых', firstCheer === -1 || all.slice(0, firstCheer).length === shame.length);
    const rows = [...A.D.querySelectorAll('.tod-table tbody tr')].map(r => [...r.children].map(td => td.textContent.trim()));
    const row = (n) => rows.find(r => r[0] === n) || [];
    T('таблица: у Макса 🐔 3, у Ани 🐔 0, числа сходятся с игрой', row('Макс')[1] === '1' && row('Макс')[2] === '3' && row('Аня')[1] === '1' && row('Аня')[2] === '0');
    T('в итогах нет NaN и undefined', !/NaN|undefined/.test(txt));
    T('итоги без подвала: нет footer, есть кубок, три числа партии и подиум с именами', !A.D.querySelector('footer') && !!A.D.querySelector('.tod-res-cup') && A.D.querySelectorAll('.tod-stat').length === 3 && A.D.querySelectorAll('.tod-pod').length === 2 && [...A.D.querySelectorAll('.tod-pod-name')].map(x => x.textContent).sort().join() === 'Аня,Макс');
    await A.press('Сыграть ещё', 500);
    const tone = (t) => A.btns().find(b => b.textContent.trim() === t && b.hasAttribute('aria-pressed'));
    T('«Сыграть ещё» ведёт в лобби с прежними настройками (тон, жёсткие)', A.hashNow() === '#/tod' && tone('Острый').getAttribute('aria-pressed') === 'true' && A.D.querySelector('button[role="switch"]').getAttribute('aria-checked') === 'false');
    done(A);

    A = await boot(); await A.toLobby(); await A.startGame(); await finishGame(A);
    const t2 = A.text();
    T('конец игры сразу: «Сегодня без позора», в тексте нет NaN и undefined', t2.includes('Сегодня без позора') && !/NaN|undefined/.test(t2) && A.D.querySelectorAll('.tod-table tbody tr').length === 2);
    await A.press('В меню', 500);
    T('«В меню» открывает главную', A.hashNow() === '#/');
    done(A);

    A = await boot({ hash: '#/tod/results' });
    T('перезагрузка адреса #/tod/results без игры -> главная (состояния нет)', A.hashNow() === '#/' && !A.text().includes('Зал позора'));
    done(A);

    A = await boot({ lang: 'uk', hash: '#/tod' }); await A.press('Почати гру', 500); await step(A, 'Меню'); await A.press('Завершити для всіх', 500);
    T('украинский интерфейс: итоги переведены', A.hashNow() === '#/tod/results' && A.text().includes('Зала ганьби') && A.text().includes('Зіграти ще') && !A.text().includes('Сыграть'));
    done(A);
  } catch (e) { T('сценарий выполнился без исключений: ' + (e && e.stack), false); }
  console.log(res.join('\n')); console.log('--- captured runtime errors: ' + errs.length); errs.slice(0, 5).forEach(e => console.log(e));
  process.exit(res.some(l => l.startsWith('FAIL')) || errs.length ? 1 : 0);
})();
