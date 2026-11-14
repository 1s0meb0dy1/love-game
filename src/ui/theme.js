// Тема оформлення: «Ніч» (dark), «Світанок» (light) або «Авто» (як у системі).
// Вибір зберігається лише на пристрої. Ранній скрипт у index.html ставить тему до першого кадру,
// цей модуль підтримує її далі: перемикання з меню та реакція на зміну системної теми.
export const THEME_KEY = 'askme_theme_v1';
export const THEME_PREFS = ['auto', 'dark', 'light'];
const META_COLOR = { dark: '#0a0710', light: '#fbf3ef' };

const mq = () => (typeof window !== 'undefined' && window.matchMedia) ? window.matchMedia('(prefers-color-scheme: light)') : null;

export function themeGetPref() {
    try { const v = localStorage.getItem(THEME_KEY); return THEME_PREFS.includes(v) ? v : 'auto'; } catch (e) { return 'auto'; }
}

export function themeResolve(pref) {
    if (pref === 'dark' || pref === 'light') return pref;
    const m = mq();
    return m && m.matches ? 'light' : 'dark';
}

export function themeApply(pref) {
    if (typeof document === 'undefined') return 'dark';
    const mode = themeResolve(pref);
    const root = document.documentElement;
    root.setAttribute('data-theme', mode);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', META_COLOR[mode]);
    return mode;
}

export function themeSetPref(pref) {
    const p = THEME_PREFS.includes(pref) ? pref : 'auto';
    try { localStorage.setItem(THEME_KEY, p); } catch (e) { /* приватний режим: тема діє до перезавантаження */ }
    return themeApply(p);
}

// Слухає системну тему; у режимі «Авто» перемальовує сторінку. Повертає функцію відписки.
export function themeWatch(getPref, onChange) {
    const m = mq();
    if (!m) return () => {};
    const h = () => { if (getPref() === 'auto') { const mode = themeApply('auto'); if (onChange) onChange(mode); } };
    if (m.addEventListener) m.addEventListener('change', h); else if (m.addListener) m.addListener(h);
    return () => { if (m.removeEventListener) m.removeEventListener('change', h); else if (m.removeListener) m.removeListener(h); };
}
