// Кнопка «Наверх», общая шапка страниц и страница «Игроки»: стрелка появляется только при прокрутке вверх глубже первого экрана,
// заголовки шапок строго по центру (сетка «назад / заголовок / действие»), над именами игроков есть заголовок, к сторис можно вернуться.
// Пиксели и прокрутку считает браузер, поэтому здесь: прокрутка имитируется (scrollY + событие scroll), а вёрстка проверяется по правилам CSS и разметке.
Object.assign(globalThis, require('../harness.js')());
const css = require('fs').readFileSync(require('path').join(__dirname, '../../src/styles.css'), 'utf8');
const go = async (hash, ms = 500) => { w.location.hash = hash; w.dispatchEvent(new w.HashChangeEvent('hashchange')); await sleep(ms); };
const clickEl = async (el, ms = 250) => { if (!el) throw new Error('нет элемента'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await sleep(ms); };
const top = () => D.querySelector('.to-top');
const scrollTo = async (y) => { Object.defineProperty(w, 'scrollY', { value: y, configurable: true }); w.dispatchEvent(new w.Event('scroll')); await sleep(120); };
(async () => { try {
  w.eval(code); await sleep(1800);
  w.innerHeight = 800;
  T('кнопка «Наверх» есть в документе, это кнопка с подписью и скрыта по умолчанию', !!top() && top().tagName === 'BUTTON' && top().getAttribute('aria-label') === 'Наверх' && !top().classList.contains('is-on') && top().getAttribute('aria-hidden') === 'true');
  T('на кнопке стрелка вверх (svg), текста нет', !!top().querySelector('svg') && top().textContent.trim() === '');
  await scrollTo(1500); T('листаем вниз глубже первого экрана — кнопка не появляется', !top().classList.contains('is-on'));
  await scrollTo(1300); T('листаем вверх глубже первого экрана — кнопка появляется', top().classList.contains('is-on') && top().getAttribute('aria-hidden') === null);
  await scrollTo(1600); T('снова вниз — кнопка скрывается', !top().classList.contains('is-on'));
  await scrollTo(1400); await scrollTo(700); T('вверх до первого экрана и выше — кнопка скрывается', !top().classList.contains('is-on'));
  await scrollTo(1400); let called = null; w.scrollTo = (a) => { called = a; }; await scrollTo(1200); await clickEl(top(), 200);
  T('нажатие возвращает наверх плавно (или сразу при «меньше движения»), кнопка прячется', !!called && called.top === 0 && /smooth|auto/.test(called.behavior) && !top().classList.contains('is-on'));
  T('стили: плавное появление (opacity и transform), справа внизу, при «меньше движения» без анимации', /\.to-top \{[^}]*position: fixed; right: max\(1rem[^}]*bottom: max\(1\.25rem[^}]*opacity: 0[^}]*transition: opacity/.test(css) && /\.to-top\.is-on \{[^}]*opacity: 1/.test(css) && /prefers-reduced-motion: reduce\) \{ :root \.to-top/.test(css));

  // ---------- шапка: заголовок по центру ----------
  T('шапка страницы — сетка из трёх колонок одной ширины (заголовок строго по центру)', /:root \.page-head \{ display: grid; grid-template-columns: var\(--ctl-h\) minmax\(0, 1fr\) var\(--ctl-h\)/.test(css) && /\.page-head > \.page-title[^{]*\{[^}]*grid-column: 2[^}]*text-align: center/.test(css));
  T('на компьютере шапка снова в строку, заголовок слева', /@media \(min-width: 1024px\) \{[\s\S]*:root \.page-head \{ display: flex;/.test(css));
  T('виньетки нет, верх экрана страница не затемняет', !/\.bg-room::after/.test(css));

  // ---------- «Игроки и сессия» ----------
  await go('#/welcome', 600); const inputs = [...D.querySelectorAll('input[type="text"]')]; setVal(inputs[0], 'Макс'); setVal(inputs[1], 'Аня'); await sleep(200);
  await click('Создать сессию', 1200); await click('Перейти к игре', 900);
  await go('#/profile', 700);
  const heads = [...D.querySelectorAll('main h2')].map(h => h.textContent.trim());
  const form = D.querySelector('form.prof-main'); const ttl = form && form.querySelector('.prof-title');
  T('над полями имён — заголовок «Имена игроков»', !!ttl && ttl.textContent.trim() === 'Имена игроков' && heads.includes('Имена игроков') && ttl.nextElementSibling.querySelector('input') !== null);
  T('нижние блоки страницы стоят в колонке с отступами (без слипания)', /:root \.prof-side \{ display: flex; flex-direction: column; gap: 1\.25rem/.test(css) && !!D.querySelector('.prof-side'));
  const replay = D.querySelector('.prof-side .intro-replay');
  T('на странице есть кнопка возврата к сторис', !!replay && /30 секунд|секунд/.test(replay.textContent));
  await clickEl(replay, 700);
  T('сторис открываются поверх страницы «Игроки»', !!D.querySelector('.intro'));
  const closeI = D.querySelector('.intro button[aria-label="Закрыть"]') || [...D.querySelectorAll('.intro button')].find(b => /Закрыть|close/i.test(b.getAttribute('aria-label') || '')); if (closeI) await clickEl(closeI, 700);
  T('сторис закрываются, пользователь остаётся на странице «Игроки» со своей сессией', !D.querySelector('.intro') && D.title === 'Игроки и сессия — ASK ME' && has('Имена игроков'));
} catch (e) { console.log('TEST CRASH:', e && e.message); T('тест не упал: ' + (e && e.message), false); } console.log(res.join('\n')); console.log('--- captured runtime errors:', errors.length); errors.slice(0, 6).forEach(x => console.log(' ', x)); process.exit(res.some(l => l.startsWith('FAIL')) || errors.length ? 1 : 0); })();
