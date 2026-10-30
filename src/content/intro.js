// ============================================================================================
// Знайомство з грою — «сторіс» для нового гравця (перший візит без сесії, не за запрошенням).
// Тут ВЕСЬ текст історій у трьох мовах: uk (за замовчуванням), en, ru. Код міняти не потрібно.
//
// Як правити:
//  • Формулювання — правте рядок у потрібній мові (усі три мови мають бути заповнені).
//  • Порядок і кількість історій задає масив `slides`; `id` пов'язує текст з ілюстрацією в src/intro/stories.jsx
//    (hello, depth, turn, tod, together, start) — нову історію з іншим id без ілюстрації не додавайте.
//  • `ui` — підписи кнопок і підказки для екранних читалок.
// Тест `tests/unit/content.test.js` перевіряє, що всі мови заповнені й в українському тексті немає російських літер.
// ============================================================================================
export const INTRO = {
  version: '1.0',

  ui: {
    uk: { label: 'Знайомство з ASK ME', start: 'Почати', close: 'Закрити', pause: 'Пауза', play: 'Продовжити показ', prev: 'Попередня історія', next: 'Наступна історія', of: 'Історія {v0} з {v1}', hint: 'Торкніться праворуч — далі, ліворуч — назад, утримуйте — пауза', keys: '← → гортати · пробіл — пауза · Esc — закрити', replay: 'Як грати — за 30 секунд' },
    en: { label: 'Meet ASK ME', start: 'Start', close: 'Close', pause: 'Pause', play: 'Resume', prev: 'Previous story', next: 'Next story', of: 'Story {v0} of {v1}', hint: 'Tap right for next, left to go back, hold to pause', keys: '← → browse · space to pause · Esc to close', replay: 'How to play in 30 seconds' },
    ru: { label: 'Знакомство с ASK ME', start: 'Начать', close: 'Закрыть', pause: 'Пауза', play: 'Продолжить показ', prev: 'Предыдущая история', next: 'Следующая история', of: 'История {v0} из {v1}', hint: 'Нажмите справа — дальше, слева — назад, удерживайте — пауза', keys: '← → листать · пробел — пауза · Esc — закрыть', replay: 'Как играть — за 30 секунд' },
  },

  slides: [
    {
      id: 'hello',
      uk: { kicker: 'Гра-ритуал для пар і компаній', title: 'Розмови, яких вам бракувало', text: 'Питання й дії, після яких ви знаєте одне одного трохи краще, ніж учора.' },
      en: { kicker: 'A ritual game for couples and friends', title: 'The talks you’ve been missing', text: 'Questions and dares that leave you knowing each other a little better than yesterday.' },
      ru: { kicker: 'Игра-ритуал для пар и компаний', title: 'Разговоры, которых вам не хватало', text: 'Вопросы и действия, после которых вы знаете друг друга чуть лучше, чем вчера.' },
    },
    {
      id: 'depth',
      uk: { kicker: 'Три глибини', title: 'Від легкого\u00a0— до щирого', text: 'Почніть з усмішки. Гра сама поведе розмову глибше, коли ви будете готові.',
        levels: ['Легкі', 'Середні', 'Глибокі'],
        cards: ['Яка пісня завжди піднімає тобі настрій?', 'Про що ти мрієш, але ще не казав(-ла) вголос?', 'Коли ти вперше відчув(-ла), що тебе справді розуміють?'] },
      en: { kicker: 'Three depths', title: 'From easy to honest', text: 'Start with a smile. The game takes the talk deeper when you’re ready.',
        levels: ['Easy', 'Medium', 'Deep'],
        cards: ['Which song always lifts your mood?', 'What do you dream about but haven’t said out loud yet?', 'When did you first feel truly understood?'] },
      ru: { kicker: 'Три глубины', title: 'От лёгкого\u00a0— к искреннему', text: 'Начните с улыбки. Игра сама поведёт разговор глубже, когда вы будете готовы.',
        levels: ['Лёгкие', 'Средние', 'Глубокие'],
        cards: ['Какая песня всегда поднимает тебе настроение?', 'О чём ты мечтаешь, но ещё не говорил(а) вслух?', 'Когда ты впервые почувствовал(а), что тебя по-настоящему понимают?'] },
    },
    {
      id: 'turn',
      uk: { kicker: 'Черга', title: 'Жереб вирішує, хто відповідає', text: 'Від двох до десяти гравців. Ніхто не відсидиться — і ніхто не говорить за всіх.', names: ['Оля', 'Тарас', 'Соля', 'Марко', 'Іра'], answers: 'Відповідає' },
      en: { kicker: 'Taking turns', title: 'Fate picks who answers', text: 'Two to ten players. Nobody hides in the corner, nobody talks for everyone.', names: ['Kate', 'Max', 'Sol', 'Dan', 'Ira'], answers: 'Answering' },
      ru: { kicker: 'Очередь', title: 'Жребий решает, кто отвечает', text: 'От двух до десяти игроков. Никто не отсидится — и никто не говорит за всех.', names: ['Оля', 'Макс', 'Соня', 'Дима', 'Ира'], answers: 'Отвечает' },
    },
    {
      id: 'tod',
      uk: { kicker: 'Окремий режим', title: 'Правда чи дія?', text: 'Три рівні жару, підколки від гри й титули за пропуски. Для компаній, які не бояться.', truth: 'Правда', dare: 'Дія', card: 'Станцюй 15 секунд під пісню, яку обере сусід ліворуч', chicken: 'пропуск' },
      en: { kicker: 'Bonus mode', title: 'Truth or dare?', text: 'Three heat levels, cheeky banter and titles for every skip. For the brave ones.', truth: 'Truth', dare: 'Dare', card: 'Dance for 15 seconds to a song the person on your left picks', chicken: 'skip' },
      ru: { kicker: 'Отдельный режим', title: 'Правда или действие?', text: 'Три уровня жара, подколки от игры и титулы за пропуски. Для компаний, которые не боятся.', truth: 'Правда', dare: 'Действие', card: 'Станцуй 15 секунд под песню, которую выберет сосед слева', chicken: 'пропуск' },
    },
    {
      id: 'together',
      uk: { kicker: 'Разом і приватно', title: 'Одна гра на всіх телефонах', text: 'Кличте друзів посиланням або QR. Без реєстрації, а відповіді звучать лише вголос — ми їх не збираємо.', chips: ['Без реєстрації', 'Працює офлайн', 'До 10 гравців'] },
      en: { kicker: 'Together, privately', title: 'One game on every phone', text: 'Invite friends with a link or a QR code. No sign-up — answers are spoken out loud, we never collect them.', chips: ['No sign-up', 'Works offline', 'Up to 10 players'] },
      ru: { kicker: 'Вместе и приватно', title: 'Одна игра на всех телефонах', text: 'Зовите друзей ссылкой или QR. Без регистрации, а ответы звучат только вслух — мы их не собираем.', chips: ['Без регистрации', 'Работает офлайн', 'До 10 игроков'] },
    },
    {
      id: 'start',
      uk: { kicker: 'Готові?', title: 'Вечір починається тут', text: 'Впишіть імена — і за пів хвилини перше питання вже на столі.', steps: ['Імена', 'Теми', 'Перше питання'] },
      en: { kicker: 'Ready?', title: 'Your evening starts here', text: 'Add your names, and the first question is on the table in half a minute.', steps: ['Names', 'Topics', 'First question'] },
      ru: { kicker: 'Готовы?', title: 'Вечер начинается здесь', text: 'Впишите имена — и через полминуты первый вопрос уже на столе.', steps: ['Имена', 'Темы', 'Первый вопрос'] },
    },
  ],
};
