// Промпти для ШІ-підказок ASK ME. Спільні для воркера (worker/ai-proxy) і запасного шляху в браузері (src/ai/client.js):
// сервер приймає лише структуровані поля (тип, мова, питання, тема), а не довільний промпт — так проксі не можна
// використати як безкоштовний чат-бот для чужих задач.

export const AI_TYPES = ['situation', 'advice', 'translate', 'question'];
export const AI_LANGS = ['uk', 'en', 'ru'];

// ракурси для унікальності: кожен запит отримує випадковий, тож однакове питання дає різні відповіді
const AI_ANGLES = {
  uk: ['пізній вечір удома', 'дорога в машині', 'прогулянка після дощу', 'кухня о другій ночі', 'перше побачення', 'річниця стосунків', 'вечір з друзями', 'поїздка за місто', 'тиха неділя', 'черга в аеропорту'],
  en: ['a late evening at home', 'a long car ride', 'a walk after the rain', 'the kitchen at 2 a.m.', 'a first date', 'an anniversary', 'a night out with friends', 'a weekend trip out of town', 'a quiet Sunday', 'a queue at the airport'],
  ru: ['поздний вечер дома', 'дорога в машине', 'прогулка после дождя', 'кухня в два часа ночи', 'первое свидание', 'годовщина отношений', 'вечер с друзьями', 'поездка за город', 'тихое воскресенье', 'очередь в аэропорту'],
};
const aiPick = (arr, rnd) => arr[Math.floor(rnd() * arr.length) % arr.length];

const AI_LANG_RULE = {
  uk: 'Пиши живою природною українською мовою (без кальки з російської), звертайся на «ти» до гравців.',
  en: 'Write in natural, warm, idiomatic English and speak to the players directly as "you".',
  ru: 'Пиши живым естественным русским языком, обращайся к игрокам на «ты».',
};
const AI_SAFE_RULE = {
  uk: 'Тон теплий і грайливий, без вульгарності й моралізаторства. Жодної політики, війни, насильства чи принижень. Відверті теми — делікатно, лише між дорослими за згодою.',
  en: 'Keep the tone warm and playful, never vulgar or preachy. No politics, war, violence or humiliation. Handle intimate topics gently, only between consenting adults.',
  ru: 'Тон тёплый и игривый, без вульгарности и морализаторства. Никакой политики, войны, насилия и унижений. Откровенные темы — деликатно, только между взрослыми по согласию.',
};

// { system, user, maxTokens } для типу запиту; rnd — генератор випадкових чисел (для тестів можна підставити свій)
export const buildPrompt = ({ type, lang, question = '', category = '', players = 2, text = '', to = 'uk' }, rnd = Math.random) => {
  const L = AI_LANGS.includes(lang) ? lang : 'uk';
  if (type === 'translate') {
    if (to === 'en') return { system: 'You are a professional game localizer. Translate the text into natural, idiomatic English (an adaptation, not word for word), addressing the players as "you". Make gendered forms like "(а)" or "(ла)" gender-neutral. Output ONLY the translation, with no explanations or quotes.', user: text, maxTokens: 400 };
    const target = to === 'ru' ? 'російську' : 'українську';
    return { system: `Ти професійний перекладач. Перекладай на ${target}: природно, грамотно, звертання на «ти». Форми роду на кшталт «(а)», «(ла)» передай відповідними формами для обох родів. Виведи ЛИШЕ переклад, без пояснень і лапок.`, user: text, maxTokens: 400 };
  }
  if (type === 'question') {
    if (L === 'en') return { system: 'You write candid conversation games for couples and groups of friends. ' + AI_LANG_RULE.en + ' ' + AI_SAFE_RULE.en, user: `Come up with ONE new question for the game. Topic: "${category}". Depth: "${text}". Output only the question itself, addressed to "you", with no quotes or number.`, maxTokens: 160 };
    return { system: (L === 'uk' ? 'Ти автор відвертих ігор для пар і компаній. ' : 'Ты автор откровенных игр для пар и компаний. ') + AI_LANG_RULE[L] + ' ' + AI_SAFE_RULE[L], user: (L === 'uk' ? `Придумай ОДНЕ нове питання для гри. Тема: «${category}». Глибина: «${text}». Виведи лише текст питання на «ти», без лапок і номера.` : `Придумай ОДИН новый вопрос для игры. Тема: «${category}». Глубина: «${text}». Выведи только текст вопроса на «ты», без кавычек и номера.`), maxTokens: 160 };
  }
  const who = L === 'en' ? (players > 2 ? `a group of ${players} players` : 'a couple') : players > 2 ? (L === 'uk' ? `компанія з ${players} гравців` : `компания из ${players} игроков`) : 'пара';
  const angle = aiPick(AI_ANGLES[L], rnd);
  if (type === 'situation' && L === 'en') {
    const user = `Playing: ${who}. Topic: "${category}". Question: "${question}". Setting this time: ${angle}.\nAnswer in exactly two blocks with exactly these headings:\n\n🎬 Setting the scene:\n(3 sentences in the first person plural "we": a realistic little scene that leads up to the question)\n\n👩👨 How people usually answer:\n(2–3 bullet points with "•": different typical answers and what lies behind them)`;
    return { system: 'You are a screenwriter and relationship psychologist. You write vividly and specifically, without clichés or repetition. ' + AI_LANG_RULE.en + ' ' + AI_SAFE_RULE.en, user, maxTokens: 700 };
  }
  if (type === 'situation') {
    const sys = (L === 'uk' ? 'Ти сценарист і психолог стосунків. Пишеш живо, конкретно, без шаблонів і повторів. ' : 'Ты сценарист и психолог отношений. Пишешь живо, конкретно, без шаблонов и повторов. ') + AI_LANG_RULE[L] + ' ' + AI_SAFE_RULE[L];
    const user = L === 'uk'
      ? `Грають: ${who}. Тема: «${category}». Питання: «${question}». Обстановка цього разу: ${angle}.\nВідповідь рівно з двох блоків, заголовки саме такі:\n\n🎬 Моделювання ситуації:\n(3 речення від першої особи «ми»: реалістична сценка, що підводить до питання)\n\n👩👨 Як зазвичай відповідають:\n(2–3 пункти через «•»: різні типові відповіді й що за ними стоїть)`
      : `Играют: ${who}. Тема: «${category}». Вопрос: «${question}». Обстановка в этот раз: ${angle}.\nОтвет ровно из двух блоков, заголовки именно такие:\n\n🎬 Моделирование ситуации:\n(3 предложения от первого лица «мы»: реалистичная сценка, подводящая к вопросу)\n\n👩👨 Как обычно отвечают:\n(2–3 пункта через «•»: разные типичные ответы и что за ними стоит)`;
    return { system: sys, user, maxTokens: 700 };
  }
  // advice
  if (L === 'en') {
    const user = `Playing: ${who}. Topic: "${category}". Question: "${question}". Context for a fresh angle: ${angle}.\nBreak the question down briefly (up to 170 words) in blocks with these headings:\n\n🧠 How to talk about it:\n💡 Fun fact:\n🔗 How it affects the relationship:\n🛠️ Tip for today:\nDon't make up statistics: if you're not sure about a number, leave it out.`;
    return { system: 'You are a practicing couples therapist. You give specific, caring advice without platitudes. ' + AI_LANG_RULE.en + ' ' + AI_SAFE_RULE.en, user, maxTokens: 700 };
  }
  const sys = (L === 'uk' ? 'Ти практикуючий сімейний психотерапевт. Даєш конкретні, бережні поради без загальних фраз. ' : 'Ты практикующий семейный психотерапевт. Даёшь конкретные, бережные советы без общих фраз. ') + AI_LANG_RULE[L] + ' ' + AI_SAFE_RULE[L];
  const user = L === 'uk'
    ? `Грають: ${who}. Тема: «${category}». Питання: «${question}». Контекст для свіжого погляду: ${angle}.\nРозбери питання коротко (до 170 слів) за блоками з такими заголовками:\n\n🧠 Як краще поговорити про це:\n💡 Цікавий факт:\n🔗 Як це впливає на стосунки:\n🛠️ Порада на сьогодні:\nСтатистику не вигадуй: якщо не впевнений у цифрі — пиши без неї.`
    : `Играют: ${who}. Тема: «${category}». Вопрос: «${question}». Контекст для свежего взгляда: ${angle}.\nРазбери вопрос коротко (до 170 слов) по блокам с такими заголовками:\n\n🧠 Как лучше поговорить об этом:\n💡 Интересный факт:\n🔗 Как это влияет на отношения:\n🛠️ Совет на сегодня:\nСтатистику не выдумывай: если не уверен в цифре — пиши без неё.`;
  return { system: sys, user, maxTokens: 700 };
};

// перевірка й обрізання вхідних полів (однаково в браузері й на сервері); null — запит відхилено
export const cleanAiRequest = (b) => {
  if (!b || typeof b !== 'object') return null;
  const str = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u001F\u007F<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : '');
  const type = AI_TYPES.includes(b.type) ? b.type : null; if (!type) return null;
  const lang = AI_LANGS.includes(b.lang) ? b.lang : 'uk';
  const req = { type, lang, question: str(b.question, 500), category: str(b.category, 60), players: Math.max(2, Math.min(10, Number(b.players) || 2)), text: str(b.text, 500), to: b.to === 'ru' ? 'ru' : b.to === 'en' ? 'en' : 'uk' };
  if ((type === 'situation' || type === 'advice') && !req.question) return null;
  if (type === 'translate' && !req.text) return null;
  return req;
};
