// История игр сессии: запись при завершении партии, пункт в меню, список «Прошлые игры», итоги конкретной игры и «Продолжить игру» у последней.
Object.assign(globalThis, require('../harness.js')());
const clickEl = async (el, ms = 250) => { if (!el) throw new Error('нет элемента'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await sleep(ms); };
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const profileNow = () => JSON.parse(w.localStorage.getItem('askme_device_profile_v4') || 'null');
const btnWith = (t) => [...D.querySelectorAll('button')].find(b => norm(b.textContent).includes(t));
(async () => { try {
  w.eval(code); await sleep(1800);
  const inputs = [...D.querySelectorAll('input[type="text"]')]; setVal(inputs[0], 'Макс'); setVal(inputs[1], 'Аня'); await sleep(200);
  await click('Создать сессию', 1200); await click('Перейти к игре', 900);
  // пока ни одной игры: пункт меню предлагает сыграть, список пуст и зовёт начать
  await clickEl(D.querySelector('button[aria-label="Открыть меню"]'), 500);
  T('меню: пункт «Прошлые игры» с подсказкой, пока игр нет', has('Прошлые игры') && has('Здесь появятся ваши игры'));
  await click('Прошлые игры', 500);
  T('пустая история: адрес #/history, заголовок вкладки, приглашение сыграть и кнопка «Начать игру»', w.location.hash === '#/history' && D.title === 'Прошлые игры — ASK ME' && has('Здесь появятся ваши игры') && !!btnWith('Начать игру') && !D.querySelector('.hist-card'));
  await clickEl(D.querySelector('button[aria-label="Назад"]'), 400); await clickEl(D.querySelector('button[aria-label="Назад"]'), 500);

  // игра: вопрос 1 — ответили оба, вопрос 2 — пропущен для всех, дальше «Меню» -> завершить
  await click('Начать игру', 600); await click('Обычный режим', 3800); await click('К вопросу', 600);
  await click('Далее', 500); await click('Далее', 500);
  await click('Далее', 3800); await click('К вопросу', 600);
  await click('Пропустить вопрос', 300); await click('Для всех', 500);
  const menuBtn = [...D.querySelectorAll('button')].find(b => /Меню/.test(b.textContent) && /btn-sm/.test(b.className)); await clickEl(menuBtn, 400);
  const confirm = [...D.querySelectorAll('.viewport-popup-box .grid button')].find(b => b.textContent.trim() !== 'Отмена'); await clickEl(confirm, 500);
  await sleep(1500);
  const p1 = profileNow(); const h1 = p1 && p1.history;
  T('партия завершена: в профиле одна запись истории с итогами (пройден 1, пропущен 1, два игрока, режим «обычный»)', Array.isArray(h1) && h1.length === 1 && h1[0].a === 1 && h1[0].s === 1 && h1[0].m === 'normal' && h1[0].pl.length === 2 && h1[0].pl.map(x => x.name).sort().join() === 'Аня,Макс' && h1[0].n >= 2);
  T('остановились на середине колоды: у записи есть снимок для «Продолжить» (res), игра не помечена «вся колода»', !!h1[0].res && h1[0].res.questionIds.length === h1[0].n && h1[0].all === false);

  await click('В меню', 600);
  await clickEl(D.querySelector('button[aria-label="Открыть меню"]'), 500);
  T('меню: «Прошлые игры» показывают число игр и день последней', /Сыграно игр: 1 · Сегодня/.test(norm(D.body.textContent)));
  await click('Прошлые игры', 600);
  const txt = norm(D.body.textContent);
  T('список: сводка (1 игра, 1 вопрос пройден, 1 пропуск), день «Сегодня», режим, «Последняя», прогресс «Пройдено 1 из N»', !!D.querySelector('.hist-hero-n') && D.querySelector('.hist-hero-n').textContent === '1' && has('игр сыграно в вашей сессии') && /Сегодня/.test(txt) && !!D.querySelector('.hist-card .tag') && [...D.querySelectorAll('.hist-card .tag')].some(t => t.textContent.trim() === 'Обычный') && has('Последняя') && /Пройдено 1 из \d+/.test(txt) && /Пропусков: 1/.test(txt));
  T('у последней незавершённой игры в списке есть «Остановились на вопросе» и «Продолжить игру»; имена игроков на карточке', /Остановились на вопросе \d+ из \d+/.test(txt) && !!btnWith('Продолжить игру') && /Макс · Аня|Аня · Макс/.test(txt));

  await clickEl(D.querySelector('.hist-card-main'), 700);
  const t2 = norm(D.body.textContent);
  T('карточка игры открывает итоги: адрес #/history/view, заголовок «Итоги игры», кольцо 50%, «Кто как играл» с обоими игроками', w.location.hash === '#/history/view' && has('Итоги игры') && has('Кто как играл') && /Макс/.test(t2) && /Аня/.test(t2) && (() => { const ring = D.querySelector('svg circle[style*="stroke-dashoffset"]'); return !!ring && Math.abs(parseFloat(ring.style.strokeDashoffset) - 339.29 * 0.5) < 2; })());
  T('в итогах: три уровня, «Пропущено 1», титул и кнопки «Продолжить игру» и «К списку игр»', ['Лёгкие', 'Средние', 'Глубокие'].every(has) && /Пропущено\s*1/.test(t2) && /(🏆|💪|🌊|🛡️|🔥|✨)\s*[А-ЯЁ]/.test(t2) && !!btnWith('Продолжить игру') && !!btnWith('К списку игр'));
  await click('К списку игр', 500);
  T('«К списку игр» возвращает в список', w.location.hash === '#/history' && has('игр сыграно в вашей сессии'));

  // продолжить последнюю: игра открывается, запись помечена «продолжена», снимок убран
  await clickEl(btnWith('Продолжить игру'), 1800);
  const p2 = profileNow();
  T('«Продолжить игру»: открыт экран игры (#/play), у записи cont=true и нет res, а сохранённая партия на месте', w.location.hash === '#/play' && has('Вопрос №') && p2.history[0].cont === true && !p2.history[0].res && !!p2.savedGame && p2.savedGame.questionIds.length >= 2);

  // повторное открытие адреса итогов с уже выбранной игрой остаётся на итогах (без игры в памяти открылся бы список — это проверяет приложение при перезагрузке)
  w.location.hash = '#/history/view'; await sleep(600);
  T('адрес #/history/view с выбранной игрой остаётся на итогах', w.location.hash === '#/history/view' && has('Кто как играл'));
  console.log(res.join('\n')); console.log('--- captured runtime errors:', errors.length); errors.slice(0, 6).forEach(e => console.log(' ', e)); process.exit(errors.length ? 1 : (res.some(l => l.startsWith('FAIL')) ? 1 : 0));
 } catch (err) { console.log(res.join('\n')); console.log('TEST CRASH:', err.message.split('\n')[0], '| title:', D.title, '| body:', D.body.textContent.replace(/\s+/g, ' ').slice(0, 260)); process.exit(1); } })();
