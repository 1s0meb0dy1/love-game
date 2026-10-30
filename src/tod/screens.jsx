// Режим «Правда или действие»: экраны — архив карточек (вкладки «Правда» и «Действие» в «Все вопросы») и админка карточек.
// Всё, что нужно от приложения, приходит пропсами и объектом ui = { Icons, SoundFX, AppFooter, showToast, showError(title, msg), navigate, SettingSwitch, PopupModal }:
// в тестах модуль подставляется в код app.jsx, поэтому он ничего не импортирует из app.jsx. Из React — только React.useState и т. п. (без деструктуризации).
// Ошибки записи в админке показываются прямо на экране (под полем, у кнопки загрузки, всплывающим уведомлением): общее окно ошибки есть не на всех экранах.
import React from 'react';
import { TOD_STARTER } from '../content/tod-cards.js';
import { TOD_TYPES, TOD_LEVELS, TOD_TEXT_MAX, todCleanCard, todGroupCards, todNewId, todCardText } from './model.js';
import { TOD_TITLES } from '../content/tod-banter.js';
import { TOD_TRUTH_LIMIT, todTruthRun, todTruthLocked } from './engine.js';
import { t as tr, tf, getLang } from '../i18n.js';

const TOD_GROUP_LABEL = { easy: 'Простые', medium: 'Средние', hard: 'Жёсткие' }; // названия групп уровня (в заголовках, фильтрах и форме)
const TOD_TYPE_LABEL = { truth: 'Правда', dare: 'Действие' };
const TOD_DOTS = { easy: 1, medium: 2, hard: 3 }; // значок уровня: сколько из трёх точек закрашено (цвет не единственный признак)
const TOD_FILTER_TYPES = [['all', 'Все'], ['truth', 'Правда'], ['dare', 'Действие']];
const TOD_FILTER_LEVELS = [['all', 'Все уровни'], ['easy', 'Простые'], ['medium', 'Средние'], ['hard', 'Жёсткие']];

// метка уровня: значок из точек, подпись и (если передан) число карточек; цвет — класс tod-lvl-<уровень> из styles.css
const TodLevelMark = ({ level, count, ui }) => (
  <h3 className={`tod-lvl tod-lvl-${level}`}>
    <span className="tod-lvl-dots" aria-hidden="true">{[1, 2, 3].map(i => <i key={i} className={i <= TOD_DOTS[level] ? 'on' : ''}></i>)}</span>
    <span>{todTx(ui, TOD_GROUP_LABEL[level])}</span>
    {typeof count === 'number' && <span className="tod-lvl-n">{' '}· {count}</span>}
  </h3>
);

// архив карточек для «Все вопросы»: tab — 'truth' | 'dare'; игроку видны только включённые карточки, владельцу ещё и скрытые (с меткой «скрыта»).
// Владельцу у каждой карточки доступны «Изменить» (onEdit(card) открывает форму) и «Скрыть/Показать» (onToggle(card) -> Promise)
export const TodArchive = ({ ui, cards, tab, isAdmin, onManage, onEdit, onToggle }) => {
  const type = tab === 'dare' ? 'dare' : 'truth';
  const [busyId, setBusyId] = React.useState('');
  const groups = todGroupCards(cards, { showHidden: !!isAdmin })[type];
  const shown = TOD_LEVELS.filter(lv => groups[lv].length > 0);
  const flip = async (c) => { if (busyId || !onToggle) return; setBusyId(c.id); try { await onToggle(c); } finally { setBusyId(''); } };
  return (
    <div className="flex flex-col gap-6 fade-in">
      {isAdmin && onManage && <button type="button" onClick={() => { ui.SoundFX.click(); onManage(); }} className="btn-secondary w-full flex items-center justify-center gap-2.5">{todTx(ui, '⚙ Управление карточками')}</button>}
      {shown.length === 0 && <p className="text-sm text-zinc-400 text-center py-10 leading-relaxed">{todTx(ui, 'Пока нет карточек.')}</p>}
      {shown.map(lv => (
        <section key={lv} className="space-y-3">
          <TodLevelMark ui={ui} level={lv} count={groups[lv].length} />
          <div className="flex flex-col divide-y divide-white/[0.08] border-y border-white/10">
            {groups[lv].map(c => (
              <div key={c.id} className="py-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-4">
                  <div className={`flex-1 min-w-0 text-[15px] leading-snug break-words ${c.isActive ? 'text-zinc-100' : 'text-zinc-400'}`}>{todCardText(c, getLang())}</div>
                  {!c.isActive && <span className="tag tag-warn flex-shrink-0"><span aria-hidden="true">🙈</span> {todTx(ui, 'скрыта')}</span>}
                </div>
                {isAdmin && onEdit && (
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" aria-label={`${todTx(ui, 'Изменить')}: ${todCardText(c, getLang())}`} onClick={() => { ui.SoundFX.click(); onEdit(c); }} className="btn-secondary btn-sm"><ui.Icons.Edit /> {todTx(ui, 'Изменить')}</button>
                    {onToggle && <button type="button" disabled={!!busyId} aria-label={`${c.isActive ? todTx(ui, 'Скрыть') : todTx(ui, 'Показать')}: ${todCardText(c, getLang())}`} onClick={() => flip(c)} className="btn-secondary btn-sm">{c.isActive ? <ui.Icons.EyeOff /> : <ui.Icons.Eye />} {c.isActive ? todTx(ui, 'Скрыть') : todTx(ui, 'Показать')}</button>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

// повтор считается без учёта регистра и пробелов внутри текста
const todNorm = (s) => String(s).toLowerCase().replace(/\s+/g, '');
// «1 новая», «2 новых», «21 новая»
const todNewWord = (n) => (n % 10 === 1 && n % 100 !== 11 ? tr("новая") : tr("новых"));

// ошибка записи -> понятное сообщение без адреса базы и токенов; verb — что пытались сделать («сохранить», «загрузить набор»)
const todErrText = (e, verb) => {
  const m = String((e && e.message) || ''); const http = m.match(/^HTTP (\d{3})$/);
  if (e && e.todRead) return tr("Не удалось проверить, что уже лежит в базе, поэтому ничего не записано. Проверьте интернет и попробуйте ещё раз.");
  let text;
  if (http && (http[1] === '401' || http[1] === '403')) text = tf("Не удалось {v0}: нет прав на запись. Проверьте вход владельца.", { v0: tr(verb) });
  else if (http) text = tf("Не удалось {v0}: сервер ответил ошибкой. Попробуйте ещё раз чуть позже.", { v0: tr(verb) });
  else if (m === 'Некорректная карточка') text = tr('Карточка не прошла проверку. Проверьте тип, уровень и текст.');
  else text = tf("Не удалось {v0}: нет связи с сервером. Проверьте интернет и попробуйте ещё раз.", { v0: tr(verb) });
  const added = e && Number(e.added); // загрузка набора могла успеть записать часть карточек
  if (added > 0) text += " " + tf("Успело записаться: {v0}. Повторное нажатие дозапишет остальные.", { v0: added }) + "";
  return text;
};

// админка карточек (только владельцу): фильтры, форма (тип, уровень, текст), «Скрыть/Показать», разовая загрузка стартового набора. Кнопки удаления нет.
// onSave(card) -> Promise<card> (бросает ошибку при сбое), onSeed() -> Promise<{ added, skipped }>, source — откуда сейчас список: 'db' | 'cache' | 'starter'
export const TodAdmin = ({ ui, cards, source, isAdmin, onSave, onSeed, onBack, initialEdit }) => {
  const { Icons, AppFooter } = ui;
  const [fType, setFType] = React.useState('all'); const [fLevel, setFLevel] = React.useState('all');
  const [edit, setEdit] = React.useState(null); // null — форма закрыта, 'new' — новая карточка, иначе id изменяемой
  const [fmType, setFmType] = React.useState('truth'); const [fmLevel, setFmLevel] = React.useState('easy'); const [fmText, setFmText] = React.useState('');
  const [err, setErr] = React.useState(''); const [busy, setBusy] = React.useState(false);
  const [rowBusy, setRowBusy] = React.useState('');
  const [seedBusy, setSeedBusy] = React.useState(false); const [seedErr, setSeedErr] = React.useState('');
  const formRef = React.useRef(null); const areaRef = React.useRef(null);
  // открыт по кнопке «Изменить» в архиве: сразу показываем форму этой карточки (один раз)
  const openedRef = React.useRef(false);
  React.useEffect(() => {
    if (openedRef.current || !initialEdit) return;
    const c = (Array.isArray(cards) ? cards : []).find(x => x.id === initialEdit); if (!c) return;
    openedRef.current = true; setEdit(c.id); setErr(''); setFmType(c.type); setFmLevel(c.difficulty); setFmText(todCardText(c, getLang()));
  }, [initialEdit, cards]);
  // форма открылась (особенно «Изменить» у карточки далеко внизу списка) -> показать её и поставить курсор в поле
  React.useEffect(() => {
    if (edit === null) return;
    const el = formRef.current;
    try { if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'start', behavior: window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); } catch (e) {}
    if (areaRef.current) areaRef.current.focus({ preventScroll: true });
  }, [edit]);

  const list = Array.isArray(cards) ? cards : [];
  const have = new Set(list.map(c => c.id));
  // сколько карточек стартового набора ещё не лежит в базе; пока список взят не из базы, считаем, что не лежит ни одной (при загрузке база всё равно перечитывается)
  const seedN = source === 'starter' ? TOD_STARTER.length : TOD_STARTER.filter(c => !have.has(c.id)).length;
  const hiddenN = list.filter(c => c.isActive !== true).length;

  const startEdit = (c) => {
    ui.SoundFX.click(); setEdit(c ? c.id : 'new'); setErr('');
    setFmType(c ? c.type : (fType !== 'all' ? fType : 'truth')); setFmLevel(c ? c.difficulty : (fLevel !== 'all' ? fLevel : 'easy')); setFmText(c ? todCardText(c, getLang()) : '');
  };
  const save = async () => {
    if (busy) return;
    const clean = todCleanCard({ id: 'td_x', type: fmType, difficulty: fmLevel, text: fmText, isActive: true });
    if (!clean) { ui.SoundFX.warn(); setErr(tr("Введите текст карточки")); return; }
    const twin = list.find(c => c.type === fmType && c.id !== edit && (todNorm(c.text) === todNorm(clean.text) || (c.text_uk && todNorm(c.text_uk) === todNorm(clean.text))));
    if (twin) { ui.SoundFX.warn(); setErr(twin.isActive === true ? tr("Такая карточка уже есть") : tr("Такая карточка уже есть, но скрыта: найдите её в списке и нажмите «Показать»")); return; }
    const existing = edit !== 'new' ? list.find(c => c.id === edit) : null;
    if (edit !== 'new' && !existing) { ui.SoundFX.warn(); setErr(tr("Карточка не найдена. Закройте форму и откройте её заново.")); return; }
    setBusy(true); setErr('');
    try {
      await onSave({ id: existing ? existing.id : todNewId(), type: fmType, difficulty: fmLevel, text: clean.text, isActive: existing ? existing.isActive : true, typed: true });
      ui.SoundFX.success(); ui.showToast(tr("Карточка сохранена")); setEdit(null);
    } catch (e) { ui.SoundFX.warn(); setErr(todErrText(e, 'сохранить')); }
    setBusy(false);
  };
  const toggle = async (c) => {
    if (rowBusy) return;
    setRowBusy(c.id);
    try { await onSave({ ...c, isActive: c.isActive !== true }); ui.SoundFX.click(); ui.showToast(c.isActive === true ? tr("Карточка скрыта") : tr("Карточка снова в игре")); }
    catch (e) { ui.SoundFX.warn(); ui.showToast(todErrText(e, 'сохранить'), 6000, 'warn'); }
    setRowBusy('');
  };
  const seed = async () => {
    if (seedBusy) return;
    setSeedBusy(true); setSeedErr('');
    try {
      const r = await onSeed(); const added = (r && Number(r.added)) || 0; const skipped = (r && Number(r.skipped)) || 0;
      ui.SoundFX.success();
      if (added > 0) ui.showToast(tf("Стартовый набор загружен: {v0} {v1}", { v0: added, v1: todNewWord(added) }) + (skipped > 0 ? tf(", уже были {v0}", { v0: skipped }) : ''), 4200);
      else ui.showToast(tr("В базе уже есть весь стартовый набор"), 3200, 'info');
    } catch (e) { ui.SoundFX.warn(); setSeedErr(todErrText(e, 'загрузить набор')); }
    setSeedBusy(false);
  };

  const types = fType === 'all' ? TOD_TYPES : [fType]; const levels = fLevel === 'all' ? TOD_LEVELS : [fLevel];
  const groups = todGroupCards(list, { showHidden: true });
  const total = types.reduce((n, t) => n + levels.reduce((m, lv) => m + groups[t][lv].length, 0), 0);
  return (
    <div className="safe-screen w-full flex flex-col items-center slide-up relative z-10">
      <header className="page-head w-full max-w-md flex items-center gap-3 pt-2">
        <button type="button" onClick={() => { ui.SoundFX.click(); onBack(); }} aria-label={tr("Назад")} className="btn-icon flex-shrink-0"><Icons.Back /></button>
        <h1 className="page-title flex-1 text-center pr-11 text-lg font-bold text-white">{tr("Карточки")}</h1>
      </header>
      <main className="w-full max-w-md flex flex-col gap-6 pt-6 pb-6">
        {!isAdmin ? ( <p className="text-sm text-zinc-400 text-center">{tr("Раздел доступен только владельцу.")}</p> ) : (
          <>
            <p className="ui-hint">{tr("Карточки режима «Правда или действие». Скрытая карточка не попадает в игру и в архив игрока; удалить карточку нельзя, только скрыть. Всего:")} {list.length}{tr(", скрыто:")} {hiddenN}.</p>
            {source !== 'db' && (
              <div role="note" className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4 flex flex-col gap-2">
                <span className="tag tag-warn self-start">{source === 'cache' ? tr("Копия на устройстве") : tr("Встроенный набор")}</span>
                <p className="ui-hint">{source === 'cache'
                  ? tr("Сейчас показана копия карточек на этом устройстве: база не ответила. Изменения могут не сохраниться — проверьте интернет.")
                  : tr("Сейчас показан встроенный набор: в базе карточек нет или она не ответила. Загрузите стартовый набор в базу до того, как менять карточки: после первой записи игрокам будут видны только карточки из базы.")}</p>
              </div>
            )}
            {seedN > 0 && (
              <div className="flex flex-col gap-1">
                <button type="button" disabled={seedBusy} onClick={seed} className="btn-secondary w-full">{seedBusy ? tr("Загружаем карточки…") : tf("Загрузить стартовый набор ({v0} {v1})", { v0: seedN, v1: todNewWord(seedN) })}</button>
                {seedErr && <span className="ui-error" role="alert">{seedErr}</span>}
              </div>
            )}
            {edit === null ? (
              <button type="button" onClick={() => startEdit(null)} className="btn-primary w-full">{tr("+ Новая карточка")}</button>
            ) : (
              <section ref={formRef} className="flex flex-col gap-3 rounded-[20px] border border-white/10 bg-white/[0.04] p-4 fade-in">
                <h2 className="text-sm font-bold text-white">{edit === 'new' ? tr("Новая карточка") : tr("Редактирование карточки")}</h2>
                <div className="seg" role="radiogroup" aria-label={tr("Тип карточки")}>
                  {TOD_TYPES.map(t => <button key={t} type="button" role="radio" aria-checked={fmType === t} onClick={() => { ui.SoundFX.click(); setFmType(t); setErr(''); }} className={`seg-btn ${fmType === t ? 'is-active' : ''}`}>{tr(TOD_TYPE_LABEL[t])}</button>)}
                </div>
                <div className="seg" role="radiogroup" aria-label={tr("Уровень карточки")}>
                  {TOD_LEVELS.map(lv => <button key={lv} type="button" role="radio" aria-checked={fmLevel === lv} onClick={() => { ui.SoundFX.click(); setFmLevel(lv); }} className={`seg-btn ${fmLevel === lv ? 'is-active' : ''}`}>{tr(TOD_GROUP_LABEL[lv])}</button>)}
                </div>
                <div>
                  <textarea ref={areaRef} value={fmText} maxLength={TOD_TEXT_MAX} onChange={e => { setFmText(e.target.value); setErr(''); }} aria-label={tr("Текст карточки")} aria-invalid={err ? 'true' : undefined}
                    placeholder={fmType === 'truth' ? tr("Вопрос, на который нужно ответить честно") : tr("Задание, которое нужно выполнить")} />
                  <div className="flex items-start justify-between gap-3">
                    {err ? <span className="ui-error" role="alert">{err}</span> : <span></span>}
                    <span className="ui-hint mt-1.5 flex-shrink-0 tabular-nums">{fmText.length} / {TOD_TEXT_MAX}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => { ui.SoundFX.click(); setEdit(null); setErr(''); }} className="btn-secondary">{tr("Отмена")}</button>
                  <button type="button" disabled={busy} onClick={save} className="btn-primary">{busy ? tr("Сохраняем…") : tr("Сохранить")}</button>
                </div>
              </section>
            )}
            <div className="flex flex-col gap-3">
              <div className="seg" role="group" aria-label={tr("Фильтр по типу")}>
                {TOD_FILTER_TYPES.map(([id, label]) => <button key={id} type="button" aria-pressed={fType === id} onClick={() => { ui.SoundFX.click(); setFType(id); }} className={`seg-btn ${fType === id ? 'is-active' : ''}`}>{tr(label)}</button>)}
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label={tr("Фильтр по уровню")}>
                {TOD_FILTER_LEVELS.map(([id, label]) => <button key={id} type="button" aria-pressed={fLevel === id} onClick={() => { ui.SoundFX.click(); setFLevel(id); }} className={`chip ${fLevel === id ? 'is-on' : ''}`}>{tr(label)}</button>)}
              </div>
            </div>
            {total === 0 && <p className="text-sm text-zinc-400 text-center py-6 leading-relaxed">{list.length === 0 ? tr("Карточек пока нет.") : tr("По выбранным фильтрам карточек нет.")}</p>}
            {types.map(t => {
              const n = levels.reduce((m, lv) => m + groups[t][lv].length, 0);
              if (n === 0) return null;
              return (
                <section key={t} className="flex flex-col gap-4">
                  <h2 className="text-base font-bold text-white">{tr(TOD_TYPE_LABEL[t])} <span className="text-zinc-500 font-semibold">· {n}</span></h2>
                  {levels.map(lv => {
                    const items = groups[t][lv];
                    if (items.length === 0) return null;
                    return (
                      <div key={lv} className="flex flex-col gap-2">
                        <TodLevelMark level={lv} count={items.length} />
                        <div className="rounded-[20px] border border-white/10 bg-white/[0.04] divide-y divide-white/[0.06] overflow-hidden">
                          {items.map(c => (
                            <div key={c.id} className="px-4 py-3.5 flex flex-col gap-2.5">
                              <p className={`text-[15px] leading-snug break-words ${c.isActive === true ? 'text-zinc-100' : 'text-zinc-400'}`}>{todCardText(c, getLang())}</p>
                              <div className="flex items-center justify-end gap-2">
                                {c.isActive !== true && <span className="tag tag-warn mr-auto"><span aria-hidden="true">🙈</span> {tr("скрыта")}</span>}
                                <button type="button" aria-label={tf("Изменить: {v0}", { v0: todCardText(c, getLang()) })} onClick={() => startEdit(c)} className="btn-secondary btn-sm"><ui.Icons.Edit /> {tr("Изменить")}</button>
                                <button type="button" disabled={!!rowBusy} aria-label={`${c.isActive === true ? tr("Скрыть") : tr("Показать")}: ${todCardText(c, getLang())}`} onClick={() => toggle(c)} className="btn-secondary btn-sm">{c.isActive === true ? <Icons.EyeOff /> : <Icons.Eye />} {c.isActive === true ? tr("Скрыть") : tr("Показать")}</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </section>
              );
            })}
          </>
        )}
      </main>
      <AppFooter />
    </div>
  );
};

// ---------------- игра: лобби, ход, итоги ----------------
// Тексты интерфейса проходят через ui.tr (словарь src/i18n.js: ключ — русский текст), имена игроков и тексты карточек выводятся как есть.

const TOD_TONES = [[0, 'Выкл'], [1, 'Мягкий'], [2, 'Острый']];
const TOD_LEVEL_WORD = { easy: 'Легко', medium: 'Средне', hard: 'Жёстко' };
const TOD_LEVEL_HINT = { easy: 'Разминка', medium: 'Погорячее', hard: 'На грани' };
const TOD_HUES = [345, 28, 275, 160, 200, 50, 310, 120, 15, 240]; // оттенок аватара игрока по его номеру: соседи по очереди не похожи
const todTx = (ui, s) => (ui && typeof ui.tr === 'function' ? ui.tr(s) : tr(s));
const todIcon = (p) => (p && p.gender === 'girl' ? '👩' : '👨');

// аватар игрока: значок по полу на цветной подложке (оттенок зависит от номера в очереди)
const TodAvatar = ({ p, i, big }) => <span aria-hidden="true" className={`tod-avatar ${big ? 'tod-avatar-lg' : ''}`} style={{ '--h': TOD_HUES[i % TOD_HUES.length] }}>{todIcon(p)}</span>;

// три точки серии «Правда подряд»: закрашено столько, сколько правд подряд выбрал игрок; locked — серия исчерпана
const TodPips = ({ run, locked }) => (
  <span className={`tod-pips ${locked ? 'is-locked' : ''}`} aria-hidden="true">{Array.from({ length: TOD_TRUTH_LIMIT }, (_, k) => <i key={k} className={k < run ? 'on' : ''}></i>)}</span>
);

// предупреждение 18+ (раздел 10 спеки): перед стартом с «Жёсткими» или тоном «Острый»; okLabel — другая подпись кнопки (при входе в идущую игру — «Понятно»)
export const TodAdultModal = ({ ui, open, onOk, onCancel, okLabel }) => (
  <ui.PopupModal isOpen={open} onClose={onCancel}>
    <div className="flex flex-col gap-4 pt-1 text-left">
      <h3 className="text-xl font-bold text-white pr-8">{todTx(ui, 'Только для взрослых 18+')}</h3>
      <p className="text-sm text-zinc-300 leading-relaxed">{todTx(ui, 'Игра для взрослых: откровенные карточки, вульгарность и чёрный юмор. Пропуск засчитывается в итогах как позор. Играйте только с теми, кому комфортно.')}</p>
      <button type="button" onClick={onOk} className="btn-primary w-full">{todTx(ui, okLabel || tr("Нам есть 18, начать"))}</button>
      <button type="button" onClick={onCancel} className="btn-secondary w-full">{todTx(ui, 'Назад')}</button>
    </div>
  </ui.PopupModal>
);

// «Свои карточки» в лобби: форма (тип, уровень, текст) и список; карточки лежат только на этом устройстве.
// onAdd({ type, difficulty, text }) -> '' (добавлено) или текст ошибки; onDel(id)
const TodMine = ({ ui, list, onAdd, onDel }) => {
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState('truth'); const [lvl, setLvl] = React.useState('easy'); const [text, setText] = React.useState(''); const [err, setErr] = React.useState('');
  const submit = () => {
    const e = onAdd({ type, difficulty: lvl, text });
    if (e) { ui.SoundFX.warn(); setErr(e); return; }
    ui.SoundFX.success(); setText(''); setErr(''); ui.showToast(todTx(ui, 'Карточка добавлена'));
  };
  return (
    <section className="tod-mine flex flex-col gap-3 rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
      <button type="button" aria-expanded={open} onClick={() => { ui.SoundFX.click(); setOpen(o => !o); }} className="tod-mine-head">
        <span className="flex flex-col gap-0.5 text-left min-w-0"><span className="text-sm font-bold text-white">{todTx(ui, 'Свои карточки')} · {list.length}</span><span className="ui-hint">{todTx(ui, 'Придумайте задание или вопрос — только для вашей игры')}</span></span>
        <span aria-hidden="true" className={`tod-chev ${open ? 'is-open' : ''}`}><ui.Icons.ChevronDown /></span>
      </button>
      {open && (
        <div className="flex flex-col gap-3 fade-in">
          <div className="seg" role="radiogroup" aria-label={todTx(ui, 'Тип карточки')}>
            {TOD_TYPES.map(t => <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => { ui.SoundFX.click(); setType(t); }} className={`seg-btn ${type === t ? 'is-active' : ''}`}>{todTx(ui, TOD_TYPE_LABEL[t])}</button>)}
          </div>
          <div className="seg" role="radiogroup" aria-label={todTx(ui, 'Уровень карточки')}>
            {TOD_LEVELS.map(lv => <button key={lv} type="button" role="radio" aria-checked={lvl === lv} onClick={() => { ui.SoundFX.click(); setLvl(lv); }} className={`seg-btn ${lvl === lv ? 'is-active' : ''}`}>{todTx(ui, TOD_GROUP_LABEL[lv])}</button>)}
          </div>
          <div>
            <textarea value={text} maxLength={TOD_TEXT_MAX} onChange={e => { setText(e.target.value); setErr(''); }} aria-label={todTx(ui, 'Текст карточки')} aria-invalid={err ? 'true' : undefined}
              placeholder={type === 'truth' ? todTx(ui, 'Вопрос, на который нужно ответить честно') : todTx(ui, 'Задание, которое нужно выполнить')} />
            <div className="flex items-start justify-between gap-3">
              {err ? <span className="ui-error" role="alert">{err}</span> : <span></span>}
              <span className="ui-hint mt-1.5 flex-shrink-0 tabular-nums">{text.length} / {TOD_TEXT_MAX}</span>
            </div>
          </div>
          <button type="button" onClick={submit} className="btn-secondary w-full"><ui.Icons.Plus /> {todTx(ui, 'Добавить карточку')}</button>
          <p className="ui-hint">{todTx(ui, 'Карточки хранятся только на этом устройстве и нигде не публикуются. На других устройствах сессии их текст не виден — читает автор. За текст отвечаете вы: не пишите то, что унижает людей или нарушает закон.')}</p>
          {list.length > 0 && (
            <ul className="flex flex-col divide-y divide-white/[0.08] border-y border-white/10">
              {list.map(c => (
                <li key={c.id} className="py-3 flex items-start gap-3">
                  <span className="flex-1 min-w-0 flex flex-col gap-1">
                    <span className={`tod-lvl tod-lvl-${c.difficulty} text-xs`}><span className="tod-lvl-dots" aria-hidden="true">{[1, 2, 3].map(k => <i key={k} className={k <= TOD_DOTS[c.difficulty] ? 'on' : ''}></i>)}</span><span>{todTx(ui, TOD_TYPE_LABEL[c.type])} · {todTx(ui, TOD_GROUP_LABEL[c.difficulty])}</span></span>
                    <span className="text-[15px] leading-snug text-zinc-100 break-words">{c.text}</span>
                  </span>
                  <button type="button" aria-label={tf("Удалить: {v0}", { v0: c.text })} onClick={() => { ui.SoundFX.click(); onDel(c.id); }} className="btn-icon plain flex-shrink-0"><ui.Icons.Trash /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};

// лобби #/tod: «веер» из двух карточек (по нажатию переворачиваются и показывают пример), правила, состав сессии (игроки и устройства), настройки, свои карточки,
// «Поделиться сессией» и под ней «Начать игру». block — причина, по которой старт невозможен; deckInfo = { truth, dare } — сколько карточек в колоде при текущих настройках;
// peek(type) -> пример текста для обратной стороны веера; mine/onMineAdd/onMineDel — свои карточки устройства; deviceCount — устройств в сессии (с этим)
export const TodLobby = ({ ui, players, cfg, setCfg, deviceCount, block, onStart, onShare, onBack, banner, deckInfo, peek, mine, onMineAdd, onMineDel }) => {
  const [warn, setWarn] = React.useState(false); const [busy, setBusy] = React.useState(false);
  const [flip, setFlip] = React.useState({ truth: '', dare: '' }); // текст на обороте веера; '' — карточка лицом
  const [rule, setRule] = React.useState(''); // раскрытое правило: '' | 'lock' | 'skip' | 'lvl'
  const list = Array.isArray(players) ? players : [];
  const go = async () => { if (busy) return; setBusy(true); try { await onStart(); } finally { setBusy(false); } };
  const startClick = () => {
    if (block || busy) { ui.SoundFX.warn(); return; }
    ui.SoundFX.click();
    if (cfg.hard || cfg.tone === 2) { setWarn(true); return; }
    go();
  };
  const flipFace = (type) => {
    ui.SoundFX.flip(type === 'truth' ? 'left' : 'right');
    setFlip(f => (f[type] ? { ...f, [type]: '' } : { ...f, [type]: (typeof peek === 'function' && peek(type)) || todTx(ui, 'В колоде пока пусто') }));
  };
  // обычная функция, а не компонент: иначе при каждой перерисовке карточка пересоздавалась бы и переворот не анимировался
  const face = (type, icon, title, hint) => (
    <button key={type} type="button" aria-pressed={!!flip[type]} onClick={() => flipFace(type)} aria-label={`${title}: ${flip[type] ? flip[type] : hint}`} className={`tod-face tod-face-${type} ${flip[type] ? 'is-flipped' : ''}`}>
      <span className="tod-face-in">
        <span className="tod-face-front"><span aria-hidden="true" className="tod-face-ico">{icon}</span><span className="tod-face-name">{title}</span><span className="tod-face-hint">{hint}</span></span>
        <span className="tod-face-back"><span className="tod-face-back-t">{title}</span><span className="tod-face-q">{flip[type]}</span></span>
      </span>
    </button>
  );
  const di = deckInfo || null;
  // правила — три плитки в ряд; нажатие раскрывает пояснение под ними (так лобби на телефоне помещается в один экран)
  const rules = [
    { id: 'lock', ico: <span className="tod-lockdemo" aria-hidden="true"><i></i><i></i><i></i><b>🔒</b></span>, name: tf("Не больше {v0} правд подряд", { v0: TOD_TRUTH_LIMIT }), title: tf("«Правда» — не больше {v0} раз подряд", { v0: TOD_TRUTH_LIMIT }), hint: todTx(ui, 'После третьей правды подряд следующий ход — только «Действие». Так интереснее!') },
    { id: 'skip', ico: <span aria-hidden="true">🐔</span>, name: todTx(ui, 'Пропуск — позор'), title: todTx(ui, 'Пропуск — это позор'), hint: todTx(ui, 'Ход не передаётся, а в итогах пропуски попадают в «Зал позора».') },
    { id: 'lvl', ico: <span aria-hidden="true">🔥</span>, name: tf("{v0} уровня действий", { v0: 3 }), title: todTx(ui, 'У действия три уровня'), hint: todTx(ui, 'Легко, средне и жёстко — выбирайте по настроению компании.') },
  ];
  const ruleOn = rules.find(r => r.id === rule) || null;
  return (
    <div className="safe-screen tod-lobby w-full flex flex-col items-center slide-up relative z-10">
      <header className="page-head w-full max-w-md lg:max-w-5xl flex items-center gap-3">
        <button type="button" aria-label={todTx(ui, 'Назад')} onClick={() => { ui.SoundFX.click(); onBack(); }} className="btn-icon flex-shrink-0"><ui.Icons.Back /></button>
        <h1 className="page-title flex-1 text-center text-lg font-bold text-white">{todTx(ui, 'Правда или действие')}</h1>
        <button type="button" aria-label={todTx(ui, 'Поделиться сессией')} title={todTx(ui, 'Поделиться сессией')} onClick={onShare} className="btn-icon flex-shrink-0"><ui.Icons.Share /></button>
      </header>
      <main className="tod-lobby-main w-full max-w-md lg:max-w-5xl flex flex-col gap-3 desk-cols">
        {banner}
        <section className="tod-hero" aria-label={todTx(ui, 'Правда или действие')}>
          <div className="tod-hero-in">
            <div className="tod-fan">
              {face('truth', '💬', todTx(ui, 'Правда'), todTx(ui, 'Нажми — пример'))}
              {face('dare', '🎯', todTx(ui, 'Действие'), todTx(ui, 'Нажми — пример'))}
            </div>
            <div className="tod-hero-txt">
              <p className="tod-hero-title">{todTx(ui, 'Выбирай. Рискуй. Не пропускай.')}</p>
              {di && <p className="tod-hero-meta">{tf("В колоде: {v0} правд · {v1} действий", { v0: di.truth, v1: di.dare })}</p>}
            </div>
          </div>
        </section>
        <section className="flex flex-col gap-2" aria-label={todTx(ui, 'Правила')}>
          <ul className="tod-rules">
            {rules.map(r => (
              <li key={r.id}>
                <button type="button" aria-expanded={rule === r.id} aria-controls="tod-rule-more" onClick={() => { ui.SoundFX.click(); setRule(v => (v === r.id ? '' : r.id)); }} className={`tod-rule tod-rule-${r.id} ${rule === r.id ? 'is-open' : ''}`}>
                  <span className="tod-rule-ico">{r.ico}</span>
                  <span className="tod-rule-name">{r.name}</span>
                </button>
              </li>
            ))}
          </ul>
          <div id="tod-rule-more" aria-live="polite">
            {ruleOn && <p className="tod-rule-more fade-in"><b>{ruleOn.title}.</b> {ruleOn.hint}</p>}
          </div>
        </section>
        <section className="tod-opts flex flex-col gap-3 rounded-[20px] border border-white/10 bg-white/[0.04] p-4">
          <div className="flex flex-col gap-1.5">
            <div className="tod-opt-row">
              <span className="text-sm font-bold text-white">{todTx(ui, 'Подколки')}</span>
              <div className="seg seg-sm" role="group" aria-label={todTx(ui, 'Подколки')}>
                {TOD_TONES.map(([tone, label]) => <button key={tone} type="button" aria-pressed={cfg.tone === tone} onClick={() => { ui.SoundFX.click(); setCfg({ ...cfg, tone }); }} className={`seg-btn ${cfg.tone === tone ? 'is-active' : ''}`}>{todTx(ui, label)}</button>)}
              </div>
            </div>
            <span className={`ui-hint ${cfg.tone === 2 ? '' : 'tod-opt-hint'}`}>{cfg.tone === 2 ? todTx(ui, 'Острый: лёгкая вульгарность, чёрный юмор и сатира на государство-агрессора. 18+') : cfg.tone === 1 ? todTx(ui, 'Мягкий: игривые подколки без грубостей.') : todTx(ui, 'Без подколок под карточкой.')}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex flex-col gap-0.5"><span className="text-sm font-bold text-white">{todTx(ui, 'Жёсткие 18+')}</span><span className="ui-hint tod-opt-hint">{todTx(ui, 'Откровенные карточки уровня «Жёстко»')}</span></span>
            <ui.SettingSwitch on={!!cfg.hard} label={todTx(ui, 'Жёсткие 18+')} onChange={() => { ui.SoundFX.toggle && ui.SoundFX.toggle(!cfg.hard); setCfg({ ...cfg, hard: !cfg.hard }); }} />
          </div>
          {Array.isArray(mine) && mine.length > 0 && (
            <div className="flex items-center justify-between gap-4">
              <span className="flex flex-col gap-0.5"><span className="text-sm font-bold text-white">{todTx(ui, 'Добавить мои карточки')}</span><span className="ui-hint">{tf("Ваших карточек: {v0}. Играют с этого устройства", { v0: mine.length })}</span></span>
              <ui.SettingSwitch on={!!cfg.mine} label={todTx(ui, 'Добавить мои карточки')} onChange={() => { ui.SoundFX.toggle && ui.SoundFX.toggle(!cfg.mine); setCfg({ ...cfg, mine: !cfg.mine }); }} />
            </div>
          )}
        </section>
        {typeof onMineAdd === 'function' && <TodMine ui={ui} list={Array.isArray(mine) ? mine : []} onAdd={onMineAdd} onDel={onMineDel} />}
        <div className="tod-lobby-go flex flex-col gap-3">
          <div className="tod-room">
            <ui.RoomStrip players={list} devices={deviceCount || 1} />
            <button type="button" onClick={onShare} className="btn-secondary tod-room-share flex-shrink-0"><ui.Icons.Share /> <span>{todTx(ui, 'Поделиться сессией')}</span></button>
          </div>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={startClick} disabled={busy} aria-disabled={block ? 'true' : undefined} aria-describedby={block ? 'tod-start-hint' : undefined} className="btn-primary tod-go w-full"><ui.Icons.Play /> {todTx(ui, 'Начать игру')}</button>
            {block && <p id="tod-start-hint" className="ui-error" role="alert">{block}</p>}
          </div>
        </div>
      </main>
      <TodAdultModal ui={ui} open={warn} onOk={() => { setWarn(false); go(); }} onCancel={() => { ui.SoundFX.click(); setWarn(false); }} />
    </div>
  );
};

const todSkips = (st) => (Array.isArray(st && st.s) ? st.s.reduce((n, x) => n + x, 0) : 0);

// значок уровня: только точки (закрашено 1 / 2 / 3), цвет — класс tod-lvl-<уровень>
const TodDots = ({ lv }) => <span className="tod-lvl-dots" aria-hidden="true">{[1, 2, 3].map(k => <i key={k} className={k <= TOD_DOTS[lv] ? 'on' : ''}></i>)}</span>;

// всплеск искр при выполненном задании (чистый CSS: каждая искра летит по своему углу)
const TodBurst = () => (
  <span className="tod-burst" aria-hidden="true">{Array.from({ length: 12 }, (_, k) => <i key={k} style={{ '--a': (k * 30) + 'deg', '--d': (54 + (k % 3) * 16) + 'px', '--c': k % 3 === 0 ? '#ffb061' : k % 3 === 1 ? '#ff4d6d' : '#c98bff' }}></i>)}</span>
);

// «ведущий-насмешник»: лицо меняется от события, реплика — в пузыре; у «Острого» тона пузырь красный и подрагивает
const TOD_HECKLE_FACE = { turn_start: '🎤', chose_truth: '🧐', chose_dare: '😈', level_easy: '🐣', level_medium: '😏', level_hard: '🔥', done: '👏', done_hard: '🤯', skip_1: '🐔', skip_2: '🐔', skip_3: '🤡', skip_hard: '🙈', redeem: '🫡', same_type_streak: '🥱', easy_only: '🍼', deck_cycle: '🔄', game_end: '🏁' };
const TodHeckle = ({ text, ev, tone }) => (
  <div key={ev ? ev.seq : 0} className={`tod-heckle ${tone === 2 ? 'is-spicy' : ''}`}>
    <span aria-hidden="true" className="tod-heckle-face">{TOD_HECKLE_FACE[ev && ev.k] || '😏'}</span>
    <p className="tod-banter">{text}</p>
  </div>
);

// игровой экран #/tod/play. Действия отдаются без seq (его подставляет приложение); banter — уже выбранная реплика (или '').
// «Ход игрока» стоит прямо на карточке с заданием (пока карточки нет — компактной строкой), всё содержимое карточки выровнено по центру.
// «Назад» и «Меню» перед уходом спрашивают подтверждение; onLeave(куда) — 'back' (в лобби) или 'menu' (в меню приложения); desktop — раскладка в две колонки
export const TodGame = ({ ui, state, banter, cardText, levelAvail, onAction, onEnd, onLeave, desktop }) => {
  const [ask, setAsk] = React.useState(''); const [shake, setShake] = React.useState(0); // ask: '' — окно закрыто, иначе куда идёт игрок
  const st = state; const me = st.pl[st.turn] || { name: '' };
  const locked = todTruthLocked(st); const run = todTruthRun(st);
  const act = (a) => {
    if (a.t === 'done') ui.SoundFX.success(); else if (a.t === 'skip') ui.SoundFX.warn(); else if (a.t === 'level') ui.SoundFX.magic(); else if (a.t === 'choose') ui.SoundFX.flip(a.type === 'truth' ? 'left' : 'right'); else ui.SoundFX.click();
    onAction(a);
  };
  const pickTruth = () => { if (locked) { ui.SoundFX.warn(); setShake(n => n + 1); return; } act({ t: 'choose', type: 'truth' }); };
  const text = st.card ? cardText(st.card.id) : null;
  const turns = st.stat.reduce((n, s) => n + s.d.reduce((a, b) => a + b, 0), 0); const round = Math.floor(turns / Math.max(st.pl.length, 1)) + 1;
  const evNow = st.ev && st.ev.seq === st.seq ? st.ev.k : '';
  const win = evNow === 'done' || evNow === 'done_hard' || evNow === 'redeem'; const flop = /^skip_/.test(evNow);
  const close = () => { ui.SoundFX.click(); setAsk(''); };
  const turnTitle = <h2 key={st.turn + ':' + st.seq} className="tod-turn break-words" aria-live="polite">{todTx(ui, 'Ход игрока:')} {me.name}</h2>;

  const rosterEl = (
    <ul className={`tod-roster ${desktop ? 'is-col' : ''}`} aria-label={todTx(ui, 'Игроки')}>
      {st.pl.map((p, i) => <li key={p.id || i} className={`chip ${i === st.turn ? 'is-on tod-now' : ''}`} aria-current={i === st.turn ? 'true' : undefined}><TodAvatar p={p} i={i} /><span className="tod-name">{p.name}</span><span className="tod-chicken">🐔 {todSkips(st.stat[i])}</span></li>)}
    </ul>
  );
  const chooseEl = st.phase === 'choose' && (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={pickTruth} aria-disabled={locked ? 'true' : undefined} className={`opt-card opt-brand tod-pick tod-pick-truth ${locked ? 'is-locked' : ''} ${shake ? 'tod-nope' : ''}`} key={'t' + shake}>
          <span aria-hidden="true" className="tod-pick-ico">{locked ? '🔒' : '💬'}</span>
          <span className="font-bold text-white text-lg">{todTx(ui, 'Правда')}</span>
          <span className="tod-pick-sub">{locked ? todTx(ui, 'Закрыта: три раза подряд') : todTx(ui, 'Ответь честно')}</span>
          <TodPips run={run} locked={locked} />
        </button>
        <button type="button" onClick={() => act({ t: 'choose', type: 'dare' })} className={`opt-card opt-ember tod-pick tod-pick-dare ${locked ? 'tod-attn' : ''}`}>
          <span aria-hidden="true" className="tod-pick-ico">🎯</span>
          <span className="font-bold text-white text-lg">{todTx(ui, 'Действие')}</span>
          <span className="tod-pick-sub">{locked ? todTx(ui, 'Теперь только оно') : todTx(ui, 'Выполни задание')}</span>
        </button>
      </div>
      <p className={`tod-ruleline ${locked ? 'is-hot' : ''}`} role={locked ? 'alert' : undefined}>
        <span aria-hidden="true">{locked ? '🔒' : 'ℹ️'}</span>
        <span>{locked ? tf("{v0}, ты уже {v1} раза подряд выбирал(а) правду — теперь только «Действие»!", { v0: me.name, v1: TOD_TRUTH_LIMIT }) : tf("Правда — не больше {v0} раз подряд: потом обязательно «Действие». Подряд сейчас: {v1} из {v0}", { v0: TOD_TRUTH_LIMIT, v1: run })}</span>
      </p>
    </div>
  );
  const levelEl = st.phase === 'level' && (
    <div className="flex flex-col gap-3" role="group" aria-label={todTx(ui, 'Уровень действия')}>
      {TOD_LEVELS.map(lv => {
        const on = !!(levelAvail && levelAvail[lv]);
        return (
          <button key={lv} type="button" disabled={!on} onClick={() => act({ t: 'level', diff: lv })} className={`btn-tile tod-lvl tod-lvl-${lv} tod-heat w-full justify-between`}>
            <span className="flex items-center gap-3"><TodDots lv={lv} /><span>{todTx(ui, TOD_LEVEL_WORD[lv])}</span></span>
            <span className="text-xs text-zinc-400 font-semibold">{on ? todTx(ui, TOD_LEVEL_HINT[lv]) : todTx(ui, 'пока пусто')}</span>
          </button>
        );
      })}
    </div>
  );
  // карточка: сверху «Ход игрока», ниже уровень и текст — всё по центру
  const cardEl = st.phase === 'card' && st.card && (
    <div className="tod-flip">
      <div key={st.card.id + ':' + st.seq} className={`tod-flip-in tod-card tod-card-${st.card.lv} rounded-[24px] border border-white/10 bg-white/[0.05] flex flex-col`}>
        <div className="tod-card-turn"><TodAvatar p={me} i={st.turn} />{turnTitle}</div>
        <span className={`tod-lvl tod-lvl-${st.card.lv}`}><TodDots lv={st.card.lv} /><span>{todTx(ui, st.card.pool === 'truth' ? tr("Правда") : tr("Действие"))} · {todTx(ui, TOD_LEVEL_WORD[st.card.lv])}</span></span>
        <p className="text-xl leading-snug text-white break-words">{text === null ? todTx(ui, 'Карточка недоступна') : text === undefined ? todTx(ui, 'Загружаем карточку…') : text}</p>
      </div>
    </div>
  );
  // пока карточки нет (выбор «Правды/Действия» и уровня) — компактная строка с именем
  const stageEl = st.phase !== 'card' && (
    <div className="tod-stage">
      <TodAvatar p={me} i={st.turn} big />
      {turnTitle}
      {win && <TodBurst key={'b' + st.seq} />}
      {flop && <span key={'f' + st.seq} className="tod-egg" aria-hidden="true">🐔</span>}
    </div>
  );
  const heckleEl = banter ? <TodHeckle text={banter} ev={st.ev} tone={st.opts.tone} /> : null;
  const actionsEl = st.phase === 'card' && st.card && (
    <div className="flex flex-col gap-3">
      <button type="button" onClick={() => act({ t: 'done' })} className="btn-primary w-full"><ui.Icons.Check /> {todTx(ui, st.card.pool === 'truth' ? tr("Ответил(а)") : tr("Выполнено"))}</button>
      <button type="button" onClick={() => act({ t: 'skip' })} className="btn-secondary w-full"><span aria-hidden="true">🐔</span> {todTx(ui, 'Пропустить')}</button>
    </div>
  );
  return (
    <div className="safe-screen w-full flex flex-col items-center fade-in relative z-10">
      <header className={`w-full max-w-md flex items-center justify-between gap-3 pt-2 ${desktop ? 'lg:max-w-5xl' : ''}`}>
        <button type="button" aria-label={todTx(ui, 'Назад')} onClick={() => { ui.SoundFX.click(); setAsk('back'); }} className="btn-icon flex-shrink-0"><ui.Icons.Back /></button>
        <button type="button" onClick={() => { ui.SoundFX.click(); setAsk('menu'); }} aria-label={todTx(ui, 'Открыть меню')} className="btn-secondary btn-sm flex-shrink-0"><span>{todTx(ui, 'Меню')}</span><span aria-hidden="true" className="text-lg leading-none">☰</span></button>
      </header>
      <main className={`w-full max-w-md flex flex-col gap-5 pt-4 pb-8 ${desktop ? 'lg:max-w-5xl' : ''}`}>
        <div className="tod-titlebar">
          <h1 className="tod-title-main">{todTx(ui, 'Правда или действие')}</h1>
          <p className="tod-title-sub">{tf("Круг {v0}", { v0: round })}</p>
        </div>
        {desktop ? (
          <div className="tod-desk">
            <div className="tod-desk-main">{chooseEl}{levelEl}{cardEl}{stageEl}{actionsEl}</div>
            <aside className="tod-desk-side">{rosterEl}{heckleEl}</aside>
          </div>
        ) : (<>{rosterEl}{chooseEl}{levelEl}{cardEl}{stageEl}{heckleEl}{actionsEl}</>)}
      </main>
      <ui.PopupModal isOpen={!!ask} onClose={close}>
        <div className="flex flex-col gap-3 pt-1 text-left">
          <h3 className="text-xl font-bold text-white pr-8">{todTx(ui, 'Вы действительно хотите закончить игру?')}</h3>
          <p className="text-sm text-zinc-300 leading-relaxed">{todTx(ui, 'Можно закончить партию для всех и открыть итоги или просто уйти с этого устройства.')}</p>
          <button type="button" onClick={() => { setAsk(''); onEnd(); }} className="btn-danger w-full">{todTx(ui, 'Завершить для всех')}</button>
          <button type="button" onClick={() => { ui.SoundFX.click(); const to = ask; setAsk(''); onLeave(to); }} className="btn-secondary w-full">{todTx(ui, 'Выйти, остальные продолжат')}</button>
          <button type="button" onClick={close} className="btn-ghost w-full">{todTx(ui, 'Вернуться в игру')}</button>
        </div>
      </ui.PopupModal>
    </div>
  );
};

// итоги #/tod/results: заголовок с кубком и числами партии, подиум по выполненным заданиям, «Зал позора» (крупнее и первым среди титулов),
// добрые титулы, таблица игроков; titles — результат todTitles. Подвала нет: экран заканчивается кнопками
const TOD_MEDALS = ['🥇', '🥈', '🥉'];
export const TodResults = ({ ui, state, titles, onAgain, onMenu, banner }) => {
  const st = state; const t = titles || { shame: [], cheer: [], clean: true, rank: [] };
  const info = (id) => TOD_TITLES.find(x => x.id === id) || { icon: '', name: id, hint: '' };
  const nameOf = (p) => (st.pl[p] ? st.pl[p].name : '');
  const rank = Array.isArray(t.rank) ? t.rank : [];
  const doneAll = rank.reduce((n, r) => n + r.done, 0); const skipAll = rank.reduce((n, r) => n + r.skips, 0); const hardAll = rank.reduce((n, r) => n + r.hard, 0);
  const top = rank.slice(0, 3); const maxDone = top.length ? top[0].done : 0;
  // подиум: серебро — слева, золото — в центре, бронза — справа (при двух игроках — золото и серебро)
  const stand = top.length >= 3 ? [1, 0, 2] : top.length === 2 ? [0, 1] : [0];
  const Item = ({ x, big, n }) => { const ti = info(x.id); return (
    <li className={`tod-title ${big ? 'tod-title-shame' : ''} reveal rounded-[20px] border border-white/10 bg-white/[0.04] p-4 flex items-start gap-3`} style={{ animationDelay: (n * 90) + 'ms' }}>
      <span aria-hidden="true" className={`${big ? 'text-3xl' : 'text-2xl'} tod-title-ico`}>{ti.icon}</span>
      <span className="flex flex-col gap-0.5 min-w-0"><span className={`${big ? 'text-lg' : 'text-base'} font-bold text-white break-words`}>{todTx(ui, ti.name)}: {nameOf(x.p)}</span><span className="ui-hint">{todTx(ui, ti.hint)}</span></span>
    </li>
  ); };
  const stat = (v, label) => <li className="tod-stat"><span className="tod-stat-v">{v}</span><span className="tod-stat-l">{label}</span></li>;
  return (
    <div className="safe-screen w-full flex flex-col items-center slide-up relative z-10">
      {maxDone > 0 && <div className="confetti-layer absolute inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">{Array.from({ length: 16 }, (_, k) => <span key={k} className="confetti-piece" style={{ left: ((k * 37) % 100) + '%', fontSize: (16 + (k % 4) * 4) + 'px', '--dx': (((k % 5) - 2) * 18) + 'px', '--dur': (5 + (k % 5)) + 's', '--delay': ((k % 7) * 0.35) + 's' }}>{['🎉', '✨', '🔥', '🎊'][k % 4]}</span>)}</div>}
      <main className="w-full max-w-md lg:max-w-5xl flex flex-col gap-6 pt-6 pb-10 relative z-10 desk-cols">
        <header className="tod-res-hero">
          <span aria-hidden="true" className="tod-res-cup">🏆</span>
          <h1 className="tod-res-title">{todTx(ui, 'Итоги')}</h1>
          <p className="tod-res-sub">{todTx(ui, 'Партия окончена')}</p>
          <ul className="tod-stats" aria-label={todTx(ui, 'Итоги партии')}>
            {stat(doneAll, todTx(ui, 'выполнено'))}{stat(skipAll, todTx(ui, 'пропусков'))}{stat(hardAll, todTx(ui, 'жёстких'))}
          </ul>
        </header>
        {banner}
        {maxDone > 0 && (
          <section className="flex flex-col gap-3" aria-label={todTx(ui, 'Подиум')}>
            <ol className={`tod-podium tod-podium-${top.length}`}>
              {stand.map((idx, col) => { const r = top[idx]; const p = st.pl[r.p]; return (
                <li key={r.p} className={`tod-pod tod-pod-${idx + 1}`} style={{ '--k': Math.max(0.12, r.done / maxDone).toFixed(3), animationDelay: (col * 120) + 'ms' }}>
                  <span aria-hidden="true" className="tod-pod-medal">{TOD_MEDALS[idx]}</span>
                  <TodAvatar p={p} i={r.p} big />
                  <span className="tod-pod-name">{p ? p.name : ''}</span>
                  <span className="tod-pod-bar"><b>{r.done}</b></span>
                </li>
              ); })}
            </ol>
          </section>
        )}
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-bold text-white">{todTx(ui, 'Зал позора')}</h2>
          {t.shame.length ? <ul className="flex flex-col gap-3">{t.shame.map((x, i) => <Item key={'s' + i} x={x} big n={i} />)}</ul>
            : <p className="tod-clean">{todTx(ui, t.clean ? tr("Сегодня без позора. Все молодцы!") : tr("Позорных титулов нет, но пропуски были — в следующий раз смелее."))}</p>}
        </section>
        {t.cheer.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-bold text-zinc-300">{todTx(ui, 'Герои игры')}</h2>
            <ul className="flex flex-col gap-2">{t.cheer.map((x, i) => <Item key={'c' + i} x={x} n={t.shame.length + i} />)}</ul>
          </section>
        )}
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-bold text-zinc-300">{todTx(ui, 'Таблица')}</h2>
          <table className="tod-table w-full text-left text-sm">
            <thead><tr><th scope="col">{todTx(ui, 'Игрок')}</th><th scope="col" aria-label={todTx(ui, 'Выполнено')}>✔</th><th scope="col" aria-label={todTx(ui, 'Пропущено')}>🐔</th><th scope="col">{todTx(ui, 'жёстких')}</th></tr></thead>
            <tbody>{rank.map(r => <tr key={r.p}><td className="break-words">{nameOf(r.p)}</td><td>{r.done}</td><td>{r.skips}</td><td>{r.hard}</td></tr>)}</tbody>
          </table>
        </section>
        <div className="flex flex-col gap-3">
          <button type="button" onClick={() => { ui.SoundFX.click(); onAgain(); }} className="btn-primary w-full">{todTx(ui, 'Сыграть ещё')}</button>
          <button type="button" onClick={() => { ui.SoundFX.click(); onMenu(); }} className="btn-secondary w-full">{todTx(ui, 'В меню')}</button>
        </div>
      </main>
    </div>
  );
};
