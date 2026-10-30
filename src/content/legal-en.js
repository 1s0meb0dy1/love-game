// ============================================================================================
// Юридичні сторінки англійською — переклад src/content/legal.js з тією самою структурою (ключі, порядок, розділи).
// Змінюєте текст там — змініть і тут (тест tests/unit/content.test.js звіряє структуру всіх мовних версій).
// Назви кнопок у тексті («Delete my data», «Players & session»…) збігаються з англійським інтерфейсом (src/i18n-en.js).
// Це НЕ юридична консультація: перед монетизацією чи рекламою покажіть тексти юристу.
// ============================================================================================
export const LEGAL_EN = {
  updated: '2026-10-30',
  updatedHuman: 'October 30, 2026',
  operator: 'an independent developer under the pseudonym yedvinn',
  contact: { label: 'the project’s public issues on GitHub', url: 'https://github.com/1s0meb0dy1/love-game/issues' },
  contactNote: 'Issues on GitHub are public: do not include player names, session IDs or invite links in them.',

  order: ['privacy', 'terms', 'cookies', 'age', 'copyright'],

  docs: {
    // ------------------------------------------------------------------------------------------
    privacy: {
      title: 'Privacy Policy',
      menu: 'Privacy Policy',
      lead: 'In short: the game does not ask for your email or phone number, shows no ads and cannot read your session. Below is everything in detail, without legal fog.',
      sections: [
        { h: 'Who we are', p: [
          'ASK ME is created and maintained by {operator} (the “Developer”). This document describes what data the game uses, why, where it is stored and how to delete it.',
          'You can ask questions about your data via {contact}.',
        ] },
        { h: 'What data the game uses', list: [
          'Player names and a 👨 / 👩 mark. You enter them yourself. They let the game address people by name and use the right word forms. You do not need to enter real surnames.',
          'Session progress: the archive of answered questions, questions you have turned off, and the current unfinished game.',
          'Technical identifiers: a random session ID and an encryption key (they are in the invite link and in the “lock” used to sign in by ID), a random device ID for playing on several phones, and an anonymous Firebase sign-in token. They are not linked to your identity.',
          'Settings: sound, timer, penalties, whether stats are on. They are stored only on your device.',
        ], after: 'The game does not ask for or collect your email address, phone number, real first and last name, location, contacts, photos, or access to your camera and microphone.' },
        { h: 'Where data is stored', list: [
          'On your device, in the browser’s local storage (details on the “Cookies and local storage” page).',
          'In the Google Firebase Realtime Database cloud (servers in Europe, europe-west1 region). It holds an encrypted copy of the session, the shared room for multi-device play and, if enabled, stats.',
          'The game’s pages are hosted on GitHub Pages (GitHub, Inc.). Like any website, the host sees technical connection data when a page is opened, including your IP address.',
          'The game’s fonts and scripts are served from the site itself: there are no external content delivery networks, ad trackers or third-party analytics counters.',
        ] },
        { h: 'Session encryption', p: [
          'The cloud copy of the session (player names, archive, turned-off questions, unfinished game) is encrypted on your device with AES-GCM before it is sent. The encryption key is stored on your devices and in the invite link. The Developer never receives it and cannot read your session.',
          'Signing in by ID. So that a session can be opened on a new device with just an 8-character ID, the cloud holds a “lock”: the session key encrypted with a key derived from the ID (PBKDF2, 300,000 rounds). The lock’s address is also derived from the ID, so the ID cannot be learned from the cloud contents, and every guessing attempt requires the full calculation. But the ID is short (about 40 bits), so this is “room code” level protection, not password level. Do not publish your ID or screenshots of the home screen where it is visible.',
          'Two rules follow from this. First: anyone who has your invite link or session ID gets full access to the session, so do not send them to strangers. Second: if both the link and the ID are lost and the session is not open on any device, it cannot be recovered.',
        ] },
        { h: 'Playing on several devices', p: [
          'While you play alone, only a service marker is sent to the shared room: the number of questions in the game, the mode and a “fingerprint” of the deck. Player names and game progress are not sent.',
          'When a second device joins, so that the phones can play one game, the following is written to the room: player names and marks, the question numbers of the game, game progress (current question, who is answering), roulette and penalty events, and “device in game” marks with timestamps.',
          'The room is named with a long code derived from the session key, so it cannot be guessed. But the room data itself is not encrypted: it is available to anyone who knows the room code and therefore your session key.',
          'When a game is ended with the “For everyone” button, the names and the question list are removed from the room. If a game is simply abandoned, the data stays until you start a new game in this session or press “Delete my data”.',
          'Truth or Dare mode writes the game to a separate room next to the main one (the same code marked “_t”) right at the start, even if only one device is playing: player names and marks, the choice of “truth” or “dare” and levels, how many and which tasks were done and skipped, the card numbers of the game, and “device in game” marks with timestamps. This data is not encrypted either and is available to whoever knows the room code. After the game ends it stays in the room until a new Truth or Dare game starts in this session or you press “Delete my data”.',
        ] },
        { h: '“Scenario” and “Advice” hints', p: [
          'When you press “Scenario” or “Advice”, the question text, the topic name, the number of players and the interface language are sent to the game’s proxy server (Cloudflare Workers) and from there to the Google Gemini artificial intelligence service, which writes the answer. If Gemini is unavailable, the request may go to backup AI services: Groq (groq.com), Cloudflare Workers AI or Pollinations (pollinations.ai). Player names, the session ID and the encryption key are never included in the request.',
          'The proxy does not keep a request log. It uses your IP address only to limit the request rate, and it caches a few answers to the same question for up to 30 days (without any information about who asked) so that hints keep working when an AI service fails.',
          'Gemini is used on the free tier: under Google’s terms, such requests may be reviewed by humans and used to improve Google services. The Developer does not control the Google, Groq, Cloudflare and Pollinations services and is not responsible for how they process requests.',
          'If you do not press these buttons, nothing is sent anywhere. The answers are written by AI: they may be inaccurate and are not professional advice.',
        ] },
        { h: 'Game stats *', p: [
          'Stats help us understand which questions people like, which are skipped more often and how games go. They are on by default; you can turn them off at any time: Menu → “Game stats”.',
          'If stats are on, two records are sent during and after a game. An anonymized one: the time and length of the game, the number of players, the number of answers and skipped questions, the numbers of those questions, their topics and levels, the average answer speed, timer settings and penalties used. An extended one: the same plus player names and the texts of your penalties. The session ID and encryption key never get into stats.',
          'Only the Developer can read these records. They are used to improve the questions and the game balance and are not shared with anyone.',
        ] },
        { h: 'How long data is kept', list: [
          'The cloud copy of the session: until you delete it with the “Delete my data” button.',
          'The shared room: until the game is ended “for everyone”, a new game starts in the session, or the data is deleted.',
          'Stats: until the Developer deletes outdated records. Records from your device can be deleted with the “Delete my data” button.',
          'Local data: until you clear the browser storage or press “Delete my data”.',
        ] },
        { h: 'Who receives data', p: [
          'The Developer does not sell data or share it for advertising. Data is processed by infrastructure providers: Google (Firebase), GitHub (page hosting) and, only if you press “Scenario” or “Advice”, Cloudflare (proxy server), Google (Gemini) and, as a backup, Groq, Cloudflare Workers AI and Pollinations (AI). These services may be located outside your country, including in the USA.',
        ] },
        { h: 'Your rights', list: [
          'Find out what data is stored: you see names and progress in the game, and technical data is described in this document.',
          'Correct data: names can be changed in “Players & session”.',
          'Delete data: “Players & session” → “Delete my data”. The button erases the cloud copy of the current session, the shared room, this session’s stats records from this device and its local profile. General settings and links to other sessions are kept. Local copies may remain on other devices. To stop deleted data from loading again, technical deletion markers without names or progress are kept.',
          'Opt out of stats: Menu → “Game stats”.',
          'Contact the Developer or a personal data protection authority (in Ukraine, the Ukrainian Parliament Commissioner for Human Rights; for EU residents, the data protection authority of your country).',
        ] },
        { h: 'Children', p: [
          'The game is intended for people aged 18 and over and contains questions on intimate topics. The Developer does not knowingly collect data from minors. If you learn that a child is using the game, let us know via {contact} and we will delete the data.',
        ] },
        { h: 'Security', p: [
          'Data is sent over a secure connection (HTTPS), the session is encrypted, and database access is restricted by rules. However, no system is 100% secure, so do not enter anything into the game that should not leave your device.',
        ] },
        { h: 'Changes to this policy', p: [
          'The policy may change along with the game. The date of the last update is shown at the top of the page. We will announce significant changes in the game.',
        ] },
      ],
    },

    // ------------------------------------------------------------------------------------------
    terms: {
      title: 'Terms of Use',
      menu: 'Terms of Use',
      lead: 'The rules are simple: play by mutual consent, respect other people’s boundaries and keep your invite link safe.',
      sections: [
        { h: 'Acceptance of terms', p: [
          'By using ASK ME, you agree to these terms and to the privacy policy. If you do not agree, do not use the game.',
        ] },
        { h: 'What this game is', p: [
          'ASK ME is an entertainment game with questions for two and for groups. It is not psychotherapy and not medical, legal or family counseling. The “Scenario” and “Advice” hints are written by artificial intelligence: they may be inaccurate and must not be taken as professional advice.',
        ] },
        { h: 'Age and consent of participants', list: [
          'Only people aged 18 or over may play.',
          'The game contains questions on intimate topics. Play only when all participants agree to it.',
          'Any player has the right to skip a question, decline a topic or leave the game at any time. You must not pressure a player or force them to answer or to take a “penalty”.',
        ] },
        { h: 'Truth or Dare mode: 18+ and your own cards', p: [
          'This mode is designed for adults: it has explicit “Hard” level cards and edgy banter. They are off by default and are turned on only by the group’s own decision after an 18+ warning.',
        ], list: [
          'The 18+ warning and age restriction apply to the mode as a whole, including your own cards: play with them only with adults and only with their consent.',
          'You write your own cards yourself. They are stored only on your device, are not sent to the server and are not published anywhere; their text is not visible on other devices of the session, the author reads it out.',
          'You are responsible for the text of your own cards. The rules of these terms and the law apply to them too: do not write anything that humiliates people, contains threats, incites hatred or breaks the law.',
          'The Developer does not review your cards (they never leave your device) and is not responsible for their content. You can delete them in the mode’s lobby or with the “Delete my data” button.',
        ] },
        { h: 'Rules of use', p: ['You agree not to:'], list: [
          'use the game for pressure, blackmail, bullying, insults or revealing other people’s secrets;',
          'record, forward or publish other people’s answers without the consent of the person who gave them;',
          'try to access other people’s sessions, break the game’s security, overload the service or use automated scripts;',
          'copy the question base, design and code of the game for commercial use without the Developer’s permission;',
          'use the game for unlawful purposes.',
        ] },
        { h: 'Your session and invite link', p: [
          'A session is created without registration. Access to it is given by the invite link and the session ID: whoever receives them can open the session, see player names and progress, and play. You are responsible for whom you share them with.',
          'The Developer cannot restore lost links and IDs or access to an encrypted session.',
        ] },
        { h: 'Content rights', p: [
          'The question texts, design, names and code of the game belong to the Developer or are used on lawful grounds. You are granted the right to personal non-commercial use of the game.',
          'Players’ answers are spoken out loud and are not recorded in the game: they remain yours. Player names and session progress belong to you.',
          'What you may and may not do with the game’s materials is described on the “Copyright” page.',
        ] },
        { h: 'Availability of the game and changes', p: [
          'The game is provided “as is”. Failures, interruptions and updates are possible. The Developer may change, limit or stop individual features or the whole game. So keep your invite link and do not rely on data being kept as a guarantee.',
        ] },
        { h: 'Liability', p: [
          'To the extent permitted by law, the Developer is not liable for the content of conversations between players and their consequences for relationships, for participants’ emotional reactions, for the content of hints from the external AI service, or for losses caused by failures, unavailability of the game or loss of data.',
          'These limitations do not exclude liability that cannot be limited by law.',
        ] },
        { h: 'Ending use', p: [
          'You can stop using the game at any time and delete your data with the “Delete my data” button. The Developer may restrict access to the game if these rules are broken.',
        ] },
        { h: 'Governing law *', p: [
          'These terms are governed by the law of Ukraine. If you live in another country, you keep the protection given to you by the mandatory laws of that country. The parties first try to settle disputes through negotiation.',
        ] },
        { h: 'Changes and contact', p: [
          'These terms may be updated; the current version is always available on this page, and the update date is shown at the top. By continuing to use the game after changes, you accept the new version.',
          'You can contact the Developer via {contact}.',
        ] },
      ],
    },

    // ------------------------------------------------------------------------------------------
    cookies: {
      title: 'Cookies and local storage',
      menu: 'Cookies and storage',
      lead: 'The game does not use cookies for advertising or tracking. It keeps settings and progress in your device’s browser storage.',
      sections: [
        { h: 'What we use', p: [
          'The game sets no advertising or analytics cookies and loads no third-party counters. Instead of cookies, it uses the browser’s local storage (localStorage / sessionStorage) and the app cache (service worker) so that the game starts quickly and remembers your progress. This storage is strictly necessary: the game cannot work without it, so no separate consent is required.',
        ] },
        { h: 'What exactly is on your device', table: [
          ['askme_device_profile_v4', 'Profile of the current session: player names, archive, unfinished game', 'Until data is deleted'],
          ['askme_sess_<ID>', 'Copies of sessions you have opened on this device', 'Until data is deleted'],
          ['askme_auth_v2', 'Firebase tokens for anonymous sign-in; on the owner’s device also the owner’s sign-in', 'Renewed automatically'],
          ['askme_game_settings_v1, askme_hard_mode_v1', 'Game settings: timer, penalties, mode', 'Until data is deleted'],
          ['askme_analytics_v1', 'Whether game stats are on', 'Until data is deleted'],
          ['askme_aid_<ID>', 'A random number for this device’s stats records', 'Until data is deleted'],
          ['askme_deleted_<ID>', 'A session deletion marker so that other tabs do not load it again', 'Until the site storage is cleared'],
          ['askme_seen_topics_v1, askme_punish_templates_v1, askme_tod_cards_v1, askme_*_cache_*', 'Which topics you have already seen; a copy of questions, topics, penalty templates and Truth or Dare cards for a quick start', 'Until the cache is cleared'],
          ['askme_tod_mine_v1', 'Your own Truth or Dare cards: stored only on this device and never sent to the server', 'Until you delete them or clear the site data'],
          ['askme_dev_v1 (sessionStorage)', 'A random device ID for playing on several phones', 'While the tab is open'],
          ['Other askme_* entries', 'Technical interface markers and service settings, including the chosen language; they contain no personal data', 'Until data is deleted'],
          ['App cache', 'Game files for a quick start and installing to the home screen', 'Until the cache is cleared'],
        ] },
        { h: 'How to clear it', list: [
          'Delete the game’s data: “Players & session” → “Delete my data”.',
          'Clear storage manually: browser settings → “Site data” → delete the data for the game’s site.',
          'Turn off stats: Menu → “Game stats”.',
        ] },
        { h: 'Third-party services', p: [
          'The game connects to Google Firebase servers (cloud session, shared room, questions) and is hosted on GitHub Pages. If you use the “Scenario” and “Advice” hints, the request goes through a proxy server on Cloudflare to the Google Gemini AI service (as a backup, Groq, Cloudflare Workers AI or Pollinations). These services do not set cookies on the game’s site. More details are in the privacy policy.',
        ] },
      ],
    },

    // ------------------------------------------------------------------------------------------
    age: {
      title: 'Age and explicit content',
      menu: 'Age 18+',
      lead: 'ASK ME is a game for adults. Some questions touch on personal and intimate things.',
      sections: [
        { h: 'Only for people over 18', p: [
          'The game has questions about intimacy, relationships, fears, money and other personal topics. They are intended for adults only. If you are under 18 or are in a country where such games are prohibited, do not use ASK ME.',
        ] },
        { h: 'How to play with care', list: [
          'Agree in advance on what you are ready to talk about. Topics you do not want can be turned off before a game starts.',
          'Start with light questions and move on to deep ones once trust builds.',
          'You can always skip a question: that is fine, and nobody has to explain why.',
          'What is said in the game stays in the game: do not retell other people’s answers without their consent.',
          'If the conversation gets too heavy, stop. The game does not replace a talk with a loved one or help from a professional.',
        ] },
        { h: 'Truth or Dare mode', p: [
          '“Hard” level cards are explicit, and the “Spicy” banter tone has mild vulgarity, dark humor and political satire. Both are off by default and are turned on deliberately in the lobby after an 18+ warning.',
          'Play only with people who are comfortable with it. Any task can be skipped: in the results a skip earns a joking title, and nothing more.',
        ] },
        { h: 'Limitations', p: [
          'The game has no age verification: the user is responsible for complying with the age restriction. Parents and guardians can block access to the game with device or browser tools.',
        ] },
      ],
    },

    // ------------------------------------------------------------------------------------------
    copyright: {
      title: 'Copyright',
      menu: 'Copyright',
      lead: '© 2026 yedvinn. All rights reserved. Below: what in the game is protected by copyright, what you may do freely and how to report an infringement.',
      sections: [
        { h: 'Rights holder', p: [
          'The author and rights holder of ASK ME is {operator}. An author has the right to sign a work with a pseudonym; copyright arises when a work is created and does not require registration (Law of Ukraine “On Copyright and Related Rights” No. 2811-IX).',
        ] },
        { h: 'What is protected', list: [
          'The texts of questions, topics, Truth or Dare cards and penalty templates, and the collection of these texts as a database.',
          'The interface texts, the “About the game” page and these documents.',
          'The interface design, the ASK ME logo and name, icons, background motifs and animations.',
          'The program code of the game and of the proxy server.',
        ] },
        { h: 'What you may do without permission', list: [
          'Play, share a link to the game and invite friends.',
          'Quote individual questions in a review, article or post, citing “ASK ME” as the source with a link to the game, to the extent justified by the purpose of the quote.',
          'Take screenshots and recordings of your own game for personal use or non-commercial publication, as long as they do not show other people’s answers without consent.',
        ] },
        { h: 'What you may not do without written permission', list: [
          'Copy the question or card base in full or in large parts, translate it and publish it in other games, apps, books or websites.',
          'Sell the game’s materials or use them in commercial products and advertising.',
          'Use the ASK ME logo, name and design in a way that could be confused with the original game.',
          'Copy the game’s code: the fact that it can be viewed on GitHub does not give the right to use it.',
        ] },
        { h: 'AI answers', p: [
          'The “Scenario” and “Advice” hints are generated automatically by AI at the moment of the request. The Developer does not claim authorship of individual answers and is not responsible for any accidental similarity of their text to other works.',
        ] },
        { h: 'Third-party components', p: [
          'The game uses components by other authors under the terms of their free licenses. The rights to them belong to their authors.',
        ], list: [
          'React and React DOM — © Meta Platforms, Inc. and project contributors, MIT license.',
          'qrcode-generator — © Kazuhiko Arase, MIT license.',
          'Workbox (offline mode and installing to the home screen) — © Google LLC, MIT license.',
          'Onest and Unbounded fonts — © their authors, SIL Open Font License 1.1.',
        ] },
        { h: 'Report an infringement', p: [
          'If you believe material in the game infringes your rights, or you have found a copy of ASK ME, write via {contact}: what exactly, where it is posted and why you consider it an infringement. We will review the request and, if it is justified, remove the material.',
        ] },
      ],
    },
  },
};
