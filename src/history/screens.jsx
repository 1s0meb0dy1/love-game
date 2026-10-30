// История партий: экраны «Прошлые игры» (список по дням) и «Игра от …» (итоги конкретной партии; у последней незавершённой — «Продолжить игру»).
// Всё нужное от приложения приходит пропсами и объектом ui = { Icons, SoundFX, AppFooter, SummaryRing, SummaryBars, AnimatedCounter }:
// в тестах модуль подставляется в код app.jsx, поэтому он ничего не импортирует из app.jsx. Из React — только React.useState и т. п. (без деструктуризации).
import React from 'react';
import { HIST_MAX, histBadge, histTotals } from './model.js';
import { t as tr, tf, getLang } from '../i18n.js';

const histLocale = (lang) => (lang === 'uk' ? 'uk-UA' : 'ru-RU');
// «Сегодня», «Вчера» или дата словами («12 октября», с годом, если не этот)
export const histDayLabel = (t, now, lang) => {
  const d = new Date(t); const n = new Date(now);
  const day0 = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day0(n) - day0(d)) / 86400000);
  if (diff === 0) return tr('Сегодня');
  if (diff === 1) return tr('Вчера');
  try { return new Intl.DateTimeFormat(histLocale(lang), d.getFullYear() === n.getFullYear() ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' }).format(d); } catch (e) { return d.toDateString(); }
};
export const histTime = (t, lang) => { try { return new Intl.DateTimeFormat(histLocale(lang), { hour: '2-digit', minute: '2-digit' }).format(new Date(t)); } catch (e) { return ''; } };
const histModeLabel = (g) => (g.m === 'hard' ? tr('Усложнённый режим') : tr('Обычный режим'));
const histModeShort = (g) => (g.m === 'hard' ? tr('Усложнённый') : tr('Обычный')); // на карточке списка — короче, чтобы метки помещались в одну строку
const histNames = (g) => g.pl.map(p => p.name).filter(Boolean).join(' · ');

// список игр: сводка, потом карточки по дням; у самой свежей незавершённой игры — «Продолжить игру»
export const HistList = ({ ui, history, onOpen, onResume, onStart, onBack, topicInfo }) => {
  const list = Array.isArray(history) ? history : []; const lang = getLang(); const now = Date.now();
  const tot = histTotals(list); const top = tot.topCat && typeof topicInfo === 'function' ? topicInfo(tot.topCat) : null;
  const groups = []; list.forEach(g => { const label = histDayLabel(g.t, now, lang); const last = groups[groups.length - 1]; if (last && last.label === label) last.items.push(g); else groups.push({ label, items: [g] }); });
  const stat = (v, label) => <li className="hist-stat"><span className="hist-stat-v">{v}</span><span className="hist-stat-l">{label}</span></li>;
  return (
    <div className="safe-screen w-full flex flex-col items-center slide-up relative z-10">
      <header className="page-head w-full max-w-md lg:max-w-3xl flex items-center gap-3 pt-2">
        <button type="button" aria-label={tr('Назад')} onClick={() => { ui.SoundFX.click(); onBack(); }} className="btn-icon flex-shrink-0"><ui.Icons.Back /></button>
        <h1 className="page-title flex-1 text-center pr-11 text-lg font-bold text-white">{tr('Прошлые игры')}</h1>
      </header>
      <main className={`w-full max-w-md lg:max-w-3xl flex flex-col gap-6 pt-6 pb-8 ${list.length ? 'hist-page' : 'hist-page is-empty'}`}>
        {list.length === 0 ? (
          <section className="hist-empty">
            <span aria-hidden="true" className="hist-empty-ico">🎲</span>
            <h2 className="hist-empty-h">{tr('Здесь появятся ваши игры')}</h2>
            <p className="hist-empty-p">{tr('Сыграйте первую партию — и она сохранится тут: когда играли, кто участвовал и чем всё закончилось.')}</p>
            <button type="button" onClick={() => { ui.SoundFX.click(); onStart(); }} className="btn-primary w-full"><ui.Icons.Play /> {tr('Начать игру')}</button>
          </section>
        ) : (
          <>
            <section className="hist-hero" aria-label={tr('Сводка по играм')}>
              <p className="hist-hero-n">{tot.games}</p>
              <p className="hist-hero-l">{tr('игр сыграно в вашей сессии')}</p>
              <ul className="hist-stats">
                {stat(tot.answered, tr('вопросов пройдено'))}
                {stat(tot.skipped, tr('пропусков'))}
                {top ? stat(<span aria-hidden="true">{top.icon}</span>, top.name) : null}
              </ul>
            </section>
            <div className="hist-feed">
            {groups.map(grp => (
              <section key={grp.label} className="flex flex-col gap-3" aria-label={grp.label}>
                <h2 className="hist-day">{grp.label}</h2>
                <ul className="hist-list flex flex-col gap-3">
                  {grp.items.map(g => {
                    const isLast = g.id === list[0].id; const pct = g.n > 0 ? Math.min(100, Math.round((g.a / g.n) * 100)) : 0;
                    return (
                      <li key={g.id} className={`hist-card ${isLast ? 'is-last' : ''}`}>
                        <button type="button" onClick={() => { ui.SoundFX.click(); onOpen(g.id); }} className="hist-card-main" aria-label={`${grp.label}, ${histTime(g.t, lang)}: ${histNames(g)}`}>
                          <span className="hist-card-top">
                            <span className="hist-time">{histTime(g.t, lang)}</span>
                            <span className={`tag ${g.m === 'hard' ? 'tag-warn' : ''}`}>{histModeShort(g)}</span>
                            {isLast && <span className="tag tag-rose">{tr('Последняя')}</span>}
                          </span>
                          <span className="hist-names">{histNames(g)}</span>
                          <span className="hist-prog">
                            <span className="hist-prog-bar" aria-hidden="true"><i style={{ width: pct + '%' }}></i></span>
                            <span className="hist-prog-txt">{tf('Пройдено {v0} из {v1}', { v0: g.a, v1: g.n })}</span>
                          </span>
                          {(g.all || g.cont || g.s > 0) && (
                            <span className="hist-tags">
                              {g.all && <span className="tag tag-ok">{tr('🏆 Прошли всю колоду')}</span>}
                              {g.cont && <span className="tag">{tr('Продолжили позже')}</span>}
                              {g.s > 0 && <span className="tag">{tf('Пропусков: {v0}', { v0: g.s })}</span>}
                            </span>
                          )}
                          <span aria-hidden="true" className="hist-chev">›</span>
                        </button>
                        {g.res && (
                          <div className="hist-card-foot">
                            <p className="hist-stop">{tf('Остановились на вопросе {v0} из {v1}', { v0: g.r, v1: g.n })}</p>
                            <button type="button" onClick={() => { ui.SoundFX.click(); onResume(g); }} className="btn-primary btn-sm"><ui.Icons.Resume /> {tr('Продолжить игру')}</button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            <p className="ui-hint text-center">{tf('Здесь хранятся последние {v0} игр сессии.', { v0: HIST_MAX })}</p>
            </div>
          </>
        )}
      </main>
      <ui.AppFooter divider={false} />
    </div>
  );
};

// итоги одной игры (как экран «Игра завершена»): кольцо, отличие, уровни, кто как играл, главные темы, «Продолжить игру» у последней незавершённой
export const HistView = ({ ui, rec, onBack, onResume, onPlay, topicInfo }) => {
  const lang = getLang(); const now = Date.now();
  const frac = rec.a + rec.s > 0 ? rec.a / (rec.a + rec.s) : 0;
  const topics = (rec.tc || []).map(([id, n]) => ({ n, info: typeof topicInfo === 'function' ? topicInfo(id) : null })).filter(x => x.info);
  return (
    <div className="safe-screen w-full flex flex-col items-center slide-up relative z-10">
      <header className="page-head w-full max-w-md lg:max-w-3xl flex items-center gap-3 pt-2">
        <button type="button" aria-label={tr('К списку игр')} onClick={() => { ui.SoundFX.click(); onBack(); }} className="btn-icon flex-shrink-0"><ui.Icons.Back /></button>
        <h1 className="page-title flex-1 text-center pr-11 text-lg font-bold text-white">{tr('Итоги игры')}</h1>
      </header>
      <main className="w-full max-w-md lg:max-w-3xl flex flex-col gap-6 pt-6 pb-8 desk-cols">
        <section className="hist-view-hero">
          <p className="hist-view-when">{histDayLabel(rec.t, now, lang)} · {histTime(rec.t, lang)}</p>
          <p className="hist-view-names">{histNames(rec)}</p>
          <span className={`tag ${rec.m === 'hard' ? 'tag-warn' : ''}`}>{histModeLabel(rec)}</span>
          <div className="my-2">
            <ui.SummaryRing frac={frac}>
              <div className="font-display text-5xl font-extrabold text-white leading-none"><ui.AnimatedCounter target={rec.a} /></div>
              <span className="text-xs font-bold text-zinc-500 mt-2">{tr('отвечено')}</span>
            </ui.SummaryRing>
          </div>
          <span className="hist-badge">{tr(histBadge(rec))}</span>
          {rec.res && <p className="hist-stop">{tf('Остановились на вопросе {v0} из {v1}', { v0: rec.r, v1: rec.n })}</p>}
          {rec.cont && <p className="hist-stop">{tr('Эту игру потом продолжили — итоги продолжения в новой записи.')}</p>}
        </section>
        <section className="rounded-[20px] border border-white/10 bg-white/[0.04] p-5 flex flex-col gap-5">
          <ui.SummaryBars total={rec.a} rows={[
            { label: 'Лёгкие', count: rec.e, cls: 'diff-text-1', bar: 'bg-emerald-400' },
            { label: 'Средние', count: rec.md, cls: 'diff-text-2', bar: 'bg-amber-400' },
            { label: 'Глубокие', count: rec.h, cls: 'diff-text-3', bar: 'bg-rose-500' },
          ]} />
          <div className="hairline-divider"></div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2.5 font-bold text-xs text-zinc-300"><span aria-hidden="true" className="skip-ico"><ui.Icons.Skip /></span> {tr('Пропущено')}</span>
            <span className="font-display text-xl font-bold text-white">{rec.s}</span>
          </div>
        </section>
        {rec.pl.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-bold text-zinc-300">{tr('Кто как играл')}</h2>
            <ul className="hist-players">
              {rec.pl.map((p, i) => (
                <li key={p.id || i} className="hist-player">
                  <span aria-hidden="true" className="hist-player-ico">{p.gender === 'girl' ? '👩' : '👨'}</span>
                  <span className="hist-player-name">{p.name}</span>
                  <span className="hist-player-n" aria-label={tf('Ответил(а): {v0}', { v0: p.a })}><ui.Icons.Check /> {p.a}</span>
                  <span className="hist-player-n is-skip" aria-label={tf('Пропустил(а): {v0}', { v0: p.s })}><ui.Icons.Skip /> {p.s}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {topics.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-bold text-zinc-300">{tr('Главные темы')}</h2>
            <ul className="flex flex-wrap gap-2">{topics.map(x => <li key={x.info.name} className="chip"><span aria-hidden="true">{x.info.icon}</span><span>{x.info.name}</span><span className="hist-chip-n">{x.n}</span></li>)}</ul>
          </section>
        )}
        <div className="flex flex-col gap-3">
          {rec.res
            ? <button type="button" onClick={() => { ui.SoundFX.click(); onResume(rec); }} className="btn-primary w-full"><ui.Icons.Resume /> {tr('Продолжить игру')}</button>
            : <button type="button" onClick={() => { ui.SoundFX.click(); onPlay(); }} className="btn-primary w-full"><ui.Icons.Play /> {tr('Сыграть ещё')}</button>}
          <button type="button" onClick={() => { ui.SoundFX.click(); onBack(); }} className="btn-secondary w-full">{tr('К списку игр')}</button>
        </div>
      </main>
      <ui.AppFooter divider={false} />
    </div>
  );
};
