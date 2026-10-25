// Режим «Правда или действие»: экраны — архив карточек (вкладки «Правда» и «Действие» в «Все вопросы») и админка карточек.
// Всё, что нужно от приложения, приходит пропсами и объектом ui = { Icons, SoundFX, AppFooter, showToast, showError(title, msg), navigate, SettingSwitch, PopupModal }:
// в тестах модуль подставляется в код app.jsx, поэтому он ничего не импортирует из app.jsx. Из React — только React.useState и т. п. (без деструктуризации).
// Ошибки записи в админке показываются прямо на экране (под полем, у кнопки загрузки, всплывающим уведомлением): общее окно ошибки есть не на всех экранах.
import React from 'react';
import { TOD_STARTER } from '../content/tod-cards.js';
import { TOD_TYPES, TOD_LEVELS, TOD_TEXT_MAX, todCleanCard, todGroupCards, todNewId } from './model.js';

const TOD_GROUP_LABEL = { easy: 'Простые', medium: 'Средние', hard: 'Жёсткие' }; // названия групп уровня (в заголовках, фильтрах и форме)
const TOD_TYPE_LABEL = { truth: 'Правда', dare: 'Действие' };
const TOD_DOTS = { easy: 1, medium: 2, hard: 3 }; // значок уровня: сколько из трёх точек закрашено (цвет не единственный признак)
const TOD_FILTER_TYPES = [['all', 'Все'], ['truth', 'Правда'], ['dare', 'Действие']];
const TOD_FILTER_LEVELS = [['all', 'Все уровни'], ['easy', 'Простые'], ['medium', 'Средние'], ['hard', 'Жёсткие']];

// метка уровня: значок из точек, подпись и (если передан) число карточек; цвет — класс tod-lvl-<уровень> из styles.css
const TodLevelMark = ({ level, count }) => (
  <h3 className={`tod-lvl tod-lvl-${level}`}>
    <span className="tod-lvl-dots" aria-hidden="true">{[1, 2, 3].map(i => <i key={i} className={i <= TOD_DOTS[level] ? 'on' : ''}></i>)}</span>
    <span>{TOD_GROUP_LABEL[level]}</span>
    {typeof count === 'number' && <span className="tod-lvl-n">{' '}· {count}</span>}
  </h3>
);

// архив карточек для «Все вопросы»: tab — 'truth' | 'dare'; игроку видны только включённые карточки, владельцу ещё и скрытые (с меткой «скрыта»)
export const TodArchive = ({ ui, cards, tab, isAdmin, onManage }) => {
  const type = tab === 'dare' ? 'dare' : 'truth';
  const groups = todGroupCards(cards, { showHidden: !!isAdmin })[type];
  const shown = TOD_LEVELS.filter(lv => groups[lv].length > 0);
  return (
    <div className="flex flex-col gap-6 fade-in">
      {isAdmin && onManage && <button type="button" onClick={() => { ui.SoundFX.click(); onManage(); }} className="btn-secondary w-full flex items-center justify-center gap-2.5">⚙ Управление карточками</button>}
      {shown.length === 0 && <p className="text-sm text-zinc-400 text-center py-10 leading-relaxed">Пока нет карточек.</p>}
      {shown.map(lv => (
        <section key={lv} className="space-y-3">
          <TodLevelMark level={lv} count={groups[lv].length} />
          <div className="flex flex-col divide-y divide-white/[0.08] border-y border-white/10">
            {groups[lv].map(c => (
              <div key={c.id} className="py-4 flex items-start justify-between gap-4">
                <div className={`flex-1 min-w-0 text-[15px] leading-snug break-words ${c.isActive ? 'text-zinc-100' : 'text-zinc-400'}`}>{c.text}</div>
                {!c.isActive && <span className="tag tag-warn flex-shrink-0"><span aria-hidden="true">🙈</span> скрыта</span>}
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
const todNewWord = (n) => (n % 10 === 1 && n % 100 !== 11 ? 'новая' : 'новых');

// ошибка записи -> понятное сообщение без адреса базы и токенов; verb — что пытались сделать («сохранить», «загрузить набор»)
const todErrText = (e, verb) => {
  const m = String((e && e.message) || ''); const http = m.match(/^HTTP (\d{3})$/);
  if (e && e.todRead) return 'Не удалось проверить, что уже лежит в базе, поэтому ничего не записано. Проверьте интернет и попробуйте ещё раз.';
  let text;
  if (http && (http[1] === '401' || http[1] === '403')) text = `Не удалось ${verb}: нет прав на запись. Проверьте вход владельца.`;
  else if (http) text = `Не удалось ${verb}: сервер ответил ошибкой. Попробуйте ещё раз чуть позже.`;
  else if (m === 'Некорректная карточка') text = 'Карточка не прошла проверку. Проверьте тип, уровень и текст.';
  else text = `Не удалось ${verb}: нет связи с сервером. Проверьте интернет и попробуйте ещё раз.`;
  const added = e && Number(e.added); // загрузка набора могла успеть записать часть карточек
  if (added > 0) text += ` Успело записаться: ${added}. Повторное нажатие дозапишет остальные.`;
  return text;
};

// админка карточек (только владельцу): фильтры, форма (тип, уровень, текст), «Скрыть/Показать», разовая загрузка стартового набора. Кнопки удаления нет.
// onSave(card) -> Promise<card> (бросает ошибку при сбое), onSeed() -> Promise<{ added, skipped }>, source — откуда сейчас список: 'db' | 'cache' | 'starter'
export const TodAdmin = ({ ui, cards, source, isAdmin, onSave, onSeed, onBack }) => {
  const { Icons, AppFooter } = ui;
  const [fType, setFType] = React.useState('all'); const [fLevel, setFLevel] = React.useState('all');
  const [edit, setEdit] = React.useState(null); // null — форма закрыта, 'new' — новая карточка, иначе id изменяемой
  const [fmType, setFmType] = React.useState('truth'); const [fmLevel, setFmLevel] = React.useState('easy'); const [fmText, setFmText] = React.useState('');
  const [err, setErr] = React.useState(''); const [busy, setBusy] = React.useState(false);
  const [rowBusy, setRowBusy] = React.useState('');
  const [seedBusy, setSeedBusy] = React.useState(false); const [seedErr, setSeedErr] = React.useState('');
  const formRef = React.useRef(null); const areaRef = React.useRef(null);
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
    setFmType(c ? c.type : (fType !== 'all' ? fType : 'truth')); setFmLevel(c ? c.difficulty : (fLevel !== 'all' ? fLevel : 'easy')); setFmText(c ? c.text : '');
  };
  const save = async () => {
    if (busy) return;
    const clean = todCleanCard({ id: 'td_x', type: fmType, difficulty: fmLevel, text: fmText, isActive: true });
    if (!clean) { ui.SoundFX.warn(); setErr('Введите текст карточки'); return; }
    const twin = list.find(c => c.type === fmType && c.id !== edit && todNorm(c.text) === todNorm(clean.text));
    if (twin) { ui.SoundFX.warn(); setErr(twin.isActive === true ? 'Такая карточка уже есть' : 'Такая карточка уже есть, но скрыта: найдите её в списке и нажмите «Показать»'); return; }
    const existing = edit !== 'new' ? list.find(c => c.id === edit) : null;
    if (edit !== 'new' && !existing) { ui.SoundFX.warn(); setErr('Карточка не найдена. Закройте форму и откройте её заново.'); return; }
    setBusy(true); setErr('');
    try {
      await onSave({ id: existing ? existing.id : todNewId(), type: fmType, difficulty: fmLevel, text: clean.text, isActive: existing ? existing.isActive : true });
      ui.SoundFX.success(); ui.showToast('Карточка сохранена'); setEdit(null);
    } catch (e) { ui.SoundFX.warn(); setErr(todErrText(e, 'сохранить')); }
    setBusy(false);
  };
  const toggle = async (c) => {
    if (rowBusy) return;
    setRowBusy(c.id);
    try { await onSave({ ...c, isActive: c.isActive !== true }); ui.SoundFX.click(); ui.showToast(c.isActive === true ? 'Карточка скрыта' : 'Карточка снова в игре'); }
    catch (e) { ui.SoundFX.warn(); ui.showToast(todErrText(e, 'сохранить'), 6000, 'warn'); }
    setRowBusy('');
  };
  const seed = async () => {
    if (seedBusy) return;
    setSeedBusy(true); setSeedErr('');
    try {
      const r = await onSeed(); const added = (r && Number(r.added)) || 0; const skipped = (r && Number(r.skipped)) || 0;
      ui.SoundFX.success();
      if (added > 0) ui.showToast(`Стартовый набор загружен: ${added} ${todNewWord(added)}` + (skipped > 0 ? `, уже были ${skipped}` : ''), 4200);
      else ui.showToast('В базе уже есть весь стартовый набор', 3200, 'info');
    } catch (e) { ui.SoundFX.warn(); setSeedErr(todErrText(e, 'загрузить набор')); }
    setSeedBusy(false);
  };

  const types = fType === 'all' ? TOD_TYPES : [fType]; const levels = fLevel === 'all' ? TOD_LEVELS : [fLevel];
  const groups = todGroupCards(list, { showHidden: true });
  const total = types.reduce((n, t) => n + levels.reduce((m, lv) => m + groups[t][lv].length, 0), 0);
  return (
    <div className="safe-screen w-full flex flex-col items-center slide-up relative z-10">
      <header className="w-full max-w-md flex items-center gap-3 pt-2">
        <button type="button" onClick={() => { ui.SoundFX.click(); onBack(); }} aria-label="Назад" className="btn-icon flex-shrink-0"><Icons.Back /></button>
        <h1 className="flex-1 text-center pr-11 text-lg font-bold text-white">Карточки</h1>
      </header>
      <main className="w-full max-w-md flex flex-col gap-6 pt-6 pb-6">
        {!isAdmin ? ( <p className="text-sm text-zinc-400 text-center">Раздел доступен только владельцу.</p> ) : (
          <>
            <p className="ui-hint">Карточки режима «Правда или действие». Скрытая карточка не попадает в игру и в архив игрока; удалить карточку нельзя, только скрыть. Всего: {list.length}, скрыто: {hiddenN}.</p>
            {source !== 'db' && (
              <div role="note" className="rounded-[20px] border border-white/10 bg-white/[0.04] p-4 flex flex-col gap-2">
                <span className="tag tag-warn self-start">{source === 'cache' ? 'Копия на устройстве' : 'Встроенный набор'}</span>
                <p className="ui-hint">{source === 'cache'
                  ? 'Сейчас показана копия карточек на этом устройстве: база не ответила. Изменения могут не сохраниться — проверьте интернет.'
                  : 'Сейчас показан встроенный набор: в базе карточек нет или она не ответила. Загрузите стартовый набор в базу до того, как менять карточки: после первой записи игрокам будут видны только карточки из базы.'}</p>
              </div>
            )}
            {seedN > 0 && (
              <div className="flex flex-col gap-1">
                <button type="button" disabled={seedBusy} onClick={seed} className="btn-secondary w-full">{seedBusy ? 'Загружаем карточки…' : `Загрузить стартовый набор (${seedN} ${todNewWord(seedN)})`}</button>
                {seedErr && <span className="ui-error" role="alert">{seedErr}</span>}
              </div>
            )}
            {edit === null ? (
              <button type="button" onClick={() => startEdit(null)} className="btn-primary w-full">+ Новая карточка</button>
            ) : (
              <section ref={formRef} className="flex flex-col gap-3 rounded-[20px] border border-white/10 bg-white/[0.04] p-4 fade-in">
                <h2 className="text-sm font-bold text-white">{edit === 'new' ? 'Новая карточка' : 'Редактирование карточки'}</h2>
                <div className="seg" role="radiogroup" aria-label="Тип карточки">
                  {TOD_TYPES.map(t => <button key={t} type="button" role="radio" aria-checked={fmType === t} onClick={() => { ui.SoundFX.click(); setFmType(t); setErr(''); }} className={`seg-btn ${fmType === t ? 'is-active' : ''}`}>{TOD_TYPE_LABEL[t]}</button>)}
                </div>
                <div className="seg" role="radiogroup" aria-label="Уровень карточки">
                  {TOD_LEVELS.map(lv => <button key={lv} type="button" role="radio" aria-checked={fmLevel === lv} onClick={() => { ui.SoundFX.click(); setFmLevel(lv); }} className={`seg-btn ${fmLevel === lv ? 'is-active' : ''}`}>{TOD_GROUP_LABEL[lv]}</button>)}
                </div>
                <div>
                  <textarea ref={areaRef} value={fmText} maxLength={TOD_TEXT_MAX} onChange={e => { setFmText(e.target.value); setErr(''); }} aria-label="Текст карточки" aria-invalid={err ? 'true' : undefined}
                    placeholder={fmType === 'truth' ? 'Вопрос, на который нужно ответить честно' : 'Задание, которое нужно выполнить'} />
                  <div className="flex items-start justify-between gap-3">
                    {err ? <span className="ui-error" role="alert">{err}</span> : <span></span>}
                    <span className="ui-hint mt-1.5 flex-shrink-0 tabular-nums">{fmText.length} / {TOD_TEXT_MAX}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => { ui.SoundFX.click(); setEdit(null); setErr(''); }} className="btn-secondary">Отмена</button>
                  <button type="button" disabled={busy} onClick={save} className="btn-primary">{busy ? 'Сохраняем…' : 'Сохранить'}</button>
                </div>
              </section>
            )}
            <div className="flex flex-col gap-3">
              <div className="seg" role="group" aria-label="Фильтр по типу">
                {TOD_FILTER_TYPES.map(([id, label]) => <button key={id} type="button" aria-pressed={fType === id} onClick={() => { ui.SoundFX.click(); setFType(id); }} className={`seg-btn ${fType === id ? 'is-active' : ''}`}>{label}</button>)}
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Фильтр по уровню">
                {TOD_FILTER_LEVELS.map(([id, label]) => <button key={id} type="button" aria-pressed={fLevel === id} onClick={() => { ui.SoundFX.click(); setFLevel(id); }} className={`chip ${fLevel === id ? 'is-on' : ''}`}>{label}</button>)}
              </div>
            </div>
            {total === 0 && <p className="text-sm text-zinc-400 text-center py-6 leading-relaxed">{list.length === 0 ? 'Карточек пока нет.' : 'По выбранным фильтрам карточек нет.'}</p>}
            {types.map(t => {
              const n = levels.reduce((m, lv) => m + groups[t][lv].length, 0);
              if (n === 0) return null;
              return (
                <section key={t} className="flex flex-col gap-4">
                  <h2 className="text-base font-bold text-white">{TOD_TYPE_LABEL[t]} <span className="text-zinc-500 font-semibold">· {n}</span></h2>
                  {levels.map(lv => {
                    const items = groups[t][lv];
                    if (items.length === 0) return null;
                    return (
                      <div key={lv} className="flex flex-col gap-2">
                        <TodLevelMark level={lv} count={items.length} />
                        <div className="rounded-[20px] border border-white/10 bg-white/[0.04] divide-y divide-white/[0.06] overflow-hidden">
                          {items.map(c => (
                            <div key={c.id} className="px-4 py-3.5 flex flex-col gap-2.5">
                              <p className={`text-[15px] leading-snug break-words ${c.isActive === true ? 'text-zinc-100' : 'text-zinc-400'}`}>{c.text}</p>
                              <div className="flex items-center justify-end gap-2">
                                {c.isActive !== true && <span className="tag tag-warn mr-auto"><span aria-hidden="true">🙈</span> скрыта</span>}
                                <button type="button" aria-label={`Изменить: ${c.text}`} onClick={() => startEdit(c)} className="btn-secondary btn-sm">✎ Изменить</button>
                                <button type="button" disabled={!!rowBusy} aria-label={`${c.isActive === true ? 'Скрыть' : 'Показать'}: ${c.text}`} onClick={() => toggle(c)} className="btn-secondary btn-sm">{c.isActive === true ? 'Скрыть' : 'Показать'}</button>
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
