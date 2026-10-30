// Знайомство з грою у вигляді «сторіс»: показується новому гравцю при першому візиті без сесії (не тим, хто прийшов за запрошенням).
// Історії гортаються самі (смужки зверху), торкання праворуч — далі, ліворуч — назад, утримання — пауза, свайп униз — закрити.
// На комп'ютері — рамка 9:16 по центру зі стрілками збоку і клавішами ← → / пробіл / Esc.
// Усе потрібне від застосунку приходить пропсами: ui = { AskMeLogo, LangMenu, Icons, SoundFX }. Тексти — у src/content/intro.js.
// В тестах модуль підставляється в код app.jsx, тому з React — лише React.useState тощо (без деструктуризації).
import React from 'react';
import { INTRO } from '../content/intro.js';

export const INTRO_MS = 6500; // скільки триває одна історія
export const INTRO_SEEN_KEY = 'askme_intro_seen_v1';
export const introSeen = () => { try { return localStorage.getItem(INTRO_SEEN_KEY) === '1'; } catch (e) { return false; } };
export const introMarkSeen = () => { try { localStorage.setItem(INTRO_SEEN_KEY, '1'); } catch (e) {} };
// показувати лише гостю без сесії, що відкрив головну чи привітання (не за посиланням-запрошенням, не на сторінках документів)
export const introShouldShow = ({ hasProfile, screen, hash }) => !hasProfile && screen === 'onboarding' && !/[?&](sid|key)=/.test(String(hash || '')) && !introSeen();

const introPick = (obj, lang) => (obj && (obj[lang] || obj.uk)) || {};
const introFill = (s, vars) => String(s).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
export const introReplayLabel = (lang) => introPick(INTRO.ui, lang).replay;
const INTRO_TONE = { hello: 'rose', depth: 'ember', turn: 'rose', tod: 'hot', together: 'orchid', start: 'rose' };

// ---- ілюстрації історій (анімуються лише transform і opacity; кінцевий кадр — осмислений, тож при «зменшенні руху» видно саме його) ----
const ArtHello = ({ ui }) => (
    <div className="ia ia-hello" aria-hidden="true">
        <div className="ia-rings"><i /><i /><i /></div>
        <div className="ia-heart"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg></div>
        <span className="ia-bub b1">?</span><span className="ia-bub b2">!</span><span className="ia-bub b3">…</span><span className="ia-bub b4">?</span>
        <div className="ia-word font-display">ASK<span>ME</span></div>
    </div>
);
const ArtDepth = ({ s }) => (
    <div className="ia ia-depth" aria-hidden="true">
        <span className="ia-meter"><i /></span>
        {s.cards.map((q, k) => (
            <div key={k} className={`ia-card lvl-${k + 1}`} style={{ '--k': k }}>
                <span className="ia-lvl"><b /><b /><b />{s.levels[k]}</span>
                <p>{q}</p>
            </div>
        ))}
    </div>
);
const ArtTurn = ({ s }) => {
    const n = s.names.length, pick = 2;
    return (
        <div className="ia ia-turn" aria-hidden="true">
            <div className="ia-dial">
                {s.names.map((nm, k) => (
                    <span key={k} className={`ia-av ${k === pick ? 'is-pick' : ''}`} style={{ '--a': (k * 360 / n) + 'deg', '--h': k }}><b>{nm.slice(0, 1)}</b></span>
                ))}
                <span className="ia-needle" style={{ '--to': (720 + pick * 360 / n) + 'deg' }}><i /></span>
                <span className="ia-hub" />
            </div>
            <div className="ia-turn-name"><span>{s.answers}</span> <b>{s.names[pick]}</b></div>
        </div>
    );
};
const ArtTod = ({ s }) => (
    <div className="ia ia-tod" aria-hidden="true">
        <div className="ia-pills"><span>{s.truth}</span><span className="is-on">{s.dare}</span></div>
        <div className="ia-flip">
            <div className="ia-face ia-back"><span className="font-display">?</span></div>
            <div className="ia-face ia-front">
                <span className="tod-lvl tod-lvl-medium"><span className="tod-lvl-dots"><i className="on" /><i className="on" /><i /></span></span>
                <p>{s.card}</p>
            </div>
        </div>
        <span className="ia-chicken">🐔 <b>+1</b> {s.chicken}</span>
    </div>
);
const ArtTogether = ({ s }) => (
    <div className="ia ia-together" aria-hidden="true">
        <div className="ia-phones">
            {[0, 1, 2].map(k => (
                <div key={k} className={`ia-phone p${k}`}>
                    <i className="ia-notch" />
                    <div className="ia-mini"><b /><b /><b className="short" /></div>
                    <span className="ia-sync" />
                </div>
            ))}
        </div>
        <div className="ia-chips">{s.chips.map((c, k) => <span key={k} style={{ '--k': k }}>{c}</span>)}</div>
    </div>
);
const ArtStart = ({ s, ui }) => (
    <div className="ia ia-start" aria-hidden="true">
        <div className="ia-rings"><i /><i /><i /></div>
        <div className="ia-sparks">{Array.from({ length: 14 }, (_, k) => <i key={k} style={{ '--a': (k * 360 / 14) + 'deg', '--k': k }} />)}</div>
        <div className="ia-start-logo"><ui.AskMeLogo size="lg" /></div>
        <div className="ia-start-steps">{s.steps.map((t, k) => <span key={k} style={{ '--k': k }}><b>{k + 1}</b>{t}</span>)}</div>
    </div>
);
const INTRO_ART = { hello: ArtHello, depth: ArtDepth, turn: ArtTurn, tod: ArtTod, together: ArtTogether, start: ArtStart };

export const IntroStories = ({ lang, onClose, onLang, ui }) => {
    const reduce = React.useMemo(() => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }, []);
    const slides = INTRO.slides; const last = slides.length - 1; const L = introPick(INTRO.ui, lang);
    const [i, setI] = React.useState(0);
    const [paused, setPaused] = React.useState(reduce); // при «зменшенні руху» історії самі не гортаються
    const [held, setHeld] = React.useState(false);
    const [hidden, setHidden] = React.useState(() => { try { return document.hidden; } catch (e) { return false; } });
    const running = !paused && !held && !hidden && i < last;
    const left = React.useRef({ slide: -1, ms: INTRO_MS }); const press = React.useRef(null); const box = React.useRef(null); 
    const go = (d) => setI(x => Math.max(0, Math.min(last, x + d)));
    const close = (why) => { onClose(why); };

    // таймер історії: залишок часу переживає паузу; новий слайд — повний час
    React.useEffect(() => {
        if (left.current.slide !== i) left.current = { slide: i, ms: INTRO_MS };
        if (!running) return undefined;
        const t0 = Date.now(); const tm = setTimeout(() => go(1), left.current.ms);
        return () => { clearTimeout(tm); left.current.ms = Math.max(0, left.current.ms - (Date.now() - t0)); };
    }, [i, running]);
    React.useEffect(() => { const f = () => setHidden(document.hidden); document.addEventListener('visibilitychange', f); return () => document.removeEventListener('visibilitychange', f); }, []);
    React.useEffect(() => { try { box.current.focus({ preventScroll: true }); } catch (e) {} }, []); // фокус на саме вікно (не на «закрити»), щоб не малювати кільце фокусу без потреби
    // клавіші: ← → гортати, пробіл — пауза, Esc — закрити; Tab не виходить за межі вікна
    React.useEffect(() => {
        const key = (e) => {
            if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
            else if (e.key === 'Escape') { if (!document.querySelector('.intro .menu-pop')) { e.preventDefault(); close('close'); } }
            else if ((e.key === ' ' || e.key === 'Spacebar') && !(e.target && e.target.closest && e.target.closest('button, input, [role="menu"]'))) { e.preventDefault(); setPaused(p => !p); }
            else if (e.key === 'Tab' && box.current) {
                const f = [...box.current.querySelectorAll('button:not([disabled])')].filter(b => b.offsetParent !== null || b === document.activeElement);
                if (!f.length) return; const a = f[0], z = f[f.length - 1];
                if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
            }
        };
        document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key);
    }, [last]);
    // не даємо сторінці під вікном прокручуватися
    React.useEffect(() => { const b = document.body; const prev = b.style.overflow; b.style.overflow = 'hidden'; return () => { b.style.overflow = prev; }; }, []);

    // зони торкання: коротке торкання — гортання (через click), утримання — пауза, свайп убік — гортання, свайп униз — закрити
    const down = (e) => { const p = { x: e.clientX || 0, y: e.clientY || 0, hold: false, moved: false }; p.tm = setTimeout(() => { p.hold = true; setHeld(true); }, 220); press.current = p; };
    const up = (e) => {
        const p = press.current; if (!p) return; clearTimeout(p.tm); press.current = null;
        if (p.hold) { setHeld(false); p.swallow = true; }
        const dx = (e.clientX || 0) - p.x, dy = (e.clientY || 0) - p.y;
        if (!p.hold && (Math.abs(dx) > 40 || Math.abs(dy) > 40)) { p.moved = true; if (dy > 90 && Math.abs(dy) > Math.abs(dx)) close('close'); else if (Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1); }
        if (p.hold || p.moved) { const stop = (ev) => { ev.stopPropagation(); ev.preventDefault(); }; window.addEventListener('click', stop, { capture: true, once: true }); setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 60); }
    };
    const cancel = () => { const p = press.current; if (!p) return; clearTimeout(p.tm); press.current = null; if (p.hold) setHeld(false); };
    const zone = { onPointerDown: down, onPointerUp: up, onPointerCancel: cancel, onPointerLeave: cancel, onContextMenu: (e) => e.preventDefault() };

    const sl = slides[i]; const s = introPick(sl, lang); const Art = INTRO_ART[sl.id] || ArtHello;
    const tone = INTRO_TONE[sl.id] || 'rose';
    const view = (
        <div className={`intro ${held ? 'is-held' : ''}`} role="dialog" aria-modal="true" aria-label={L.label} ref={box} tabIndex={-1}>
            <button type="button" className="intro-side is-prev btn-icon lg" onClick={() => { ui.SoundFX.click(); go(-1); }} disabled={i === 0} aria-label={L.prev}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg></button>
            <div className="intro-frame" data-tone={tone}>
                <div className="intro-glow" aria-hidden="true">{['rose', 'ember', 'orchid', 'hot'].map(t => <i key={t} className={`g-${t} ${t === tone ? 'is-on' : ''}`} />)}</div>
                <div className="intro-bars" aria-hidden="true">
                    {slides.map((x, k) => <i key={x.id}><b key={k === i ? 'run' + i : 'b'} className={k < i ? 'is-done' : k === i ? 'is-run' : ''} style={k === i ? { animationDuration: INTRO_MS + 'ms', animationPlayState: running || i === last ? 'running' : 'paused' } : undefined} /></i>)}
                </div>
                <div className="intro-top">
                    <ui.AskMeLogo size="xs" />
                    <span className="intro-top-r">
                        <ui.LangMenu lang={lang} onChange={onLang} />
                        {!reduce && i < last && <button type="button" className="btn-icon plain" onClick={() => setPaused(p => !p)} aria-label={paused ? L.play : L.pause} aria-pressed={paused}>{paused ? <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5.14v14l11-7-11-7z" /></svg> : <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1.2" /><rect x="14" y="5" width="4" height="14" rx="1.2" /></svg>}</button>}
                        <button type="button" className="btn-icon plain intro-x" onClick={() => { ui.SoundFX.click(); close('close'); }} aria-label={L.close}><ui.Icons.Close /></button>
                    </span>
                </div>
                <button type="button" className="intro-zone is-prev" {...zone} onClick={() => go(-1)} aria-label={L.prev} tabIndex={-1} />
                <button type="button" className="intro-zone is-next" {...zone} onClick={() => go(1)} aria-label={L.next} tabIndex={-1} />
                <div className="intro-body" key={sl.id} aria-live="polite">
                    <div className="intro-art"><Art s={s} ui={ui} /></div>
                    <div className="intro-copy">
                        <span className="sr-only">{introFill(L.of, { v0: i + 1, v1: slides.length })}. </span>
                        <p className="intro-kicker">{s.kicker}</p>
                        <h2 className="intro-title font-display">{s.title}</h2>
                        <p className="intro-text">{s.text}</p>
                    </div>
                </div>
                <div className="intro-cta">
                    <button type="button" className={`btn-primary w-full ${i === last ? 'is-final' : ''}`} onClick={() => { ui.SoundFX.click(); close('start'); }}>{L.start}<ui.Icons.Next /></button>
                    <p className="intro-hint">{L.hint}</p>
                </div>
            </div>
            <button type="button" className="intro-side is-next btn-icon lg" onClick={() => { ui.SoundFX.click(); go(1); }} disabled={i === last} aria-label={L.next}><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
            <p className="intro-keys" aria-hidden="true">{L.keys}</p>
        </div>
    );
    return ui.portal ? ui.portal(view) : view; // у document.body: інакше вікно лишається під верхньою панеллю комп'ютерної версії
};
