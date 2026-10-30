// Англійська версія сторінки «Про гру» (#/about). Структура — точно як у about.js (ключі, id, значки, порядок);
// змінюєте одну версію — змінюйте й інші. Ключі demo.examples («Простые» тощо) — це id рівнів, їх не перекладають.
// Тест `tests/unit/content.test.js` перевіряє, що структура всіх версій збігається і в англійському тексті немає кирилиці.
export const ABOUT_EN = {
  version: '1.0',
  updated: '2026-10-30',

  hero: {
    title: 'Honest conversations for couples and groups',
    lead: 'ASK ME brings the questions, picks who answers, and gently guides the conversation from light to deep. You just talk.',
    cta: 'Start playing',
    ctaHave: 'Back to game',
  },

  // "Try it now": shows real questions from the game (excluding the "Intimacy" topic). Uses fallback questions until the database loads.
  demo: {
    title: 'Try it now',
    hint: 'Pick a depth and see what the questions sound like.',
    next: 'Next example',
    // Exactly three examples per depth — real game questions, no "Intimacy" topic (public page).
    // If you change questions, keep three per depth: the page cycles through them.
    examples: {
      'Простые': ['Coffee, tea, or matcha in the morning?', 'What hidden, completely useless but funny talent do you have?', 'Life of the party or attentive listener in the corner of the room?'],
      'Средние': ['Brutal truth even if it hurts, or a white lie to keep the peace?', 'What are you catastrophically afraid of not doing in this life?', 'How do you best like to be comforted and cared for when you’re sad?'],
      'Глубокие': ['What unspoken regret crosses your mind when you’re alone with yourself?', 'What inner conflict do you stay quiet about because you’re afraid of looking vulnerable or weak?', 'What part of your former self is gone forever and will never come back?'],
    },
  },

  // What to show instead of the question count while the question database is still loading
  fallbackNumbers: { questions: 'Hundreds of' },

  // Short numbers under the headline
  numbers: [
    { value: '{questions}', label: 'questions in play' },
    { value: '{topics}', label: 'conversation topics' },
    { value: '3', label: 'depth levels' },
    { value: '{players}', label: 'players at the table' },
  ],

  // Sequence of actions — so numbers make sense here
  stepsTitle: 'How it works',
  steps: [
    { title: 'Create a session', text: 'Enter player names — no email, phone, or passwords. The game gives you a link you can open on any device.' },
    { title: 'Pick topics and depth', text: 'Only light questions to get acquainted, or everything — you decide. Unwanted topics and questions can be turned off.' },
    { title: 'Take turns answering', text: 'The roulette picks who answers. Don\'t want to answer — skip. The rest listen and ask their own questions.' },
  ],

  featuresTitle: 'What ASK ME does',
  featureGroups: [
    { id: 'all', label: 'All' },
    { id: 'play', label: 'Gameplay' },
    { id: 'together', label: 'Together' },
    { id: 'private', label: 'Privacy' },
  ],
  features: [
    { id: 'questions', group: 'play', icon: '📚', title: '{questions#question,questions,questions} in {topics#topic,topics,topics}', short: 'Family, money, future, fears, daily life, and other topics.',
      more: 'Each question belongs to one topic and one of three depth levels. The question list can be quickly filtered by depth, and unwanted ones can be turned off just for you.' },
    { id: 'arc', group: 'play', icon: '🎢', title: 'Deck with narrative arc', short: 'Beginning — lighter, middle — deeper, then — gentle landing.',
      more: 'The game doesn\'t throw questions at random. The deck is built in waves: first warm up, then go deep, then let you breathe. The same topic won\'t repeat three times in a row.' },
    { id: 'roulette', group: 'play', icon: '🎰', title: 'Turn roulette', short: 'Fairly decides who answers now.',
      more: 'No arguing whose turn it is. The roulette tracks who already answered the current question, so everyone gets a turn — from two to ten people.' },
    { id: 'hard', group: 'play', icon: '⏱️', title: 'Challenge mode', short: 'Timer on answers and funny penalties for skipping.',
      more: 'Turn on the timer and pick how long to answer. Didn\'t make it or refused — you get a random penalty from the list. Need a calm evening — play in Classic mode without the timer.' },
    { id: 'ai', group: 'play', icon: '✨', title: 'Scenario and Advice', short: 'Help when you don\'t know how to approach a question.',
      more: 'The "Scenario" button turns the question into a scene, "Advice" suggests how to talk about the topic gently. It\'s optional: question text and player names go to an external AI service only after you tap.' },
    { id: 'devices', group: 'together', icon: '📱', title: 'One question on all phones', short: 'As many devices as players (up to {devices}).',
      more: 'Open the session on multiple phones: question, turn order, roulette, and timer are the same for everyone. While you play alone, nothing gets sent anywhere — sync kicks in when a second device connects.' },
    { id: 'invite', group: 'together', icon: '🔗', title: 'Invite by link and QR', short: 'Friend scans the code and they\'re in.',
      more: 'There\'s an "Invite" button in the menu. It shows a QR code and link: just scan the code with a camera or open the link — no sign-up needed.' },
    { id: 'tod', group: 'play', icon: '🎲', title: 'Truth or Dare', short: 'Separate mode for groups: pick a question or a dare.',
      more: 'Everyone takes turns choosing "Truth" or "Dare" at three levels. "Truth" — no more than three times in a row, then a dare is required. Dares can be skipped, but skips count: in the results — "Hall of Shame" and good titles. Spicy cards and sharp jabs — 18+ only and turned on separately. Play on one phone or several at once.' },
    { id: 'archive', group: 'play', icon: '🗂️', title: 'Doesn\'t repeat', short: 'Answered questions go to the archive.',
      more: 'Played it — the question goes to the archive and won\'t come up again. You can bring it back anytime. You can pause a session and pick up later from the same spot.' },
    { id: 'nosignup', group: 'private', icon: '🙈', title: 'No sign-up or ads', short: 'No email, no password, no banners.',
      more: 'A session is a random ID and link-key. The game has no ads, pixels, or third-party trackers.' },
    { id: 'encrypted', group: 'private', icon: '🔐', title: 'Session is encrypted', short: 'Only you can read names and progress.',
      more: 'The cloud backup of your session is encrypted on the device. It can be opened with the invite link or session ID — don\'t show them to strangers. The developer can\'t read who and how you\'re playing. Lost both the link and ID — recovery is impossible.' },
    { id: 'pwa', group: 'together', icon: '📲', title: 'Install to home screen', short: 'Opens like an app, no app store.',
      more: 'Add ASK ME to your home screen — the game launches fullscreen, opens fast, and works on phone, tablet, and computer.' },
    { id: 'delete', group: 'private', icon: '🧹', title: 'Delete data in one step', short: 'Button in profile wipes the session and everything related.',
      more: 'In "Players & session" there\'s "Delete my data": it removes the cloud session backup, shared game room, this device\'s stats records, and local data.' },
  ],

  // Separate block about "Truth or Dare" mode
  todSection: {
    title: 'Truth or Dare mode',
    lead: 'A separate game for groups and couples: pick truth or dare, and the snarky host keeps order.',
    items: [
      { icon: '💬', title: 'Truth or Dare', text: 'On your turn, choose "Truth" — an honest answer to a question — or "Dare" — a challenge at three levels: easy, medium, and hard.' },
      { icon: '🔒', title: 'Truth — no more than three times in a row', text: 'Picked truth three times in a row — on the fourth turn, only "Dare" is open. So nobody hides in safe questions.' },
      { icon: '🐔', title: 'Skipping is shameful', text: 'You can skip a dare, but the turn stays with you, and the skip goes to the "Hall of Shame" in the results — next to the good titles.' },
      { icon: '😏', title: 'Host jabs', text: 'The host comments under the card: gentle jabs or sharp ones — your choice. They can be turned off completely.' },
      { icon: '🔞', title: '18+ turned on separately', text: 'Spicy cards and sharp tone are off by default and turned on after a warning. Custom cards are stored only on your device.' },
    ],
  },

  unique: {
    title: 'What makes ASK ME different',
    items: [
      { icon: '🎲', title: 'It\'s a game, not a question list', text: 'Turn order, roulette, timer, skips, and results turn the conversation into a shared adventure — nobody\'s scrolling notes on their phone.' },
      { icon: '👥', title: 'Works for two or a group', text: 'From a date for two to an evening with ten people. Players can sit at the same table or video call from different cities — each with their own phone.' },
      { icon: '🛡️', title: 'Gentle with boundaries', text: 'Any question can be skipped, a topic turned off, and depth chosen. The game doesn\'t force you to go where you don\'t want to.' },
      { icon: '🔒', title: 'Your data stays yours', text: 'Minimal data, encrypted session, one-button deletion. Details in the privacy policy.' },
    ],
  },

  faqTitle: 'Frequently asked questions',
  faq: [
    { q: 'How much does it cost?', a: 'Right now the game is free and ad-free.' },
    { q: 'Is sign-up required?', a: 'No. You enter player names, and the game creates a session with an ID and link. Save the link or ID — you can open the session on another device with them.' },
    { q: 'How many people can play?', a: 'From two to {players}. On multiple phones at once — as many devices as players you added to the session (max {devices}).' },
    { q: 'What if I lose the link?', a: 'The session can be opened both by link and by the 8-digit ID — it\'s written on the main screen under the "Start playing" button. If the session is closed everywhere and you lost both the link and ID, recovery is impossible — that\'s why the data is safe. Just start a new one.' },
    { q: 'Who is this game for?', a: 'For adults: the game has questions on intimate topics. You can only play from 18 and only with the consent of all participants.' },
    { q: 'What is Truth or Dare mode?', a: 'A separate mode for groups: on your turn you pick truth (question) or dare (challenge). Truth can be picked no more than three times in a row, skipping goes to the "Hall of Shame". Spicy cards and sharp jabs — 18+ only and off by default.' },
    { q: 'Can you skip a question?', a: 'Yes, anytime. In Challenge mode, skipping may result in a funny penalty — you decide by turning it on or not.' },
    { q: 'How do I delete my data?', a: 'Menu → "Players & session" → "Delete my data". Everything the game stores about your session in the cloud and on the device will be erased.' },
  ],

  cta: {
    title: 'Ready to know each other better?',
    text: 'Create a session in a minute — names are enough.',
  },
  share: {
    title: 'ASK ME — honest conversations for couples and groups',
    text: 'A game with questions that help you know each other better. No sign-up.',
    done: 'Page link copied',
  },
};
