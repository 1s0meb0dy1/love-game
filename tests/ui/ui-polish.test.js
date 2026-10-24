// Правки внешнего вида: слоган для гостя, ID сессии рядом с «Начать игру», линия над подвалом, названия тем, всплывающие уведомления.
// Размеры и переносы строк (то, что делает браузер) проверяются в настоящем браузере вне этого набора; здесь — разметка, правила и поведение.
Object.assign(globalThis, require('../harness.js')());
const css = require('fs').readFileSync(require('path').join(__dirname, '../../src/styles.css'), 'utf8');
const go = async (hash, ms = 500) => { w.location.hash = hash; w.dispatchEvent(new w.HashChangeEvent('hashchange')); await sleep(ms); };
const clickEl = async (el, ms = 250) => { if (!el) throw new Error('нет элемента'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await sleep(ms); };
const startBtn = () => [...D.querySelectorAll('button')].find(b => /^\s*Начать (новую )?игру\s*$/.test(b.textContent));
const rules = () => D.querySelectorAll('.footer-rule').length;
const toast = () => D.querySelector('.toast-layer .toast');
(async () => { try {
  w.eval(code); await sleep(1800);
  // ---------- слоган для гостя (профиля нет, режим предпросмотра) ----------
  const closeBtn = [...D.querySelectorAll('button.btn-icon')].find(b => /absolute/.test(b.className)); await clickEl(closeBtn, 500);
  T('гость на главной: слоган «Откровенные разговоры для пар и компаний» (не «для двоих»)', has('Откровенные разговоры для пар и компаний') && !has('для двоих'));
  T('гость на главной: линия над подвалом есть', rules() === 1);
  await go('#/welcome', 600); const inputs = [...D.querySelectorAll('input[type="text"]')]; setVal(inputs[0], 'Макс'); setVal(inputs[1], 'Аня'); await sleep(200);
  await click('Создать сессию', 1200); await click('Перейти к игре', 900);
  T('вошедшему игроку слоган прежний: двое игроков — «для двоих»', has('Откровенные разговоры для двоих') && !has('для пар и компаний'));

  // ---------- ID сессии стоит сразу под «Начать игру» ----------
  const id = [...D.querySelectorAll('p')].find(p => /^ID сессии:/.test(p.textContent.trim()));
  T('ID сессии: стоит в одном блоке с кнопкой «Начать игру», сразу после подсказки под ней', !!id && id.parentElement === startBtn().parentElement && id.previousElementSibling && id.previousElementSibling.id === 'start-hint' && startBtn().nextElementSibling === id.previousElementSibling);
  T('ID сессии: единственный на экране, показывает ID профиля', D.body.textContent.split('ID сессии:').length === 2 && id.textContent.includes(JSON.parse(w.localStorage.getItem('askme_device_profile_v4')).sessionId));
  T('главная: линия над подвалом есть, она шире на компьютере (is-wide)', rules() === 1 && D.querySelector('.footer-rule').className.includes('is-wide') && /@media \(min-width: 1024px\) \{ :root \.footer-rule\.is-wide/.test(css));

  // ---------- названия тем ----------
  const names = [...D.querySelectorAll('.tile span.truncate')].map(s => s.className);
  T('названия тем на главной — 13 px (text-[13px]), число вопросов и значок не сжимаются', names.length === 10 && names.every(c => c.includes('text-[13px]')) && [...D.querySelectorAll('.tile')].every(t => t.querySelector('span.flex-shrink-0')));

  // ---------- линия над подвалом: где есть, где нет ----------
  const pages = [['#/', true, 'главная'], ['#/profile', true, 'игроки и сессия'], ['#/about', true, 'об игре'], ['#/privacy', true, 'конфиденциальность'], ['#/invite', true, 'приглашение'],
    ['#/more', false, 'меню'], ['#/mode', false, 'выбор режима'], ['#/setup', false, 'усложнённый режим']];
  for (const [hash, want, name] of pages) { await go(hash, 600); T('линия над подвалом: ' + name + (want ? ' — есть' : ' — нет') + ' (' + hash + ')', want ? rules() === 1 : rules() === 0 && !!D.querySelector('footer')); }

  // ---------- уведомления ----------
  await go('#/more', 500);
  const share = [...D.querySelectorAll('button')].find(b => b.textContent.includes('Поделиться') && /btn-primary/.test(b.className));
  w.navigator.share = undefined; w.navigator.clipboard = { writeText: async () => {} };
  await clickEl(share, 400);
  const t1 = toast();
  T('уведомление: «ok» — зелёное, с иконкой-галочкой, role="status", одно на экране', !!t1 && t1.className.includes('toast-ok') && t1.getAttribute('role') === 'status' && D.querySelectorAll('.toast').length === 1 && !!t1.querySelector('.toast-ico svg') && /скопирована/.test(t1.textContent));
  T('уведомление: длительность задаёт --toast-ms (2800 ms), оно рисуется в отдельном слое поверх экрана', t1.style.getPropertyValue('--toast-ms') === '2800ms' && t1.parentElement.className === 'toast-layer' && t1.closest('#root') === null);
  await go('#/', 600);
  T('уведомление не пересоздаётся при смене экрана и перерисовках (тот же элемент)', toast() === t1 && t1.isConnected);
  await sleep(2600); T('уведомление «ok» исчезает само по истечении 2,8 с', !toast());
  T('слой уведомлений — постоянная живая область aria-live="polite" (читалки экрана озвучивают появившееся уведомление), пустой слой ничего не перекрывает', !!D.querySelector('.toast-layer[aria-live="polite"]') && D.querySelector('.toast-layer').children.length === 0);
  // «Теперь отвечает …» при старте игры — уведомление вида turn
  await go('#/', 600); await clickEl(startBtn(), 600); await click('Обычный режим', 4300); await click('К вопросу', 700); await click('Далее', 600);
  let tt = toast(); for (let k = 0; k < 40 && !(tt && /Теперь отвечает/.test(tt.textContent)); k++) { await sleep(150); tt = toast(); }
  T('«Теперь отвечает …» в игре — уведомление вида turn (розовое, role="status", иконка игрока)', !!tt && tt.className === 'toast toast-turn' && /Теперь отвечает (Макс|Аня)/.test(tt.textContent) && tt.getAttribute('role') === 'status' && !!tt.querySelector('.toast-ico svg'));
  await sleep(3000); T('уведомление исчезает само по истечении времени', !toast());
  // каждый вызов showToast в коде с видом использует только известные виды, а у каждого вида есть оформление
  const src = require('fs').readFileSync(require('path').join(__dirname, '../../src/app.jsx'), 'utf8');
  const used = [...src.matchAll(/showToast\((?:[^()]|\([^()]*\))*?,\s*\d+,\s*'(\w+)'\)/g)].map(m => m[1]); const KNOWN = ['ok', 'turn', 'info', 'warn'];
  T('в коде виды уведомлений только из набора ok / turn / info / warn (найдено вызовов с видом: ' + used.length + ')', used.length >= 12 && used.every(k => KNOWN.includes(k)) && ['turn', 'info', 'warn'].every(k => used.includes(k)));
  T('стили уведомлений заданы для четырёх видов и учитывают безопасную зону', ['toast-turn', 'toast-info', 'toast-warn'].every(k => css.includes(':root .' + k + ' {')) && /\.toast-layer \{[^}]*env\(safe-area-inset-top/.test(css) && /\.toast \{[^}]*width: max-content[^}]*max-width: min\(100%/.test(css));
  console.log(res.join('\n')); console.log('--- captured runtime errors:', errors.length); errors.slice(0, 6).forEach(e => console.log(' ', e)); process.exit(0);
 } catch (err) { console.log(res.join('\n')); console.log('TEST CRASH:', err.stack.split('\n').slice(0, 3).join(' | ')); process.exit(1); } })();
