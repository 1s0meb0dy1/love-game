// Общая среда для UI-проверок: собирает приложение из src/app.jsx и запускает его в эмуляции браузера (jsdom).
const fs = require('fs'); const path = require('path'); const { JSDOM } = require('jsdom'); const babel = require('@babel/core');
module.exports = () => {
  const root = path.join(__dirname, '..');
  const appSrc = fs.readFileSync(path.join(root, 'src/app.jsx'), 'utf8');
  const jsx = appSrc.replace(/^import .*$/gm, '').replace(/^const ReactDOM = \{ \.\.\.ReactDOMAll, createRoot \};$/m, '');
  const code = babel.transformSync(jsx, { presets: [['@babel/preset-react', { runtime: 'classic' }]] }).code;
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8') + '\n<style>' + fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8') + '</style>';
  const exp = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/questions.json'), 'utf8'));
  const qs = { ...exp, _meta: { schema: 1 } }; const qCount = Object.keys(exp).length;
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="root"></div></body></html>', { url: 'https://example.test/love-game/', pretendToBeVisual: true, runScripts: 'outside-only' });
  const w = dom.window; const errors = [];
  w.addEventListener('error', e => errors.push('window.onerror: ' + (e.message || e.error))); w.addEventListener('unhandledrejection', e => errors.push('unhandled: ' + e.reason));
  w.console.error = (...a) => { const m = a.map(String).join(' '); if (!/act\(|Warning: /.test(m)) errors.push('console.error: ' + m.slice(0, 200)); };
  Object.defineProperty(w, 'crypto', { value: require('crypto').webcrypto }); w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
  w.matchMedia = w.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
  w.fetch = async (url) => { url = String(url); const j = (o, ok = true) => ({ ok, status: ok ? 200 : 404, json: async () => o, text: async () => JSON.stringify(o) });
    if (url.includes('questions')) return j(qs); if (url.includes('identitytoolkit') || url.includes('securetoken')) return j({ idToken: 't', refreshToken: 'r', expiresIn: '3600' }); return j(null, false); };
  w.eval(fs.readFileSync(path.join(root, 'node_modules/react/umd/react.development.js'), 'utf8')); w.eval(fs.readFileSync(path.join(root, 'node_modules/react-dom/umd/react-dom.development.js'), 'utf8'));
  const sleep = ms => new Promise(r => setTimeout(r, ms)); const D = w.document;
  const btns = () => [...D.querySelectorAll('button')];
  const has = t => D.body.textContent.includes(t);
  const click = async (t, wait = 400) => { const b = btns().find(x => x.textContent.replace(/\s+/g, ' ').includes(t) && !x.disabled); if (!b) return false; b.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await sleep(wait); return true; };
  const setVal = (el, v) => { const s = Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new w.Event('input', { bubbles: true })); };
  const res = []; const T = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);
  return { fs, JSDOM, babel, html, jsx, code, exp, qs, qCount, dom, w, errors, sleep, D, btns, has, click, setVal, res, T };
};
