# Режим «Правда или действие» — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Добавить в ASK ME режим «Правда или действие»: ход по кругу, карточки без повторов, пропуск с подколками и «Залом позора», игра на нескольких устройствах сессии, админка и архив карточек.

**Architecture:** Новый код лежит в `src/tod/*` (чистые модули `model`, `deck`, `engine`, `talk`, `titles`, `cards`, `channel` и экраны `screens.jsx`) и в `src/content/tod-*.js`. `src/app.jsx` только подключает их: импорты, маршруты, состояние, пункты меню. Состояние игры — один JSON `st`, его меняет чистая функция `todApply`; колода — список `id` и `seed`, порядок все устройства считают одинаково. Синхронизация — отдельный узел `live/l_<хеш>_t`.

**Tech Stack:** React 18, Vite, Firebase Realtime DB через REST, тесты — обычные node-скрипты (jsdom, `T(name, cond)`), Playwright для проверки в браузере.

**Spec:** `docs/superpowers/specs/2026-10-24-truth-or-dare-design.md`

## Global Constraints

- Работа ведётся в git-клоне `/home/claude/remote-clone/love-game` (в нём есть `node_modules`) на ветке `feat/truth-or-dare`. `/home/claude/love-game` — не репозиторий, его не править. Файл `database.rules.json` в `.gitignore`, в коммиты не попадает.
- Коммиты — на украинском, строки-подписи в конце такие же, как в последнем коммите (`git log -1 --format=%B`). Хук `pre-push` в клоне может быть не включён, поэтому перед каждым `git push` исполнитель сам запускает `npm run verify`.
- Комментарии в коде и тексты интерфейса — по-русски (владелец просил русские комментарии; локализацию на uk/en не начинаем).
- В `src/tod/*` все верхнеуровневые имена с префиксом `tod`/`Tod`/`TOD_`; импорты только однострочные (`import { a, b } from './x.js';`); без `export default`; из React только `React.useState(...)` и т. п. (без деструктуризации): в тестах модули подставляются в общий код `app.jsx`.
- Только классы Heat из `src/styles.css`; новые классы и цвета — в `src/styles.css` и в `claude/design-system.md` (Projects) в том же заходе. Нажимаемое не меньше 44 px, текст не меньше 13 px, анимируются только `transform` и `opacity`, `prefers-reduced-motion` учитывается.
- Числа из спеки: текст карточки 1–300 знаков; `id` карточки `td_` + base36, не длиннее 16 знаков; пул колоды не больше 120 карточек (всего 480), `ids` не длиннее 12000 знаков, `st` не длиннее 20000; игроков 2–10 (`MAX_PLAYERS`); защита от двойного нажатия `LIVE_TAP_GUARD_MS` (500 мс); присутствие и опрос — готовые `LIVE_ALIVE_MS`, `LIVE_BEAT_MS`, `LIVE_INVITE_MS`, `LIVE_POLL_MS`.
- Классический код не меняется, кроме аддитивных правок: импорты, маршруты и названия экранов, пункт в `ownerItems`, вкладки в `cat_list`, карточка в `mode_select`, `inGameHash` в `src/update.js`, строка в cookies и новые абзацы в `legal.js`/`about.js`.
- Не делаем: наказания, таймеры, аналитику режима, перевод, правку правил `live`/`sessions`/`analytics`, локальное сохранение партии.
- Правила `tod` в боевую базу публикуются только после явного «да» владельца (Task 17), до слияния PR.
- Тесты: каждый файл — node-скрипт, печатает `PASS …`/`FAIL …`; его регистрируют в `tests/run-all.js` (списки `UNIT`/`UI`). В тестовых шагах вместо `...` пишется проверка, прямо следующая из названия, с числами и текстами из спеки. Проверка задачи: запустить её файл (`node tests/unit/tod-x.test.js`) и убедиться, что нет `FAIL`; в конце этапа — `npm run verify`.
- Слияние: вся работа — один pull request `feat/truth-or-dare` -> `main` (ветка в `main` не вливается по этапам: вкладки «Правда»/«Действие» без самого режима игроку не нужны). Этапы — отдельные коммиты внутри PR; CI на PR запускает `verify`.
- Содержимое (карточки, реплики): лёгкие и средние черновики можно получить через `ask_gemini` (если доступен), но исполнитель обязан прочитать и поправить каждую строку; жёсткие (18+), острые и политические строки пишет сам исполнитель. Границы — раздел 9.2 спеки. Владелец читает файлы содержимого до слияния PR (ворота в Task 4 и Task 11); его замечания к карточкам и репликам учитываются в любой момент, работа над кодом при этом не останавливается.

## Review Focus

- Два устройства одновременно нажимают «Выполнено» или «Пропустить»: ход меняется ровно один раз, на обоих экранах один и тот же игрок (Task 7, Task 13).
- Перезагрузка страницы посреди хода и вход в уже идущую игру: та же карточка, тот же игрок, колода не сбрасывается (Task 14).
- Испорченные или чужие данные канала (индексы за пределами, не те типы, слишком длинные строки): игнорируются, приложение не падает (Task 7, Task 12).
- Игра закончена сразу или с пустой статистикой, два игрока, ничья: итоги без `NaN`, детерминированные титулы, «Сегодня без позора» (Task 8, Task 11).
- Имена с `{name}`, `{a|b}`, `<b>`, 25 знаков с эмодзи и карточка, которой нет у устройства: текст выводится как есть, не раскрывается повторно, экран не ломается (Task 8, Task 10).

---

## Этап 1. Данные, админка, архив

### Task 1: Правила узла `tod` и тестовая основа

**Files:**
- Create: `tests/fixtures/tod-rules.json`, `tests/rules-eval.js`, `tests/tod-load.js`, `tests/unit/tod-rules.test.js`
- Modify: `tests/fake-rtdb.js`, `tests/harness.js`, `tests/run-all.js`

**Interfaces:**
- Produces: `tests/rules-eval.js` экспортирует `makeRules(json) -> { check(method, path: string[], auth: {uid}|null, data) -> null | string }` (`null` — запись разрешена, строка — причина отказа; для `DELETE` `data` равна `null` и `.validate` не проверяется). Правила `.write`/`.validate` выполняются как JS-выражения: `newData` — обёртка с `child(k)`, `hasChildren([..])`, `isString()`, `isNumber()`, `isBoolean()`, `exists()`, `val()`; переменные `auth` и `$id` подставляются. Явные дочерние правила важнее `$other`.
- Produces: `tests/tod-load.js` экспортирует `loadTod(files: string[], names: string[]) -> object` (файлы относительно `src/`, например `['tod/model.js']`; убирает строки `import` и приставку `export `, склеивает, возвращает перечисленные имена).
- Produces: `makeDb({ ownerToken })` в `fake-rtdb.js` понимает `/tod.json` и `/tod/<id>.json` (GET/PUT/DELETE); токен в `?auth=` равный `ownerToken` — владелец (`uid` = `OWNER_UID`), любой другой — обычный пользователь; запись проверяется по `tod-rules.json`; отказ — HTTP 401 и `stats.denied++`. Методы `db.tod() -> object` и `db.seedTod(map)`. Комнаты `*_t` считаются вспомогательными (как `*_d`), `db.room()` их не возвращает; добавляется `db.todRoom() -> object|null`.
- Produces: `tests/harness.js` подставляет в `app.jsx` не только `./content/*.js`, но и `./tod/*.js|jsx` (однострочные импорты, в порядке импортов).

- [ ] **Step 1: Написать `tests/unit/tod-rules.test.js` (должен падать)**

Правила читаются из `tests/fixtures/tod-rules.json` через `makeRules`. Проверки:
```js
T('владелец пишет корректную карточку', rules.check('PUT',['tod','td_a1'],OWNER,card()) === null);
T('обычный пользователь не пишет', rules.check('PUT',['tod','td_a1'],{uid:'x'},card()) !== null);
T('без входа не пишет', rules.check('PUT',['tod','td_a1'],null,card()) !== null);
T('лишнее поле отклонено ($other)', rules.check('PUT',['tod','td_a1'],OWNER,{...card(),extra:1}) !== null);
T('updatedAt допустим', rules.check('PUT',['tod','td_a1'],OWNER,{...card(),updatedAt:5}) === null);
T('id не совпадает с ключом', rules.check('PUT',['tod','td_b2'],OWNER,card()) !== null);
T('id длиннее 16 знаков', rules.check('PUT',['tod','td_12345678901234'],OWNER,card({id:'td_12345678901234'})) !== null);
T('text пустой / 301 знак отклонены, 300 принят', ...);
T('type/difficulty вне списка отклонены', ...);
T('isActive не boolean отклонён', ...);
T('удаление записи владельцем разрешено, чужим нет', ...);
```
Здесь `card(o)` = `{id:'td_a1',type:'truth',difficulty:'easy',text:'Вопрос?',isActive:true,...o}`.

- [ ] **Step 2: Запустить, убедиться, что падает**

Run: `node tests/unit/tod-rules.test.js`
Expected: ошибка «Cannot find module» / `FAIL`.

- [ ] **Step 3: Создать `tests/fixtures/tod-rules.json`**

Узел `tod`: `.read: true`; `.write: "auth != null && auth.uid === 'OWNER_UID'"`; `$id` с `.validate` (`newData.hasChildren(['id','type','difficulty','text','isActive']) && newData.child('id').val() === $id && newData.child('id').val().length <= 16`) и явными дочерними правилами для каждого поля: `id` — строка; `type` — `truth|dare`; `difficulty` — `easy|medium|hard`; `text` — строка длиной 1–300; `isActive` — boolean; `updatedAt` — число; `"$other": {".validate": false}`. В `_comment` написать, что это копия узла для тестов и что боевой идентификатор владельца заменён на `OWNER_UID`.

- [ ] **Step 4: Реализовать `tests/rules-eval.js`, `tests/tod-load.js`, расширить `fake-rtdb.js` и `harness.js`**

`rules-eval`: выражения правил вычисляются через `new Function` (синтаксис правил Firebase совместим с JS); `.write` сверху вниз, любое `true` разрешает; `.validate` — для узла и всех присутствующих потомков. В `harness.js` существующая подстановка `./content/` обобщается на `./(content|tod)/<имя>.(js|jsx)`.

- [ ] **Step 5: Зарегистрировать `tod-rules` в `UNIT` (`tests/run-all.js`), прогнать**

Run: `node tests/unit/tod-rules.test.js && node tests/run-all.js --unit`
Expected: все `PASS`, прежние наборы не сломаны.

- [ ] **Step 6: Commit**

```bash
git checkout -b feat/truth-or-dare
git add tests && git commit -m "Тести: правила вузла tod, обчислювач правил, завантажувач модулів tod, tod у fake-rtdb"
```

### Task 2: Модель карточки и стартовый набор

**Files:**
- Create: `src/tod/model.js`, `src/content/tod-cards.js`, `tests/unit/tod-model.test.js`
- Modify: `tests/unit/content.test.js`, `tests/run-all.js`

**Interfaces:**
- Produces (`model.js`): `TOD_TYPES=['truth','dare']`, `TOD_LEVELS=['easy','medium','hard']`, `TOD_LEVEL_LABEL={easy:'Легко',medium:'Средне',hard:'Жёстко'}`, `TOD_TEXT_MAX=300`;
  `todCleanCard(raw) -> {id,type,difficulty,text,isActive,updatedAt?}|null` (проверяет значения как правило из Task 1, обрезает/чистит текст: убирает `<>` и управляющие символы, `trim`, `null` если пусто);
  `todCleanList(data) -> card[]` (из объекта БД или массива; без дублей `id`, отсортирован по `id`);
  `todPoolOf(card) -> 'truth'|'dare.easy'|'dare.medium'|'dare.hard'`;
  `todGroupCards(cards, {showHidden}) -> {truth:{easy:[],medium:[],hard:[]}, dare:{…}}` (скрытые `isActive:false` только при `showHidden`);
  `todNewId(now=Date.now(), rnd=Math.random) -> string` (`td_` + base36, ≤16 знаков).
- Produces (`tod-cards.js`): `TOD_STARTER` — массив из 120 карточек, `id` вида `td_s001`…`td_s120`, `isActive:true`; по 20 на каждую из шести групп «тип × уровень».

- [ ] **Step 1: Написать тесты**

`tod-model.test.js` (через `loadTod(['tod/model.js'], [...])`): `todCleanCard` принимает корректную, отбрасывает неверный `type`/`difficulty`/пустой текст/нестроковый `id`/`id` длиннее 16, обрезает текст до 300, чистит `<script>`-скобки; `todCleanList` отбрасывает мусор и дубли; `todPoolOf` для четырёх случаев; `todGroupCards` прячет скрытые, показывает при `showHidden`; `todNewId` ≤16 знаков и разные при разных `rnd`.
В `content.test.js` добавить для `TOD_STARTER` (загрузка как у `about`): 120 карточек; по 20 в каждой группе; уникальные `id` и тексты; все проходят `todCleanCard` без изменений; у `truth` текст оканчивается на `?`; в карточках нет упоминаний войны, армии, политиков и государств (ключевые слова-регулярка); длина ≤ 300.

- [ ] **Step 2: Запустить, убедиться, что падает**

Run: `node tests/unit/tod-model.test.js`
Expected: FAIL / нет модуля.

- [ ] **Step 3: Реализовать `model.js`**

Правила совпадают с `tod-rules.json`; `todCleanCard` использует `sanitize` без зависимости от `app.jsx` (собственная короткая очистка).

- [ ] **Step 4: Написать `src/content/tod-cards.js`**

`export const TOD_STARTER = [...]`. Тон: лёгкие — для любой компании; средние — личнее и смелее; жёсткие — откровенные (18+, про близость), но без насилия и унижения. «Действие» — безопасные, выполнимые в комнате без предметов, которых нет под рукой. Без политики и темы войны (этот режим в картах нейтрален).

- [ ] **Step 5: Прогнать и зарегистрировать**

Run: `node tests/unit/tod-model.test.js && node tests/unit/content.test.js`
Expected: все `PASS`. Добавить `tod-model` в `UNIT`.

- [ ] **Step 6: Commit**

```bash
git add src/tod/model.js src/content/tod-cards.js tests && git commit -m "Режим «Правда чи дія»: модель картки та стартовий набір (120 карток)"
```

### Task 3: Загрузка карточек, кэш, запись и подключение в приложение

**Files:**
- Create: `src/tod/cards.js`, `tests/unit/tod-cards.test.js`
- Modify: `src/app.jsx`, `src/content/legal.js`, `tests/run-all.js`

**Interfaces:**
- Consumes: `todCleanList`, `todCleanCard` (Task 2), `TOD_STARTER`.
- Produces (`cards.js`): `TOD_CACHE_KEY='askme_tod_cards_v1'`;
  `todReadCache(storage) -> card[]` (`[]` при пустом/битом);
  `todWriteCache(storage, list) -> void`;
  `todLoadCards(env) -> Promise<{list, source:'db'|'cache'|'starter'}>`, где `env = {baseUrl, fetch(url, opts, ms), storage, starter}`; читает `${baseUrl}/tod.json`, при успехе и непустом результате пишет кэш;
  `todSaveCard(env, card) -> Promise<card>` (`PUT ${baseUrl}/tod/<id>.json`, тело — очищенная карточка с `updatedAt: Date.now()`, при `!ok` бросает `Error('HTTP <код>')`);
  `todSeedStarter(env, existingIds: string[]) -> Promise<{added:number, skipped:number}>` (по одной `PUT`, существующие пропускает, при сбое бросает ошибку с полем `added`);
  `todActive(list) -> card[]` (`isActive === true`).
- Produces (`app.jsx`): состояния `todCards` (начальное значение — `todReadCache` или `TOD_STARTER`) и `todSource`; эффект загрузки при старте приложения; `todCardsEnv` — объект `env` для остальных задач.

- [ ] **Step 1: Написать `tests/unit/tod-cards.test.js`**

С фейковым `env` (fetch-заглушка, хранилище-объект). Проверки:
```js
T('из базы: мусор отброшен, source db, кэш записан', ...);
T('база пуста (null) и кэш есть -> source cache', ...);
T('база пуста и кэша нет -> source starter (120)', ...);
T('fetch бросает / !ok -> тот же откат, без исключения', ...);
T('save: PUT на /tod/<id>.json, тело очищено, updatedAt число', ...);
T('save: !ok -> Error("HTTP 401")', ...);
T('seed: существующие id пропущены, остальные записаны по одной', added===120-existing.length && skipped===existing.length);
T('seed: сбой на третьей записи -> ошибка с added===2', ...);
T('todActive отбрасывает isActive:false', ...);
```

- [ ] **Step 2: Запустить, убедиться, что падает**

Run: `node tests/unit/tod-cards.test.js`
Expected: FAIL / нет модуля.

- [ ] **Step 3: Реализовать `cards.js`**

- [ ] **Step 4: Подключить в `app.jsx`**

Однострочные импорты `tod-cards.js`, `model.js`, `cards.js` (после импортов `content`); эффект загрузки по образцу загрузки шаблонов наказаний (`/punishments.json`): `todLoadCards({baseUrl: FIREBASE_BASE_URL, fetch: fetchWithTimeout, storage: localStorage, starter: TOD_STARTER})`. Не показывать ошибок игроку: откат на кэш/стартовый набор молчаливый.

- [ ] **Step 5: Добавить ключ в cookies (`legal.js`)**

В строку `askme_seen_topics_v1, askme_punish_templates_v1, askme_*_cache_*` дописать `askme_tod_cards_v1`, а в описание — «карточки режима «Правда или действие»». Иначе тест cookies в `content.test.js` упадёт.

- [ ] **Step 6: Прогнать**

Run: `node tests/unit/tod-cards.test.js && node tests/unit/content.test.js && FLOW=player node tests/ui/menu.test.js`
Expected: все `PASS`, UI-проверка меню не сломана. Добавить `tod-cards` в `UNIT`.

- [ ] **Step 7: Commit**

```bash
git add src tests && git commit -m "Режим «Правда чи дія»: завантаження карток з кешем і запасним набором, запис і разове завантаження стартового набору"
```

### Task 4: Архив карточек (вкладки) и админка

**Files:**
- Create: `src/tod/screens.jsx` (пока `TodArchive`, `TodAdmin`), `tests/ui/tod-archive.test.js`, `tests/ui/tod-admin.test.js`
- Modify: `src/app.jsx`, `src/styles.css`, `tests/run-all.js`

**Interfaces:**
- Consumes: `todGroupCards`, `todCleanCard`, `todNewId`, `TOD_LEVEL_LABEL` (Task 2); `todSaveCard`, `todSeedStarter`, `todActive`, `todCardsEnv` (Task 3).
- Produces (`screens.jsx`): `TodArchive({ ui, cards, tab, isAdmin, onManage })` — группы «Простые/Средние/Жёсткие» (подписи к `easy/medium/hard`) с цветом уровня; `tab` — `'truth'|'dare'`; скрытые только при `isAdmin` с меткой «скрыта».
  `TodAdmin({ ui, cards, source, isAdmin, onSave(card)->Promise, onSeed()->Promise<{added,skipped}>, onBack })` — фильтры по типу и уровню, форма (тип, уровень, текст), тумблер «Показать/Скрыть», кнопка «Загрузить стартовый набор (N новых)» (показана, пока в базе нет части карточек `TOD_STARTER`), кнопки удаления нет.
  `ui = { Icons, SoundFX, AppFooter, showToast, showError(title,msg), navigate, SettingSwitch, PopupModal }`.
- Produces (`app.jsx`): экран `tod_admin` (`#/tod/manage`, заголовок «Карточки — Правда или действие — ASK ME»); пункт владельца `{ id:'tod', icon:'🎲', title:'Правда или действие', desc:'Карточки: добавить, изменить, скрыть' }` в `ownerItems`; в `cat_list` сегменты «Классика / Правда / Действие» (состояние `todTab`), для вкладок «Правда»/«Действие» вместо сетки тем рисуется `TodArchive`, владельцу — кнопка «⚙ Управление карточками».
- Produces (`styles.css`): токены `--tod-easy-rgb`, `--tod-medium-rgb`, `--tod-hard-rgb` (зелёный, жёлтый, красный) и классы `tod-lvl-easy|medium|hard` (цвет метки; рядом всегда значок и подпись).

- [ ] **Step 1: Написать UI-тесты (должны падать)**

`tod-archive.test.js` (`FLOW=player|offline|admin`, база — `makeDb`, в ней 3 активные «Правды» разных уровней, 1 скрытая «Действие» «Скрытая карточка»):
```js
// player
T('в «Все вопросы» три вкладки', has('Классика')&&has('Правда')&&has('Действие'));
T('вкладка «Правда»: группы Простые и Жёсткие и тексты карточек', ...);
T('скрытая карточка игроку не видна', !has('Скрытая карточка'));
// offline (база недоступна) 
T('база недоступна -> виден текст из стартового набора', has(TOD_STARTER[0].text) || has(<любая карточка truth из набора>));
// admin
T('владельцу видна скрытая карточка с меткой «скрыта»', has('Скрытая карточка')&&has('скрыта'));
T('у владельца есть «Управление карточками», у игрока нет', ...);
```
`tod-admin.test.js` (владелец: `localStorage askme_auth_v2 = {owner:{idToken:'owner-tok',...}}`, `makeDb({ownerToken:'owner-tok'})`):
```js
T('пункт «Правда или действие» есть в зоне владельца, игрок его не видит (отдельная проверка без токена)', ...);
T('страница: заголовок и адрес', D.title==='Карточки — Правда или действие — ASK ME' && w.location.hash==='#/tod/manage');
T('пустой текст -> «Введите текст карточки»', ...);
T('карточка записана в базу: поля id/type/difficulty/text/isActive/updatedAt, отказов правил нет', db.tod()[id].type==='dare' && db.stats.denied===0);
T('повтор текста того же типа -> «Такая карточка уже есть»', ...);
T('«Скрыть» -> isActive:false в базе; «Показать» -> true', ...);
T('изменение текста записано, остальные карточки целы', ...);
T('«Загрузить стартовый набор» записывает 120; повторно кнопки нет или added 0', Object.keys(db.tod()).length===120);
T('запись обычным токеном отклоняется правилами (401)', await w.fetch(base+'/tod/td_x.json?auth=t',{method:'PUT',...}).status===401);
T('ошибка сети при записи -> понятное сообщение, форма остаётся открытой', ...);
```

- [ ] **Step 2: Запустить, убедиться, что падает**

Run: `FLOW=player node tests/ui/tod-archive.test.js`
Expected: FAIL (нет вкладок).

- [ ] **Step 3: Реализовать `TodArchive`, `TodAdmin` в `screens.jsx`**

`TodAdmin` по образцу `punish_admin` (карточка-форма `rounded-[20px] border border-white/10 bg-white/[0.04]`, `ui-error` под полем, `btn-primary`/`btn-secondary`, `seg` для фильтров). Текст проходит `sanitizeInput(text, 300)` перед `todCleanCard`; повтор считается без учёта регистра и пробелов внутри того же типа.

- [ ] **Step 4: Подключить в `app.jsx`**

Импорты `screens.jsx`; `SCREEN_TO_HASH`/`HASH_TO_SCREEN`/`SCREEN_TITLES` для `tod_admin`; блок `if (screen === 'tod_admin')`; вкладки в `cat_list`; обработчики `todSave` (обновляет `todCards` и кэш) и `todSeed`. Не владельцу экран показывает «Раздел доступен только владельцу.» (как `punish_admin`).

- [ ] **Step 5: Добавить CSS**

Токены и `tod-lvl-*` в `src/styles.css`. Описать их в `claude/design-system.md` (Projects: `project_read` → правка → `project_write`).

- [ ] **Step 6: Прогнать, зарегистрировать**

Run: `for f in player offline admin; do FLOW=$f node tests/ui/tod-archive.test.js; done; node tests/ui/tod-admin.test.js`
Expected: все `PASS`, `captured runtime errors: 0`. В `UI` добавить `['tod-archive',{FLOW:'player'}], ['tod-archive',{FLOW:'offline'}], ['tod-archive',{FLOW:'admin'}], ['tod-admin',{}]`.

- [ ] **Step 7: Commit и ворота этапа 1**

```bash
git add src tests && git commit -m "Режим «Правда чи дія»: вкладки архіву та адмінка карток"
npm run verify
```
Expected: `verify` зелёный. Затем `git push -u origin feat/truth-or-dare`, открыть draft PR в `main` (CI запустится на PR) и показать владельцу `src/content/tod-cards.js` на чтение. Правила `tod` в боевой базе ещё не опубликованы: до Task 17 запись из админки даст понятное сообщение об ошибке, чтение работает из стартового набора.

---

## Этап 2. Игра на одном устройстве

### Task 5: Колода без повторов

**Files:**
- Create: `src/tod/deck.js`, `tests/unit/tod-deck.test.js`
- Modify: `tests/run-all.js`

**Interfaces:**
- Consumes: `todPoolOf` (Task 2), `todActive` не нужен: на вход уже активные карточки.
- Produces: `TOD_POOLS=['truth','dare.easy','dare.medium','dare.hard']`, `TOD_POOL_CAP=120`;
  `todHash(str) -> uint32` (FNV-1a);
  `todShuffle(arr, seed: string) -> arr'` (Фишер–Йейтс на генераторе mulberry32 от `todHash(seed)`, входной массив не меняет);
  `todBuildDeck(cards, {hard: boolean, seed: string}) -> {seed, pools:{[pool]: id[]}}` (без `hard`-карточек при `hard:false`; пулы по `todPoolOf`; «правда» берёт все разрешённые уровни; при превышении `TOD_POOL_CAP` — детерминированная выборка по `seed`);
  `todDeckStr(deck) -> string` (JSON; бросает `Error('deck too large')`, если длиннее 12000);
  `todParseDeck(str) -> deck|null` (проверяет типы: `seed` строка ≤40, известные пулы, массивы строк ≤16 знаков, ≤120 в пуле; мусор -> `null`);
  `todNext(deck, cur, pool) -> {id, cur', cycled}|null` — `cur` вида `{[pool]:{round,i}}`; следующая карточка `order(pool, round)[i]`, где `order = todShuffle(deck.pools[pool], deck.seed+':'+pool+':'+round)`; на конце круга `round+1`, `i=0`, `cycled:true`; пустой пул -> `null`; `cur` не изменяется (возвращается новый).

- [ ] **Step 1: Написать `tests/unit/tod-deck.test.js` (падает)**

```js
T('порядок одинаков при одном seed и различается при другом (пул из 50)', ...);
T('круг: N выдач из пула N дают N разных id, N+1-я — cycled:true и round 1', ...);
T('при hard:false жёстких нет в truth и dare.hard', ...);
T('при hard:true жёсткие «правды» попадают в truth', ...);
T('isActive:false в колоду не попадают', ...);
T('500 карточек: каждый пул <= 120, todDeckStr < 12000 при id по 16 знаков', ...);
T('пул из одной карточки: 5 выдач подряд не падают, каждая cycled', ...);
T('пустой пул -> null', todNext(deck,{}, 'dare.hard') === null);
T('todParseDeck: мусор, чужие пулы, длинные строки -> null', ...);
T('входные массивы и cur не мутируются', ...);
```

- [ ] **Step 2: Запустить, убедиться, что падает**

Run: `node tests/unit/tod-deck.test.js`
Expected: FAIL / нет модуля.

- [ ] **Step 3: Реализовать `deck.js`; прогнать**

Run: `node tests/unit/tod-deck.test.js`
Expected: все `PASS`. Добавить в `UNIT`.

- [ ] **Step 4: Commit**

```bash
git add src/tod/deck.js tests && git commit -m "Режим «Правда чи дія»: колода без повторів з детермінованим перемішуванням"
```

### Task 6: Реплики и титулы (содержимое)

**Files:**
- Create: `src/content/tod-banter.js`
- Modify: `tests/unit/content.test.js`

**Interfaces:**
- Produces: `TOD_EVENTS=['turn_start','chose_truth','chose_dare','level_easy','level_medium','level_hard','done','done_hard','skip_1','skip_2','skip_3','skip_hard','redeem','same_type_streak','easy_only','deck_cycle','game_end']`;
  `TOD_BANTER` — массив `{id, ev, tone: 1|2, text, tags?: ['ua']}`; в `text` допустимы только `{name}` и `{a|b}` (`a` — для `guy`, `b` — для `girl`);
  `TOD_TITLES` — массив `{id, shame: boolean, icon, name, hint}` в порядке таблицы 9.3 спеки: `coward` «Главный трус вечера», `deserter` «Серийный дезертир», `hard_fold` «Пасует перед жёстким», `later` «Вечное «давай потом»», `easy_life` «Любитель лёгкой жизни», `afraid_dare` «Боится действий», `careful` «Вечный осторожный» (все `shame:true`), `hero` «Герой вечера», `fearless` «Бесстрашный», `redeemed` «Искупил вину», `dare_master` «Мастер действий», `honest` «Самый честный» (`shame:false`); `hint` — одна строка с условием.

- [ ] **Step 1: Дописать проверки в `tests/unit/content.test.js` (падают)**

```js
T('tod-banter: у каждого события >=4 реплик тона 1 и >=3 тона 2', ...);
T('tod-banter: id уникальны, ev из TOD_EVENTS, tone 1|2, текст 8..140 знаков', ...);
T('tod-banter: в тексте только {name} и {a|b} с непустыми обеими формами', ...);
T('tod-banter: теги только ["ua"], политические (ua) реплики только тона 2, их >= 8', ...);
T('tod-banter: нет дублей текста, нет стоп-слов', ...);          // стоп-список см. шаг 3
T('tod-banter: реплики skip_* содержат {name}', ...);
T('tod-titles: 12 титулов, id по таблице, shame у первых 7', ...);
```

- [ ] **Step 2: Запустить, убедиться, что падает**

Run: `node tests/unit/content.test.js`
Expected: FAIL (нет `tod-banter.js`).

- [ ] **Step 3: Написать `src/content/tod-banter.js`**

Тон 1 — игривый, без вульгарности. Тон 2 — лёгкая вульгарность («хрень», «задница», «чёрт»), чёрный юмор «игровой», политическая сатира на государство-агрессора, его режим, армию как институт и пропаганду (тег `ua`), ничего о людях по национальности или языку, о погибших, пострадавших, мобилизованных, жителях оккупированных территорий. Подколки о поведении в игре. Нарастание резкости по цепочке `skip_1 → skip_2 → skip_3`; отдельные `skip_hard`. Стоп-список в тесте: категории слов — национальные и этнические оскорбления, слова о потерях и жертвах, призывы к насилию, сексуально-грубые оскорбления; исполнитель составляет регулярку сам и проверяет, что она ловит тестовые примеры.

- [ ] **Step 4: Прогнать**

Run: `node tests/unit/content.test.js`
Expected: все `PASS`.

- [ ] **Step 5: Commit**

```bash
git add src/content/tod-banter.js tests/unit/content.test.js && git commit -m "Режим «Правда чи дія»: підколки та титули (вміст) з перевірками меж"
```

### Task 7: Движок игры

**Files:**
- Create: `src/tod/engine.js`, `tests/unit/tod-engine.test.js`
- Modify: `tests/run-all.js`

**Interfaces:**
- Consumes: `TOD_POOLS`, `todNext`, `todHash` (Task 5).
- Produces:
  Состояние `st`: `{v:1, gid, phase:'choose'|'level'|'card'|'ended', turn, pl:[{id,name,gender}], type:''|'truth'|'dare', diff:''|'easy'|'medium'|'hard', card:null|{pool,id,lv}, streak, seq, ev:{k,seq,p}, cur:{[pool]:{round,i}}, opts:{hard:boolean,tone:0|1|2}, stat:[…], log:[[playerIdx,pool,id]…]}`;
  статистика игрока `{d:[4],s:[4],dh,sh,c:[truth,dare],l:[easy,medium,hard],ms,rd,rt:[typeIdx|-1,n],re}` (`d`/`s` — по порядку `TOD_POOLS`; `dh`/`sh` — выполнено/пропущено жёстких карточек любого типа; `c` — выборы типа; `l` — выборы уровня «Действия»; `ms` — максимум пропусков подряд; `rd` — выполнено после 2 и более пропусков подряд; `rt`/`re` — серии для событий).
  `todStart({players, opts, gid}) -> state` (`phase:'choose'`, `turn:0`, `seq:0`, `ev:{k:'turn_start',seq:0,p:0}`);
  `todApply(state, action, ctx) -> {ok:boolean, state, reason?}`, где `action` — `{t:'choose',type,seq}` | `{t:'level',diff,seq}` | `{t:'done',seq}` | `{t:'skip',seq}` | `{t:'end',seq}`, `ctx = {deck, level(id)->'easy'|'medium'|'hard'|null}`; несовпадение `action.seq` с `state.seq`, неверная фаза, пустой пул (`reason:'empty'`) -> `ok:false` и исходное состояние;
  `todSanitize(raw, deck) -> state|null` (проверяет все поля из приведённой формы: `turn` внутри `pl`, `pl` от 2 до 10 с очищенными именами ≤25, курсоры `i` в пределах `0..длина пула`, `round` 0..9999, числа статистики ≥0 и ≤9999, `log` ≤30; непоправимое -> `null`);
  `todStStr(state) -> string` (JSON; если длиннее 20000, укорачивает `log`; бросает ошибку, если всё равно длиннее).
  События (`ev.k`, `ev.p` — игрок, о котором реплика): `choose`: `deck_cycle` > `same_type_streak` (когда `rt[1]===3`) > `chose_truth|chose_dare`; `level`: `deck_cycle` > `easy_only` (когда `re===3`) > `level_<diff>`; `done`: `redeem` (был `streak>=1`) > `done_hard` (`card.lv==='hard'`) > `done`; `skip`: `skip_hard` (карточка жёсткая) иначе `skip_1|skip_2|skip_3` по `min(streak,3)`; `end`: `game_end`. Событие `turn_start` бывает только у начального состояния.
  Уровень карточки `card.lv`: для «Действия» берётся из пула, для «Правды» — `ctx.level(id)`, при `null` — `'easy'`. После `done` и `skip` поля `type`, `diff`, `card` сбрасываются в `''`, `''`, `null`.
  Пропуск: `streak+1`, `s[pool]+1`, `sh+1` для жёсткой, `ms=max(ms,streak)`, запись в `log`, `phase='choose'`, `turn` не меняется, `card=null`. Выполнено: `d[pool]+1`, `dh+1` для жёсткой, `rd+1` если `streak>=2`, `turn=(turn+1)%n`, `streak=0`, `phase='choose'`.

- [ ] **Step 1: Написать `tests/unit/tod-engine.test.js` (падает)**

Через `loadTod(['tod/deck.js','tod/engine.js'], [...])`, колода из 30 карточек (по 5 на `truth` и каждый уровень `dare`, у «правды» уровни разные).
```js
T('старт: phase choose, turn 0, seq 0, у каждого игрока нулевая статистика', ...);
T('choose truth -> phase card, card.pool truth, seq 1', ...);
T('choose dare -> phase level, карточки ещё нет', ...);
T('level hard при пустом пуле -> ok:false reason empty, состояние то же', ...);
T('done: ход переходит, streak 0, d[...] +1', ...);
T('skip: turn прежний, phase choose, streak 1, s[...] +1, запись в log', ...);
T('три skip подряд: ms===3, события skip_1, skip_2, skip_3', ...);
T('skip жёсткой карточки -> skip_hard и sh+1', ...);
T('done после 2 пропусков: rd===1, событие redeem; после 1 пропуска rd===0, но событие redeem', ...);
T('seq: действие с устаревшим seq отклонено; два подряд одинаковых done с одним seq — применится одно', ...);
T('неверная фаза (done в phase choose) отклонена', ...);
T('круг колоды: после исчерпания пула событие deck_cycle', ...);
T('3 выбора «правда» подряд одним игроком -> same_type_streak на третьем', ...);
T('3 уровня easy подряд -> easy_only', ...);
T('end: phase ended, событие game_end, дальше любые действия отклонены', ...);
T('todStStr для 10 игроков и 30 пропусков < 4000 знаков', ...);
T('todSanitize: валидное состояние проходит без изменений (глубокое равенство)', ...);
T('todSanitize: turn=99, i=1e9, pl из 1 игрока, phase "x", строки вместо чисел, имя 500 знаков -> null или исправлено в допустимое', ...);
T('todSanitize не падает на null, числах, массивах, циклах JSON', ...);
```

- [ ] **Step 2: Запустить, убедиться, что падает**

Run: `node tests/unit/tod-engine.test.js`
Expected: FAIL / нет модуля.

- [ ] **Step 3: Реализовать `engine.js`; прогнать**

Функции чистые: `todApply` не мутирует входное состояние.

Run: `node tests/unit/tod-engine.test.js`
Expected: все `PASS`. Добавить в `UNIT`.

- [ ] **Step 4: Commit**

```bash
git add src/tod/engine.js tests && git commit -m "Режим «Правда чи дія»: рушій гри (стан, пропуски, події, санітизація)"
```

### Task 8: Выбор реплики и титулы

**Files:**
- Create: `src/tod/talk.js`, `src/tod/titles.js`, `tests/unit/tod-talk-titles.test.js`
- Modify: `tests/run-all.js`

**Interfaces:**
- Consumes: `TOD_BANTER`, `TOD_TITLES` (Task 6), `todHash` (Task 5), форма состояния (Task 7).
- Produces:
  `todExpand(template: string, player: {name, gender}) -> string` — за один проход заменяет `{name}` на имя и `{a|b}` на форму по полу; подставленное имя повторно не разбирается;
  `todPickBanter(state, lines) -> string` — `''` при `opts.tone===0`; кандидаты: строки `lines` с `ev === state.ev.k` и нужным тоном (`tone 2` -> строки тона 2, а если их нет — тона 1); индекс `todHash(state.gid+':'+state.ev.seq+':'+state.ev.k) % N`; игрок — `state.pl[state.ev.p]`;
  `todTitles(state, titles) -> {shame:[{p,id}], cheer:[{p,id}], clean:boolean, rank:[{p,done,skips,hard}]}`; `rank` по убыванию выполненного, затем по возрастанию пропусков, затем по порядку игрока.

Правила титулов (все суммы — по `stat`): `coward` — игрок с наибольшим числом пропусков, не меньше 2, единственный holder (ничья -> первый по `pl`); `deserter` — `ms>=3`; `hard_fold` — `sh>0`; `later` — пропусков больше, чем выполненного, и всего карточек не меньше 3; `easy_life` — выборов уровня не меньше 4 и доля `easy` >= 0.8; `afraid_dare` — `c[1]===0` и `c[0]+c[1]>=4`; `careful` — `opts.hard` и `l[2]===0` и `c[1]>=4`; `hero` — больше всех `dh` (>0); `fearless` — ноль пропусков и выполнено не меньше 5; `redeemed` — `rd>0`; `dare_master` — больше всех выполненных «Действий» (>0); `honest` — больше всех выполненных «Правд» (>0). Титулы с «больше всех» достаются одному игроку (ничья -> первый по `pl`). Игроку присваивается не более двух титулов, по порядку таблицы. `clean` — ни одного пропуска у всех.

- [ ] **Step 1: Написать тесты (падают)**

```js
T('todExpand: {name} и {a|b} по полу guy/girl', todExpand('{name} {сам|сама} виноват{|а}', {name:'Макс',gender:'guy'}) ...);
T('имя с {a|b}, {name} и <b> не раскрывается повторно, выводится как есть', ...);
T('todPickBanter: одинаков при одинаковых gid/seq/ev, на любом «устройстве»', ...);
T('tone 0 -> пустая строка; tone 2 без строк тона 2 для события -> строка тона 1', ...);
T('нет строк для события -> пустая строка, без исключения', ...);
T('todTitles: трое игроков, сценарий с тремя пропусками подряд у первого -> coward и deserter', ...);
T('ничья по пропускам -> coward у игрока с меньшим индексом', ...);
T('не более двух титулов на игрока', ...);
T('пустая статистика (конец сразу): clean:true, shame и cheer пусты, rank без NaN', ...);
T('два игрока, по одному ходу: titles не падают, доли считаются без деления на 0', ...);
T('rank упорядочен: больше выполнено выше, при равенстве меньше пропусков', ...);
```

- [ ] **Step 2: Запустить, убедиться, что падает**

Run: `node tests/unit/tod-talk-titles.test.js`
Expected: FAIL / нет модулей.

- [ ] **Step 3: Реализовать `talk.js`, `titles.js`; прогнать**

Run: `node tests/unit/tod-talk-titles.test.js`
Expected: все `PASS`. Добавить в `UNIT`.

- [ ] **Step 4: Commit**

```bash
git add src/tod tests && git commit -m "Режим «Правда чи дія»: вибір підколки та титули «Залу ганьби»"
```

### Task 9: Лобби, карточка режима и запуск

**Files:**
- Modify: `src/tod/screens.jsx` (добавить `TodLobby`), `src/app.jsx`, `src/styles.css`, `tests/run-all.js`
- Create: `tests/ui/tod-lobby.test.js`

**Interfaces:**
- Consumes: `todBuildDeck`, `todStart`, `todActive` (Tasks 3, 5, 7), `ui` (Task 4).
- Produces: `TodLobby({ ui, players, cfg:{hard,tone}, setCfg, deviceCount, block: string, onStart, onShare, onBack })`; экраны `tod_lobby` (`#/tod`, заголовок «Правда или действие — ASK ME»), `tod_play` (`#/tod/play`, «Игра — Правда или действие — ASK ME»), `tod_results` (`#/tod/results`, «Итоги — Правда или действие — ASK ME»); в `app.jsx` состояния `todCfg` (`{hard:false,tone:1}`), `todGame` (состояние `st`), `todDeck`, функция `todBegin()` (строит колоду с `seed` из `crypto.getRandomValues`, `gid` вида `t<время>` + случайные знаки, ставит состояние, `navigate('tod_play')`).
- Тон выбирается сегментом `seg` из кнопок «Выкл», «Мягкий», «Острый» с `aria-pressed`. Переход на `tod_play`/`tod_results` без состояния игры (`todGame === null`), в том числе по адресу после перезагрузки, ведёт на главную (`replaceState` на `#/`).
- Карточка на `mode_select`: `opt-card` «Правда или действие» (значок 🎲, подпись «Для компании и пар: правда, действие и позор за пропуск. 18+»), между «Усложнённым» и блоком владельца.

- [ ] **Step 1: Написать `tests/ui/tod-lobby.test.js` (падает)**

Обычная сессия «Макс», «Аня», база без `tod` (откат на стартовый набор):
```js
T('на экране режимов есть карточка «Правда или действие»', ...);
T('лобби: адрес #/tod, заголовок, оба игрока в списке', ...);
T('по умолчанию тон «Мягкий» выбран (aria-pressed), «Жёсткие 18+» выключены', ...);
T('«Начать игру» без предупреждения запускает игру: #/tod/play', ...);
T('включены «Жёсткие 18+» -> перед стартом предупреждение 18+; «Назад» остаёмся в лобби', ...);
T('тон «Острый» -> то же предупреждение; подтверждение запускает игру', ...);
T('в базе только «Правда» (нет «Действия») -> старт заблокирован, видна причина', ...);
T('в сессии 1 игрок -> старт заблокирован, видна причина «минимум два игрока»', ...);
T('кнопка «Поделиться сессией» открывает экран приглашения, «Назад» возвращает в лобби', ...);
```
Для блокировок подмените `fetch` ответом `/tod.json` (в базе только карточки одного типа).

- [ ] **Step 2: Запустить, убедиться, что падает**

Run: `node tests/ui/tod-lobby.test.js`
Expected: FAIL (нет карточки режима).

- [ ] **Step 3: Реализовать `TodLobby` и подключить в `app.jsx`**

Тексты предупреждения 18+ — точно по спеке (раздел 10). Причины блокировки показываются под кнопкой (`ui-error`/`ui-hint`), как `startBlock` в `menu`. Защита от гонки: кнопка отключается на время `todBegin`.

- [ ] **Step 4: Прогнать, зарегистрировать**

Run: `node tests/ui/tod-lobby.test.js && node tests/ui/modes.test.js`
Expected: все `PASS`, `captured runtime errors: 0`. Добавить `['tod-lobby',{}]` в `UI`.

- [ ] **Step 5: Commit**

```bash
git add src tests && git commit -m "Режим «Правда чи дія»: лобі, картка режиму та запуск гри"
```

### Task 10: Игровой экран

**Files:**
- Modify: `src/tod/screens.jsx` (добавить `TodGame`), `src/app.jsx`, `src/styles.css`, `tests/run-all.js`
- Create: `tests/ui/tod-game.test.js`

**Interfaces:**
- Consumes: `todApply`, `todPickBanter`, `TOD_BANTER` (Tasks 7, 8, 6), `ui`.
- Produces: `TodGame({ ui, state, cardText(id)->string|null, levelAvail:{easy,medium,hard}, onAction(action), onEnd, onLeave })` — действия отдаются без `seq`, `seq` подставляет вызывающий (`state.seq`).
- Produces (`app.jsx`): `todDispatch(action)` — гасит нажатия, повторенные раньше `LIVE_TAP_GUARD_MS` после принятого; считает `ctx` (`deck: todDeck`, `level: id => <уровень из todCards>`); применяет `todApply`, при `ok` сохраняет состояние в `todGame`. Доступность уровней — по `todNext(deck, cur, 'dare.<lvl>') !== null`.
- Produces (`styles.css`): `.tod-flip` (контейнер с `perspective`, внутренняя часть поворачивается `rotateY` с `backface-visibility: hidden`), `.tod-banter` (появление `opacity` + `transform`), кнопки уровня с классами `tod-lvl-*` из Task 4. При `prefers-reduced-motion` переворот заменён сменой `opacity`.

Экран: заголовок «Ход игрока: <Имя>»; у каждого игрока в полоске счётчик «🐔 N» (сумма `s`), у игрока в очереди — выделение; фаза `choose` — две большие кнопки «Правда» и «Действие»; `level` — «Легко», «Средне», «Жёстко» (🟢 🟡 🔴 и подпись; недоступный уровень отключён с подписью «пока пусто»); `card` — карточка с переворотом, под ней реплика (`<p class="tod-banter">`, нет при `tone 0` и при пустой реплике), главная кнопка «Выполнено — передать ход» (для «Правды» «Ответил(а) — передать ход») и вторичная «Пропустить»; Кнопка «Завершить» в шапке (`btn-sm`) открывает окно «Завершить игру?» с кнопками «Завершить для всех» (`btn-danger`), «Выйти, остальные продолжат» и «Отмена». Если текста карточки нет у устройства — показывается «Карточка недоступна», кнопки работают.

- [ ] **Step 1: Написать `tests/ui/tod-game.test.js` (падает)**

Одно устройство, «Макс» и «Аня», старт из лобби с тоном «Мягкий»:
```js
T('экран хода: «Ход игрока: Макс», две кнопки выбора', ...);
T('«Правда» -> карточка с текстом из набора, видны «Ответил(а) — передать ход» и «Пропустить»', ...);
T('реплика под карточкой есть при «Мягкий» и отсутствует при «Выкл»', ...);
T('«Пропустить»: снова «Ход игрока: Макс», счётчик «🐔 1», фаза выбора', ...);
T('второй пропуск: «🐔 2»; затем выполнение -> «Ход игрока: Аня», счётчик Макса остался', ...);
T('«Действие» -> три уровня; при выключенных «Жёстких» «Жёстко» недоступно с подписью «пока пусто»', ...);
T('два быстрых нажатия «Ответил(а)» (в пределах 500 мс) -> ход передан один раз', ...);
T('«Завершить» просит подтверждения; «Отмена» возвращает в игру; «Завершить для всех» открывает итоги (#/tod/results)', ...);
T('«Выйти, остальные продолжат» ведёт на главную, партия остаётся незавершённой', ...);
T('карточка отсутствует у устройства: «Карточка недоступна», «Пропустить» работает, ошибок в консоли нет', ...);
T('имя игрока со скобками {name} и <b> показано как есть в заголовке и реплике', ...);
T('круглые счётчики и кнопки не меньше 44 px (style/класс) — проверка по классам btn-*', ...);
```

- [ ] **Step 2: Запустить, убедиться, что падает**

Run: `node tests/ui/tod-game.test.js`
Expected: FAIL.

- [ ] **Step 3: Реализовать `TodGame`, `todDispatch`, CSS; прогнать**

Run: `node tests/ui/tod-game.test.js`
Expected: все `PASS`, `captured runtime errors: 0`. Добавить `['tod-game',{}]` в `UI`.

- [ ] **Step 4: Commit**

```bash
git add src tests && git commit -m "Режим «Правда чи дія»: ігровий екран, пропуск з підколками, перевертання картки"
```

### Task 11: Экран итогов и ворота этапа 2

**Files:**
- Modify: `src/tod/screens.jsx` (добавить `TodResults`), `src/app.jsx`, `src/styles.css`, `tests/run-all.js`
- Create: `tests/ui/tod-results.test.js`

**Interfaces:**
- Consumes: `todTitles`, `TOD_TITLES`, `todExpand` (Tasks 8, 6).
- Produces: `TodResults({ ui, state, titles, onAgain, onMenu })`; «Зал позора» (позорные титулы крупнее, идут первыми), либо «Сегодня без позора», добрые титулы, таблица «Игрок — ✔ — 🐔 — жёстких»; кнопки «Сыграть ещё» (в лобби с теми же настройками) и «В меню».

- [ ] **Step 1: Написать `tests/ui/tod-results.test.js` (падает)**

```js
T('три пропуска подряд у Макса -> «Серийный дезертир» и «Главный трус вечера» в «Зале позора»', ...);
T('позорные титулы стоят выше добрых', ...);
T('таблица: у Макса 🐔 3, у Ани 🐔 0, числа сходятся с игрой', ...);
T('конец игры сразу: «Сегодня без позора», в тексте нет NaN и undefined', !/NaN|undefined/.test(txt));
T('«Сыграть ещё» ведёт в лобби с прежними настройками (тон, жёсткие)', ...);
T('«В меню» открывает главную', ...);
T('перезагрузка адреса #/tod/results без игры -> главная (состояния нет)', ...);
```

- [ ] **Step 2: Запустить, убедиться, что падает**

Run: `node tests/ui/tod-results.test.js`
Expected: FAIL.

- [ ] **Step 3: Реализовать `TodResults`, подключить, прогнать**

Run: `node tests/ui/tod-results.test.js`
Expected: все `PASS`. Добавить `['tod-results',{}]` в `UI`.

- [ ] **Step 4: Commit и ворота этапа 2**

```bash
git add src tests && git commit -m "Режим «Правда чи дія»: підсумки та «Зал ганьби»"
npm run verify
```
Expected: `verify` зелёный (вес первой загрузки в лимите). Обновить `claude/design-system.md` (Projects) всеми классами и токенами из Tasks 9–11. `git push`, показать владельцу `src/content/tod-banter.js` на чтение; его замечания учесть до слияния PR.

---

## Этап 3. Игра на нескольких устройствах

### Task 12: Канал `_t`

**Files:**
- Create: `src/tod/channel.js`, `tests/unit/tod-channel.test.js`
- Modify: `tests/fake-rtdb.js` (если нужно), `tests/run-all.js`

**Interfaces:**
- Consumes: `todParseDeck`, `todDeckStr` (Task 5), `todSanitize`, `todStStr` (Task 7).
- Produces: `todRoomOf(roomId) -> roomId + '_t'`;
  `todChannel(deps) -> api`, где `deps = {baseUrl, fetch(url, opts, ms), deviceId, now(), verNext(prev, id), verStart(id, now), alive(p, now, selfId)}`, а `api`:
  `start(room, {deck, state}) -> Promise<{ver}>` — `PUT` всего узла: `{ver: verStart(...), by, t, status:'active', ids: todDeckStr(deck), st: todStStr(state), p:{[deviceId]: now()}}` (перезаписывает прошлую партию);
  `readVer(room) -> Promise<number|null>` — `GET <room>/ver` (дешёвый опрос раз в секунду);
  `read(room, {deck: boolean}) -> Promise<null|{ver, status, deck, state, p}>` — `GET`; колода (`ids`) читается только при `deck:true` (при входе и возврате), состояние — всегда; строки разбираются `todParseDeck`/`todSanitize`; порча -> `deck`/`state` равны `null`, исключения нет;
  `send(room, state, prevVer) -> Promise<{ok, ver}>` — `PATCH {ver: verNext(prevVer, deviceId), by, t, st}`;
  `end(room, state, prevVer)` — как `send` плюс `status:'ended'`;
  `beat(room)` — `PATCH {'p/<deviceId>': now()}`; `leave(room)` — `DELETE p/<deviceId>`;
  `peek(room) -> Promise<{status, others:number, p}>` — `GET status` и `p`, `others` по `alive`.

- [ ] **Step 1: Написать `tests/unit/tod-channel.test.js` (падает)**

На `makeDb()` с `db.attach`-совместимым `fetch` (через `db.handle`), реальные `liveVerNext`, `liveVerStart`, `liveAlive` скопировать из `app.jsx` через `tests/src-loader.js` (как в `live-logic.test.js`).
```js
T('start пишет узел <room>_t, правила live не отклонили (stats.denied===0)', ...);
T('колода максимального размера (480 id по 16 знаков) проходит правило ids <= 12000', ...);
T('слишком большая колода -> ошибка до отправки, запись не произошла', ...);
T('read(room,{deck:true}) возвращает разобранные deck и state, p; без deck поле deck пусто и ids не запрашивалось (stats.gets)', ...);
T('readVer возвращает число ver и null для пустой комнаты', ...);
T('send увеличивает ver монотонно; у двух устройств версии не совпадают', ...);
T('испорченные ids/st (не JSON, неверные типы, индексы за пределами) -> read даёт null для испорченной части, не бросает', ...);
T('beat/leave меняют только свою отметку', ...);
T('peek: others считает живые устройства кроме своего, мёртвые (старше 30 с) не считает', ...);
T('end ставит status ended', ...);
T('db.room() не возвращает узел _t, db.todRoom() возвращает', ...);
```

- [ ] **Step 2: Запустить, убедиться, что падает**

Run: `node tests/unit/tod-channel.test.js`
Expected: FAIL / нет модуля.

- [ ] **Step 3: Реализовать `channel.js`; прогнать**

Run: `node tests/unit/tod-channel.test.js`
Expected: все `PASS`. Добавить в `UNIT`.

- [ ] **Step 4: Commit**

```bash
git add src/tod/channel.js tests && git commit -m "Режим «Правда чи дія»: канал синхронізації _t"
```

### Task 13: Игра на нескольких устройствах и подключение

**Files:**
- Modify: `src/app.jsx`, `tests/run-all.js`
- Create: `tests/ui/tod-live.test.js`

**Interfaces:**
- Consumes: `todChannel`, `todRoomOf` (Task 12), `todDispatch`, `todBegin`, `TodLobby` (Tasks 9–10), `deviceCap`, `liveAlive`, `liveRoomId`, `LIVE_POLL_MS`, `LIVE_BEAT_MS`, `LIVE_INVITE_MS`, `LIVE_TAP_GUARD_MS`; образец опроса приглашения классической игры (`useEffect` с `roomUrl(liveRoomId, '/status')`).
- Produces (`app.jsx`): `todChannelApi`; ведущий в `todBegin` вызывает `start`; пока открыт `tod_lobby`/`tod_play`/`tod_results`, раз в `LIVE_POLL_MS` читается `readVer`, при новой `ver` — `read(room,{deck:false})`; полученное состояние принимается, если оно прошло `todSanitize` и его `seq` больше своего (при равном `seq` — если больше `ver`); раз в `LIVE_BEAT_MS` — `beat`; `todDispatch` после принятого действия вызывает `send`, при сбое — тост «Не удалось отправить ход», состояние выправит опрос; «Завершить для всех» вызывает `end`, остальные устройства при `status:'ended'` открывают итоги; «Выйти, остальные продолжат» вызывает `leave` и открывает главную.
  Баннер `todInviteBanner` («Идёт игра «Правда или действие» — присоединиться», оформление как `liveInviteBanner`) на `menu`, `mode_select`, `tod_lobby`, `tod_results` по `peek` (`status==='active'` и `others>0`), опрос раз в `LIVE_INVITE_MS`. `todJoin()` читает узел с колодой, проверяет `deviceCap(profile, {pl: JSON.stringify(state.pl)})` (при превышении то же сообщение, что в классической игре), при `opts.hard` или `opts.tone===2` показывает предупреждение 18+ с кнопкой «Понятно», затем принимает колоду и состояние, делает `beat`, `navigate('tod_play')`. В лобби `deviceCount` берётся из `peek`.
  Если текста карточки нет в `todCards`, делается точечный запрос `${FIREBASE_BASE_URL}/tod/<id>.json`, результат (через `todCleanCard`) кладётся в `todExtraCards`; до ответа — «Загружаем карточку…», при отсутствии — «Карточка недоступна».

- [ ] **Step 1: Написать `tests/ui/tod-live.test.js` (падает)**

`boot(2, null, {players: 2})` из `live-helpers.js`. A: «Начать игру» -> «Правда или действие» -> «Начать игру»; B: ждёт баннер на главной и нажимает «присоединиться» (вход занимает несколько секунд, ждать через `waitFor`).
```js
T('A запускает игру: у B появился баннер, B присоединяется, оба видят «Ход игрока: Макс»', ...);
T('A выбирает «Правда»: у B тот же текст карточки', textOfCard(A) === textOfCard(B));
T('B нажимает «Ответил(а)»: у A ход перешёл к Ане', ...);
T('одновременные нажатия (tap(A,…) и tap(B,…) без ожидания) на «Ответил(а)»: ход ушёл ровно на одного игрока, на обоих экранах один и тот же игрок', ...);
T('пропуск на A виден на B: «🐔 1», тот же игрок «Ход игрока: …»', ...);
T('реплика под карточкой одинакова на обоих устройствах', banter(A) === banter(B));
T('карточка, которой нет у B в todCards, подгружается точечным запросом (stats.gets содержит tod/<id>)', ...);
T('«Выйти, остальные продолжат» на B не прерывает игру A, в p остаётся только отметка A', ...);
T('«Завершить для всех» на A: у B открылись итоги с теми же числами', ...);
T('третье устройство сверх числа игроков не пускают, видно сообщение про число устройств', ...);
T('предупреждение 18+ при входе в игру с тоном «Острый»: до «Понятно» экран игры не открыт', ...);
T('db.stats.denied === 0 на всём протяжении', ...);
```

- [ ] **Step 2: Запустить, убедиться, что падает**

Run: `node tests/ui/tod-live.test.js`
Expected: FAIL.

- [ ] **Step 3: Реализовать синхронизацию, подключение и баннер; прогнать**

Run: `node tests/ui/tod-live.test.js && FLOW=player node tests/ui/menu.test.js && node tests/ui/live.test.js`
Expected: все `PASS`, `captured runtime errors: 0` на всех устройствах, классическая живая игра не сломана. Добавить `['tod-live',{}]` в `UI`.

- [ ] **Step 4: Commit**

```bash
git add src tests && git commit -m "Режим «Правда чи дія»: гра на кількох пристроях, запрошення та приєднання"
```

### Task 14: Перезагрузка, защита обновления, классическая игра

**Files:**
- Modify: `src/app.jsx`, `src/update.js`, `tests/unit/update.test.js`, `tests/run-all.js`
- Create: `tests/ui/tod-resume.test.js`

**Interfaces:**
- Consumes: `todChannelApi`, `todJoin` (Task 13), `resumeGuardRef`, `handleResumeSavedGame` (образец), `liveAlive`, `roomUrl`.
- Produces: возврат после перезагрузки на любом `#/tod…`: приложение ждёт профиль и `liveRoomId`, читает `_t` (`read(room,{deck:true})`): `active` -> игра (с `beat`, без предупреждения 18+), `ended` -> итоги, пусто/испорчено/нет профиля -> главная с `replaceState` на `#/`; блокировка старта в лобби, пока классическая комната сессии активна и жива (`GET live/<room>/status === 'active'` и `liveAlive(p).alive.length > 0`), текст «В сессии идёт классическая игра — завершите её»; `inGameHash` в `src/update.js` защищает все адреса `#/tod…`.

- [ ] **Step 1: Написать тесты (падают)**

`tests/unit/update.test.js`: `inGameHash('#/tod')`, `'#/tod/play'`, `'#/tod/results'`, `'#/tod/manage'`, `'#/tod?x=1'` -> `true`; `'#/todo'`, `'#/topics'` -> `false`.
`tests/ui/tod-resume.test.js` (`boot(2)`):
```js
T('A перезагрузил страницу посреди хода на #/tod/play: та же карточка, тот же игрок; следующая выдача — по порядку колоды, а не повтор', ...);
T('перезагрузка не показывает предупреждение 18+ повторно', ...);
T('перезагрузка на #/tod/results после завершения: итоги те же', ...);
T('перезагрузка на #/tod/play, когда в узле нет игры или он испорчен: главная, адрес заменён на #/', location.hash === '#/' ...);
T('перезагрузка без профиля сессии на #/tod/play -> экран без сессии, без ошибок', ...);
T('классическая игра идёт на B: в лобби A старт заблокирован с текстом про классическую игру; после её завершения старт доступен', ...);
T('новая партия («Сыграть ещё» на A): у B на экране итогов появился баннер присоединения', ...);
```

- [ ] **Step 2: Запустить, убедиться, что падают**

Run: `node tests/unit/update.test.js; node tests/ui/tod-resume.test.js`
Expected: FAIL.

- [ ] **Step 3: Реализовать; прогнать всё затронутое**

Run: `node tests/unit/update.test.js && node tests/ui/tod-resume.test.js && node tests/ui/tod-live.test.js && node tests/ui/resume-guard.test.js && node tests/ui/game-resume.test.js && node tests/ui/live-invite.test.js`
Expected: все `PASS` (классические проверки возврата и приглашения не сломаны). Добавить `['tod-resume',{}]` в `UI`.

- [ ] **Step 4: Commit**

```bash
git add src tests && git commit -m "Режим «Правда чи дія»: повернення після перезавантаження, захист оновлення, блок під час класичної гри"
```

### Task 15: Тексты, README, дизайн-система

**Files:**
- Modify: `src/content/legal.js`, `src/content/about.js`, `README.md`, `tests/unit/content.test.js` (только если нужны проверки новых полей)

**Interfaces:** без новых экспортов.

- [ ] **Step 1: Проверить, что тесты содержимого сейчас зелёные**

Run: `node tests/unit/content.test.js && node tests/ui/about-legal.test.js`
Expected: все `PASS`.

- [ ] **Step 2: Тексты**

`legal.js`: в раздел «Игра на нескольких устройствах» (политика конфиденциальности) добавить абзац о режиме: в узел `_t` записываются имена и пометки игроков, выбор «правда/действие» и уровни, число и типы пропусков и выполненного, id карточек; узел не шифруется; данные остаются, пока в сессии не начнётся новая игра этого режима (формулировку согласовать с абзацами о классической комнате). В документ «Возраст 18+» добавить раздел «Режим «Правда или действие»»: жёсткие карточки откровенные, острый тон содержит вульгарность, чёрный юмор и политическую сатиру, включаются осознанно, играть только с теми, кому комфортно. `about.js`: новая возможность `{ id:'tod', group:'play', icon:'🎲', title:'Правда или действие', short, more }` (в `more` — пропуск, «Зал позора», 18+). Даты `updated`/`updatedHuman` обновить на сегодняшнюю (формат по тестам).

- [ ] **Step 3: README**

Раздел «Правда или действие»: файлы и их роли, схема `tod/<id>`, копия правил `tests/fixtures/tod-rules.json` и порядок публикации (сначала правило в консоли, затем приложение), формат канала `_t`, известные ограничения (нет очистки старых узлов, лимит `st` проверяется только клиентом, два режима одновременно), как добавить реплику и карточку, а также заметки для магазинов: возрастная метка (17+/18+; анкеты Apple и IARC/Google Play заполнять честно: вульгарность, откровенные темы, политическая сатира), правила Apple 1.1 и политики Google Play о чувствительных событиях и разжигании ненависти.

- [ ] **Step 4: Дизайн-система**

В `claude/design-system.md` (Projects) убедиться, что есть все новые токены и классы (`--tod-*`, `tod-lvl-*`, `.tod-flip`, `.tod-banter` и остальные из Tasks 9–11), с назначением и запретами (анимируем только `transform`/`opacity`).

- [ ] **Step 5: Прогнать и закоммитить**

Run: `node tests/unit/content.test.js && node tests/ui/about-legal.test.js`
Expected: все `PASS`.
```bash
git add src README.md && git commit -m "Режим «Правда чи дія»: правові тексти, «Про гру», README"
```

### Task 16: Проверка в реальном браузере

**Files:**
- Create (вне репозитория): `/tmp/claude-0/-home-claude/b3f64f9c-91fb-58c5-bebd-2236eb43c12e/scratchpad/tod-visual.mjs`

- [ ] **Step 1: Собрать и запустить предпросмотр**

Run: `npm run build && npx vite preview --port 4173 --host 127.0.0.1`
Expected: страница отвечает на `http://127.0.0.1:4173/love-game/` (проверить `base` в `vite.config.js`).

- [ ] **Step 2: Скрипт Playwright**

Скрипт проходит путь: создать сессию -> режимы -> лобби -> старт -> «Правда» -> «Пропустить» -> «Действие» -> уровень -> «Выполнено» -> «Завершить» -> итоги, на ширинах 320, 360, 390, 430 и 1280 px, при `prefers-reduced-motion: reduce` и без него. В каждом состоянии проверяет: нет горизонтальной прокрутки (`scrollWidth <= clientWidth`), все `button` не ниже 44 px, текст не мельче 13 px, карточка при reduced-motion читается; сохраняет скриншоты.

- [ ] **Step 3: Прочитать скриншоты, исправить найденное**

Каждую найденную проблему (переносы длинных русских строк, обрезанные кнопки, перекрытие реплики) исправить отдельным коммитом с тестом, если проблему можно поймать в jsdom.

- [ ] **Step 4: Итоговый прогон**

Run: `npm run verify`
Expected: все наборы зелёные, «Проверка веса пройдена ✔».

### Task 17: Публикация (ворота владельца)

**Files:** изменений в репозитории нет, если не найдено расхождений.

- [ ] **Step 1: Правила `tod` — только после явного «да» владельца**

Прочитать боевые правила (владелец входит в Firebase; чтение: `npx --offline firebase-tools database:get /.settings/rules --instance project-x-5e16a-default-rtdb`), добавить узел `tod` из `tests/fixtures/tod-rules.json` с настоящим идентификатором владельца вместо `OWNER_UID`, остальное оставить как есть. Локальный `database.rules.json` основой не брать: он может отличаться от боевого (например, лимитом `sessions`). Результат отдать владельцу для вставки в консоль Firebase (как принято в проекте) вместе с необязательным усилением `live/$room/st` (длина не больше 20000), которое делается только по его отдельному «да». Правило публикуется до слияния PR (как в README для `sessions`: сначала правило, потом приложение).

- [ ] **Step 2: Проверка правил после публикации**

`GET /tod.json` без входа даёт 200; `PUT /tod/td_probe.json` анонимным токеном даёт 401 (REST с анонимным входом); запись владельцем проходит.

- [ ] **Step 3: Слияние**

Дождаться зелёного CI на PR, убедиться, что владелец одобрил файлы содержимого (Task 4, Task 11), слить PR, дождаться публикации на GitHub Pages.

- [ ] **Step 4: Наполнение базы**

Владелец в админке нажимает «Загрузить стартовый набор» и проверяет, что карточки видны во вкладках «Правда»/«Действие» на втором устройстве; проходит партию на двух устройствах.

- [ ] **Step 5: Закрыть**

Обновить статус спеки на «реализована», записать итог в проектные заметки (Projects), выйти из Firebase (`firebase_logout`), если входили.
