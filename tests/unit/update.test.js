// Обновление приложения не должно перезагружать страницу посреди партии (src/update.js, используется в src/main.jsx).
const fs = require('fs'); const path = require('path');
const { inGameHash } = new Function(fs.readFileSync(path.join(__dirname, '../../src/update.js'), 'utf8').replace(/^export /gm, '') + '; return { inGameHash };')();
const res = []; const T = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
T('экран игры #/play — идёт партия', inGameHash('#/play'));
T('разбор ответа #/ai — тоже партия', inGameHash('#/ai'));
T('с параметрами и вложенным путём — по-прежнему партия', inGameHash('#/play?x=1') && inGameHash('#/play/') && inGameHash('#/ai/step'));
T('итоги партии #/summary и экраны с вводом или секретом в памяти (приглашение, создание сессии, профиль, добавление и правка вопроса, вход владельца) — тоже без перезагрузки', ['#/summary', '#/join', '#/welcome', '#/session-ready', '#/profile', '#/add', '#/edit', '#/admin', '#/join?sid=A'].every(inGameHash));
T('главная, меню, настройка, архив, «Об игре» — не партия: можно обновляться', ['#/', '#/more', '#/mode', '#/setup', '#/archive', '#/about', '#/invite', '#/privacy', ''].every(h => !inGameHash(h)));
T('похожие адреса не считаются партией (#/playlist, #/aid)', !inGameHash('#/playlist') && !inGameHash('#/aid') && !inGameHash('#/about') && !inGameHash('#/summaries') && !inGameHash('#/profiles'));
T('пустое и странное значение не ломает проверку', !inGameHash(undefined) && !inGameHash(null) && !inGameHash(42));
T('партия «Правда или действие»: #/tod, #/tod/play, #/tod/results, #/tod/manage, #/tod?x=1 — без перезагрузки', ['#/tod', '#/tod/play', '#/tod/results', '#/tod/manage', '#/tod?x=1'].every(inGameHash));
T('похожие на #/tod адреса (#/todo, #/topics) — не партия', !inGameHash('#/todo') && !inGameHash('#/topics'));
console.log(res.join('\n')); console.log('--- captured runtime errors: 0'); process.exit(0);
