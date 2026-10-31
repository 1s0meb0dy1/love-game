// Новые карточки (RU гендерно-нейтрально + EN). k: q вопрос, d действие, f форфейт, c выбор; a: g компания, c пара, b обе; l: острота 1–3.
// Редакторские правила: пропуск бесплатен; нет алкоголя, боли, раздевания, паролей, сообщений бывшим, чужих секретов; у каждого движения есть сидячая альтернатива.
const mk = (k, a, l, t, s) => s.trim().split('\n').filter(Boolean).map((x) => { const i = x.indexOf(' | '); return { k, a, l, t, r: x.slice(0, i).trim(), e: x.slice(i + 3).trim() }; });

export const NEW_CARDS = [
  ...mk('q', 'g', 1, 'Разогрев', `
Какой навык у тебя самый бесполезный и самый любимый? | What's your most useless but favorite skill?
Какое слово ты повторяешь слишком часто? | Which word do you overuse?
Какую песню знаешь наизусть, хотя лучше бы не знать? | Which song do you know by heart but wish you didn't?
Какой фильм можно пересматривать бесконечно? | Which movie could you rewatch forever?
Что всегда берёшь в поездку и ни разу не пригодилось? | What do you always pack and never use?
Какое блюдо у тебя получается лучше всех? | What's the dish you cook best?
Какой маленькой привычкой гордишься? | Which small habit are you proud of?
Какой запах возвращает в детство? | Which smell takes you back to childhood?
Какую суперсилу выбрать для обычного вторника? | Which superpower would you pick for an ordinary Tuesday?
Какая покупка до 20 долларов порадовала больше всего? | Which purchase under $20 made you happiest?
Чем занимаешься, когда никто не видит, и совсем не стыдно? | What do you do when nobody's looking, with zero shame?
В какой игре ты неожиданно хорош? | Which game are you unexpectedly good at?
Какой навык хочется освоить за выходные? | Which skill would you learn in one weekend?
Какое слово звучит для тебя смешно? | Which word sounds funny to you?
Какой звук у тебя самый любимый? | What's your favorite sound?
Какое место в городе покажешь гостю первым? | Which spot in your city would you show a guest first?
Как выглядит идеальное утро? | What does a perfect morning look like?
Какое приложение открываешь чаще всего? | Which app do you open most?
Какая песня стала бы заставкой твоей жизни? | Which song would be the opening theme of your life?
Какая у тебя самая странная еда для настроения? | What's your weirdest comfort food?
Чему тебя научил YouTube? | What did YouTube teach you?
Какую вещь давно пора выбросить, но жалко? | What have you been meaning to throw out but can't?
Какое прозвище было у тебя в детстве? | What was your childhood nickname?
Чем заняться, если деньги не важны? | What would you do for work if money didn't matter?
Что стоило бы изобрести, чтобы жизнь стала проще? | What would you invent to make your life easier?
Какая у тебя любимая отговорка? | What's your go-to excuse?
Какой комплимент в твой адрес был самым неожиданным? | What's the weirdest compliment you've ever received?
Какой сериал посоветуешь всем без исключения? | Which show would you recommend to everyone?
Что делаешь первым делом, придя домой? | What's the first thing you do when you get home?
Что никогда никому не одолжишь? | What would you never lend to anyone?
Сколько времени в день уходит на телефон — по твоим ощущениям? | How much time a day do you think you spend on your phone?
О чём можешь рассказывать бесконечно? | What topic could you talk about for hours?
Что любишь в дождливые дни? | What do you love about rainy days?
Какой подарок запомнился лучше всех? | Which gift do you remember best?
В какой город поехать завтра, если выбирать без раздумий? | Which city would you go to tomorrow without thinking?
Какую музыку включаешь, когда никто не слышит? | What do you play when nobody's around?
В чём ты сильнее, чем думают окружающие? | What are you better at than people think?
Что стало бы последним блюдом в жизни? | What would your last meal be?
`),
  ...mk('q', 'g', 1, 'Истории', `
Расскажи про самый неловкий момент из школы. | Tell us your most awkward school moment.
Когда последний раз тебя разобрал смех до слёз? | When did you last laugh until you cried?
Что стало твоей первой работой? | What was your first job?
Расскажи о маленькой победе, которой гордишься. | Tell us about a small win you're proud of.
Какое свидание запомнилось смешнее всего? | What's the funniest date you remember?
Какой совет подошёл бы себе в восемнадцать? | What advice would you give 18-year-old you?
Что в последний раз удивило тебя в самом себе? | What last surprised you about yourself?
Какая поездка изменила твой взгляд на что-то? | Which trip changed how you see something?
Расскажи о человеке, сильно повлиявшем на тебя. | Tell us about someone who shaped you.
Какой подарок выбрался неудачно? | What gift did you pick badly?
Какой самый спонтанный поступок за жизнь? | What's the most spontaneous thing you've done?
Что в последний раз приятно удивило? | What last pleasantly surprised you?
Расскажи историю про потерянную вещь. | Tell a story about something you lost.
Какое быстрое решение оказалось правильным? | A quick decision that turned out right?
Какое воспоминание достойно капсулы времени? | Which memory would you put in a time capsule?
Что пугало в детстве, а теперь смешно? | What did you fear as a kid that's funny now?
Расскажи о самом вкусном ужине в жизни. | Describe the best dinner of your life.
Каким был первый концерт в твоей жизни? | What was the first concert you went to?
Какую семейную традицию хочется сохранить? | Which tradition do you want to keep?
Какой самый неожиданный комплимент прозвучал в твой адрес? | The most unexpected compliment you've heard?
Какая книга или фильм изменили тебя? | Which book or film changed you?
Какой самый странный совет достался тебе? | The strangest advice you ever got?
Расскажи о случае, когда удалось заблудиться. | Tell us about the time you got lost.
О чём мечталось в десять лет? | What did you dream about at ten?
`),
  ...mk('c', 'b', 1, 'Выбор и воображение', `
Море зимой или горы летом — и почему? | Sea in winter or mountains in summer — why?
Уметь прекрасно готовить или прекрасно танцевать? | Cook beautifully or dance beautifully?
Неделя без музыки или неделя без кино? | A week without music or without movies?
Спонтанная поездка или идеально спланированный день? | A spontaneous trip or a perfectly planned day?
Дом с библиотекой или дом с мастерской? | A house with a library or a workshop?
Ужин с любимым автором или концерт из-за кулис? | Dinner with your favorite author or a concert backstage?
Поменяться профессиями на день или городами на месяц? | Swap jobs for a day or cities for a month?
Выучить язык за ночь или освоить инструмент за неделю? | Learn a language overnight or an instrument in a week?
Завтрак в постели каждый день или ужин в ресторане раз в неделю? | Breakfast in bed daily or a restaurant dinner weekly?
Жить без интернета месяц или без кофе год? | A month without internet or a year without coffee?
Читать мысли или перемещаться во времени? | Read minds or travel in time?
Работать из любой точки мира или иметь выходные в три дня? | Work from anywhere or have three-day weekends?
Всегда опаздывать на пять минут или всегда приходить на двадцать минут раньше? | Always five minutes late or always twenty minutes early?
Говорить на любом языке или играть на любом инструменте? | Speak any language or play any instrument?
Остров с друзьями на неделю или большой город на месяц? | A week on an island with friends or a month in a big city?
Голос как у диктора или смех, который заражает всех? | A narrator voice or a contagious laugh?
Одежда в одном цвете всю жизнь или еда одного вкуса год? | One color of clothes forever or one flavor of food for a year?
Только комедии или только приключения до конца жизни? | Only comedies or only adventures for life?
Пикник на закате или кино под открытым небом? | Sunset picnic or open-air cinema?
Питомец-дракон размером с кошку или говорящий кот? | A cat-sized dragon or a talking cat?
Знать дату любого события или знать любой факт про любого человека? | Know the date of any event or any fact about anyone?
Жить в старом замке или в доме будущего? | Live in an old castle or a house of the future?
Остаться без телефона на выходные или без кофе на неделю? | A weekend without a phone or a week without coffee?
Идеальный день рождения или идеальный отпуск? | A perfect birthday or a perfect vacation?
Суперскорость или суперсон? | Super speed or super sleep?
Шоколад навсегда или пицца навсегда? | Chocolate forever or pizza forever?
Всегда тёплая погода или всегда лёгкий дождь? | Always warm weather or always light rain?
Встретить себя из прошлого или из будущего? | Meet yourself from the past or the future?
Вечер настолок или вечер совместной готовки? | A board-game night or a cooking night?
Лучший друг как соавтор книги или как соучредитель бизнеса? | Best friend as co-author of a book or co-founder?
Всё время слышать музыку в голове или всё время видеть цвета звуков? | Constant music in your head or see colors of sounds?
Один идеальный день повторять или каждый день жить заново? | Repeat one perfect day or start each day anew?
Талант рассмешить любого или талант утешить любого? | Make anyone laugh or comfort anyone?
Работа мечты с маленькой зарплатой или средняя работа с большой? | Dream job small pay or average job big pay?
Остановить время на час или перемотать день? | Pause time for an hour or rewind a day?
Танцевать в центре площади или петь в метро? | Dance in a square or sing in the subway?
Уметь всё готовить или всё чинить? | Cook anything or fix anything?
`),
  ...mk('q', 'g', 1, 'Юмор и абсурд', `
Какое название фильма подошло бы нашей компании? | What movie title would fit our group?
Как описать нашу компанию трёмя словами? | Describe our group in three words.
Что в жизни стоило бы назвать «вторым понедельником»? | What would you call a "second Monday"?
Какой смешной слоган был бы у твоей жизни? | What's the funny slogan of your life?
Как назвать группу, в которую входишь только ты? | What would you name a band made of just you?
Что случится, если кот возглавит компанию? | What if a cat ran the company?
Какое слово надо запретить на вечеринках? | Which word should be banned at parties?
Что написано на этикетке твоей жизни? | What's on the label of your life?
Какая нелепая профессия тебе подошла бы? | Which ridiculous profession would suit you?
Как назвать главу, в которой мы сейчас находимся? | What chapter title would describe tonight?
Какой фильм получился бы из твоей среды? | What movie would your Wednesday be?
Какой мемный совет тебе дали бы друзья? | What meme advice would your friends give you?
`),
  ...mk('d', 'g', 1, 'Юмор и абсурд', `
Продай обычную ложку как роскошный гаджет. | Sell an ordinary spoon as a luxury gadget.
Придумай слоган сегодняшнего вечера за двадцать секунд. | Make up tonight's slogan in twenty seconds.
Опиши погоду без слов: пусть остальные угадают. | Mime the weather; others guess.
Расскажи мини-историю из трёх слов, названных группой. | Tell a mini-story from three words the group gives you.
Объясни слово «выходные», не называя дней недели. | Explain "weekend" without naming days of the week.
Нарисуй кота, не отрывая карандаш. | Draw a cat without lifting your pen.
Придумай название фильма о нашей компании. | Make up a title for a movie about our group.
Изобрази походку вымышленного робота сидя. | Mimic a fictional robot's walk, sitting down.
Сними трейлер к своей неделе голосом диктора. | Narrate the trailer of your week in a movie voice.
Представь новости из жизни компании как ведущий. | Present group news like a news anchor.
Сыграй «режиссёра» и дай три указания остальным. | Be the director and give three instructions.
Описывая картинку, не называй её — группа угадывает. | Describe a picture without naming it; the group guesses.
`),
  ...mk('q', 'c', 1, 'Для пары: лёгкие', `
Какой наш обычный момент ты ценишь больше всего? | Which ordinary moment of ours do you value most?
Какую нашу традицию хочется сохранить? | Which tradition of ours should we keep?
Какой новый маленький ритуал попробуем? | Which new small ritual shall we try?
Какое у нас самое смешное воспоминание? | What's our funniest memory?
Какой вечер вдвоём хочется повторить? | Which night together would you repeat?
Какая песня напоминает о нас? | Which song reminds you of us?
Какое блюдо ты хочешь приготовить вместе? | Which dish do we cook together?
Куда поехать на выходные без плана? | Where should we go for a weekend with no plan?
Какую привычку друг друга любишь, хотя она смешная? | Which funny habit of mine do you love?
Какое слово в нашем общем «языке» самое любимое? | Which word in our private language is your favorite?
Какую маленькую радость недели назовёшь? | Name a small joy of the week.
Какое кино посмотрим сегодня и почему? | What movie tonight and why?
Какое место в городе «наше»? | Which place in the city is "ours"?
Какой подарок без повода был бы лучшим? | What's the best gift for no reason?
Что приготовим на нашей кухне в субботу? | What shall we cook in our kitchen on Saturday?
Каким был твой первый вывод обо мне? | What was your first impression of me?
Какой день недели у нас самый «наш»? | Which weekday is most "ours"?
Какой фильм мы могли бы пересматривать вместе вечно? | Which movie could we rewatch forever?
Чем мы смешнее всего похожи? | How are we funnily alike?
Какой наш совместный план радует прямо сейчас? | Which plan of ours excites you now?
Как провести вечер без телефонов? | How do we spend an evening without phones?
Какая у нас получилась бы совместная суперсила? | What would our joint superpower be?
Какое наше фото нравится тебе больше всех? | Which photo of us do you like most?
Какой подарок ты помнишь из наших? | Which of our gifts do you remember?
Что бы мы взяли с собой на необитаемый остров вдвоём? | What would we bring to a desert island together?
Какую шутку понимаем только мы? | What joke is only ours?
`),
  ...mk('q', 'c', 2, 'Для пары: глубже', `
Когда рядом со мной тебе особенно спокойно? | When do you feel most at ease with me?
Что я делаю, что помогает тебе чувствовать поддержку? | What do I do that makes you feel supported?
Как понять, что тебе нужен совет, а не сочувствие? | How can I tell if you need advice or comfort?
Как тебе удобнее просить личное пространство? | How do you prefer to ask for space?
Что в нашем быту хочется облегчить? | What in our routine would you make easier?
О чём мы давно не говорили, а стоило бы? | What haven't we talked about in a while?
Что для тебя значит «заботиться»? | What does "taking care" mean to you?
Какая мелочь делает день лучше? | What small thing makes your day better?
Как тебе легче принимать помощь? | How is it easiest for you to accept help?
Чему мы научились друг у друга? | What have we learned from each other?
Что для тебя финансовое спокойствие? | What does financial peace mean to you?
Какое решение в нашей жизни хочется принимать вместе? | What decisions should we make together?
Какой отпуск будет «нашим» идеальным? | What's our perfect vacation?
Что для тебя важно сохранять в отношениях, когда много дел? | What matters to keep up when we're busy?
Как предложить паузу в напряжённом разговоре, чтобы не обидеть? | How do I suggest a pause without hurting you?
Что тебя восхищает во мне, чего я не замечаю? | What do you admire in me that I don't notice?
Как нам дальше беречь друг друга? | How do we look after each other from here?
Какой разговор хочется начать, но пока страшно? Можно пропустить. | What conversation would you like to start but are nervous? You can skip.
Что для тебя близость, кроме слов? | What is closeness to you besides words?
Какой привычки в быту нам стоит придерживаться? | Which household habit should we keep?
Какой повод для гордости друг за друга у нас был недавно? | What recently made us proud of each other?
Как мы празднуем маленькие победы? | How do we celebrate small wins?
Что тебе мешает отдыхать, и как я могу помочь? | What stops you from resting and how can I help?
Какими тремя словами опишешь нас? | Which three words describe us?
Что приятнее всего слышать от меня? | What do you love hearing from me most?
Какое наше решение стало лучшим? | What was our best decision?
`),
  ...mk('q', 'b', 2, 'Мечты и будущее', `
Какой маленький план на месяц радует? | Which small plan for the month excites you?
Каким хочется видеть своё утро через пять лет? | How do you want your morning to look in five years?
Какой навык мечтаешь освоить к следующей зиме? | Which skill do you want by next winter?
Куда хочется вернуться ещё раз? | Where do you want to go back to?
Какой проект тебе всегда хотелось начать? | Which project have you always wanted to start?
Какая у тебя мечта, о которой редко говоришь? Можно пропустить. | What's a dream you rarely share? You can skip.
Что поменяешь в обычной неделе? | What would you change about an ordinary week?
Какой дом мечты: город, море, лес? | Dream home: city, sea, or forest?
Что значит «хорошая жизнь» через десять лет? | What does a "good life" look like in ten years?
Что делать с неожиданным свободным годом? | What would you do with a free year?
Какую книгу хочется написать или прочитать? | Which book would you write or read?
Какое новое хобби попробуешь в этом месяце? | Which new hobby will you try this month?
Чем займёшься в мире без интернета? | What would you do in a world without the internet?
Что стоит сделать «пока не поздно» в этом году? | What should we do this year "before it's too late"?
Как ты представляешь идеальный день рождения? | What's your perfect birthday?
Какую поездку мы запомним на всю жизнь? | Which trip will we remember forever?
`),
  ...mk('q', 'c', 2, 'Флирт (мягкий, 18+)', `
Какой комплимент для тебя самый приятный? | What compliment lands best for you?
Что в моём взгляде или голосе тебе нравится? | What do you like in my look or voice?
Как выглядит идеальное свидание, если бюджет — ноль? | What's the perfect zero-budget date?
Какой момент нашего знакомства ты вспоминаешь с улыбкой? | Which moment of how we met makes you smile?
Какая у нас получилась бы «романтическая песня»? | What would our romantic song be?
Какая мелочь делает вечер особенным? | What small thing makes an evening special?
Что должно случиться, чтобы вечер стал незабываемым? | What would make a night unforgettable?
Какой самый романтичный жест тебя трогает? | Which romantic gesture touches you most?
Что тебе нравится в том, как мы смеёмся вместе? | What do you love about how we laugh together?
Куда бы пригласил на первое свидание сегодня? | Where would you take me on a first date today?
Что в нашем общении самое «электрическое»? | What feels most electric between us?
Какое слово описывает твоё настроение рядом со мной? | Which word describes your mood around me?
Как лучше всего сказать «ты мне нравишься» без слов? | What's the best way to say "I like you" without words?
Что тебя заставляет улыбаться, когда мы переписываемся? | What makes you smile in our chats?
Какая привычка у партнёра кажется милой? | Which partner habit do you find cute?
Какие слова нежности тебе подходят? Можно пропустить. | Which tender words suit you? You can skip.
Что стоит сделать, чтобы вызвать твою улыбку? | What can I do to make you smile?
Что тебе нравится, когда мы остаёмся вдвоём дома? | What do you like when we stay in together?
`),
  ...mk('q', 'g', 3, 'Острые (без интимных деталей)', `
Какая самая смешная ложь, сказанная ради вежливости? Можно пропустить. | The funniest white lie you've told? You can skip.
Что ты делаешь, когда делаешь вид, что слушаешь? | What do you do when you pretend to listen?
Какой самый неловкий момент в чате ты помнишь? | The most awkward chat moment you remember?
Какая шутка в нашей компании «слишком далеко», но смешная? | Which joke in our group goes "too far" but is funny?
Чьё мнение ты не хочешь слышать, но уважаешь? Можно пропустить. | Whose opinion do you not want to hear but respect? You can skip.
Какая самая неуместная вещь случалась на свидании? | The most inappropriate thing that happened on a date?
В чём ты делаешь вид, что разбираешься? | What do you pretend to be an expert in?
Какой странный комплимент прозвучал от тебя? | The weirdest compliment you blurted out?
Какое негласное правило нарушаешь чаще всего? | Which unwritten rule do you break most?
Какой самый смелый поступок ты откладываешь? Можно пропустить. | What bold thing do you keep postponing? You can skip.
Что бесит в людях, хотя иногда делаешь то же? | What annoys you in others but you do too?
Какой секрет неловко признать, но не страшно? Можно пропустить. | A harmless secret that's awkward to admit? You can skip.
Какая самая большая глупость ради впечатления? | The silliest thing you've done to impress someone?
Какая реакция у тебя на ссору в группе: уйти, шутить, молчать? | In group conflict: leave, joke, or go silent?
Что в себе ты называешь «фичей», а друзья — «багом»? | What do you call a "feature" that friends call a "bug"?
Что честно написал бы в профиле? | What would you honestly write in your profile?
`),
  ...mk('q', 'g', 1, 'Профессии и стереотипы (мягко)', `
Какая профессия кажется самой недооценённой? | Which profession is most underrated?
Какая фраза «профессионально» звучит в твоей работе чаще всего? | Which phrase do you hear most at work?
Какой мем про твою профессию точнее всего? | Which meme about your profession is most accurate?
Что скажет айтишник, дизайнер и бухгалтер на «срочно»? | What would an engineer, designer, accountant say to "urgent"?
Какая работа в мире кажется самой тяжёлой? | Which job seems the hardest?
Какая «рабочая» привычка осталась у тебя дома? | Which work habit follows you home?
Что поменяешь в профессии мечты? | What would you change about your dream job?
Что обычно говорят на созвоне, когда не понимают? | What do people say on a call when they don't get it?
Какая шутка про твою профессию тебе нравится? | Which joke about your profession do you like?
Кто в твоей жизни «неофициальный консультант» по всему? | Who's your unofficial consultant for everything?
Какие три слова описывают твою рабочую неделю? | Three words for your work week.
Какой самый странный запрос тебе присылали по работе? | The strangest request you've had at work?
`),
  ...mk('d', 'g', 1, 'Действия для компании', `
За двадцать секунд придумай девиз вечера. | In twenty seconds make up tonight's motto.
Назови по одному комплименту каждому по кругу. | Give each person a compliment.
Покажи три эмоции без слов. | Show three emotions without words.
Прочитай следующую фразу голосом диктора. | Read the next line in a narrator voice.
Сделай тост за что-нибудь маленькое и важное. | Raise a toast to something small and important.
Угадай загаданное слово по трём подсказкам группы. | Guess the word from three clues.
Расскажи анекдот или шутку, любимую группой. | Tell a joke the group likes.
Придумай новое название для привычного предмета в комнате. | Rename an ordinary object in the room.
Нарисуй автопортрет за десять секунд. | Draw a self-portrait in ten seconds.
Покажи, как проходит твой идеальный вечер, жестами. | Act out your perfect evening with gestures.
Сыграй сцену «первое свидание» с соседом. | Act a "first date" scene with a neighbor.
Придумай рекламу для самого простого предмета на столе. | Make an ad for the simplest object on the table.
Расскажи о своём дне как футбольный комментатор. | Describe your day like a football commentator.
Подбери песню, которая подходит текущему моменту. | Pick a song that fits this moment.
Изобрази известного человека, а группа угадывает. | Impersonate a famous person; the group guesses.
Придумай трёхстрочное стихотворение о вечере. | Write a three-line poem about tonight.
Назови три вещи, за которые благодарность сегодня. | Name three things you're grateful for today.
Изобрази животное, на которое похоже настроение сейчас. | Mimic the animal that matches your mood.
Сфотографируй предмет так, чтобы он выглядел как обложка альбома. | Photograph an object like an album cover.
Покажи без слов, как выглядит «пятница вечером». | Mime "Friday night".
Расскажи сказку в одно предложение. | Tell a fairy tale in one sentence.
Скажи фразу «я в порядке» пятью способами. | Say "I'm fine" in five ways.
Сыграй сцену в лифте с любым предметом. | Act an elevator scene with any object.
Придумай необычное применение скрепке. | Find an unusual use for a paperclip.
Расскажи о любимом предмете, как музейный экскурсовод. | Describe a favorite object like a museum guide.
Придумай рецепт «блюда вечера» из того, что есть на столе. | Invent a recipe from what's on the table.
Устрой минутный «пресс-подход»: группа задаёт вопросы. | Hold a one-minute press conference.
Объясни правила любой игры, не называя её. | Explain a game's rules without naming it.
Расскажи про свой день как хороший трейлер. | Tell your day as a good trailer.
Покажи жестами любимую профессию. | Show your favorite profession with gestures.
Придумай три коротких тоста за один круг. | Make three short toasts in one round.
Выбери человека справа и сделай ему «титул вечера». | Give the person on your right a title of the night.
`),
  ...mk('d', 'g', 2, 'Действия для компании (острее)', `
Спой припев любой песни голосом оперного певца. | Sing a chorus in an opera voice.
Станцуй самый нелепый танец за десять секунд (сидя можно). | Dance the silliest dance in ten seconds (seated is fine).
Скажи три слова, которые описывают каждого по кругу, только добрые. | Say three kind words about each person.
Расскажи про свою пятницу голосом героя боевика. | Describe your Friday like an action-movie hero.
Прочитай вслух своё последнее сообщение, которое не личное. | Read aloud your last non-private message.
Озвучь трейлер к жизни соседа слева. | Narrate a trailer for the life of the person on your left.
Покажи свою «сигнатурную» позу уверенности. | Strike your signature confidence pose.
Изобрази рекламу собственной личности на 20 секунд. | Pitch yourself like a product for 20 seconds.
Сделай серьёзное лицо и расскажи самую нелепую историю. | Tell the silliest story with a straight face.
Скажи фразу «я так не делаю» самым убедительным голосом. | Say "I'd never do that" in the most convincing voice.
Покажи фокус или «магический трюк» без реквизита. | Perform a "magic trick" with no props.
Повтори мимику любого из присутствующих, пока остальные не угадают. | Mimic someone's face until they're guessed.
Выбери любой предмет и «продай» его так, будто это мечта. | "Sell" any object as a dream.
Скажи тост, не используя буквы А и О. | Make a toast without using A or O.
Расскажи о неудаче так, чтобы звучало как успех. | Describe a failure as a success.
Сыграй сцену «ссора из-за пиццы» с соседом. | Act a "pizza argument" with a neighbor.
Придумай загадку про компанию. | Make a riddle about the group.
Сделай серьёзное объявление «по громкой связи» на нелепую тему. | Make a serious PA announcement on a silly topic.
Стань на минуту тренером по мотивации. | Be a motivation coach for one minute.
Повтори любую фразу, которую только что сказали, с другой интонацией. | Repeat a line just said in a different tone.
`),
  ...mk('d', 'c', 1, 'Для пары: действия', `
По очереди назовите три маленькие радости недели. | Take turns naming three small joys of the week.
Придумайте свидание с бюджетом, удобным обоим. | Plan a date with a budget you both like.
Вместе нарисуйте дом мечты за минуту. | Draw your dream home together in a minute.
Выберите песню, напоминающую хорошее общее событие. | Pick a song that reminds you of a good shared event.
Каждый предложит один способ облегчить другому завтрашний день. | Each suggests one way to make tomorrow easier.
Составьте список трёх мест рядом, где ещё не были. | List three nearby places you haven't been.
Назовите по одной привычке друг друга, которую цените. | Name one habit of each other that you value.
Придумайте новый рецепт бутерброда вместе. | Invent a new sandwich recipe together.
Если оба согласны, обнимитесь на десять секунд. | If you both agree, hug for ten seconds.
Расскажите друг другу по одному воспоминанию про первую встречу. | Tell one memory each about the first meeting.
Напишите общее «письмо через год» из трёх строк. | Write a shared three-line letter to one year ahead.
Выберите общую шутку на вечер. | Pick a shared joke for tonight.
Сделайте селфи в стиле старого фото. | Take a selfie in an old-photo style.
Придумайте вместе название вашей «семейной банды». | Name your "family crew" together.
Выберите места для следующих трёх выходных. | Pick spots for the next three weekends.
Составьте «меню мечты» из блюд, которые любите оба. | Compose a dream menu from dishes you both love.
Покажите друг другу фото, которое любите больше всего. | Show each other your favorite photo.
Спойте вдвоём две строчки любой песни. | Sing two lines of any song together.
Поблагодарите друг друга за конкретное действие на этой неделе. | Thank each other for a specific action this week.
Напишите друг другу короткое «спасибо» от руки. | Write each other a short handwritten thanks.
Сыграйте 30 секунд молчаливой игры взглядов. | Play 30 seconds of a silent eye contact game.
Придумайте общий «секретный знак» для сигнала «пора домой». | Invent a secret "time to go home" signal.
Если оба согласны, потанцуйте под одну песню. | If both agree, dance to one song.
Выберите шуточный титул для каждого на вечер. | Give each other a playful title for tonight.
`),
  ...mk('f', 'g', 1, 'Добровольные форфейты', `
Следующую фразу скажи голосом диктора. | Say your next line in a narrator voice.
На один ход стань ведущим прогноза настроения. | For one turn, be the mood forecaster.
Придумай шуточный титул себе до конца раунда. | Give yourself a playful title until the end of the round.
Изобрази аплодисменты в замедленной съёмке. | Applaud in slow motion.
Произнеси благодарность стулу за службу. | Thank the chair for its service.
Сочини двухстрочную оду чашке. | Write a two-line ode to a cup.
Представь себя как персонажа сказки. | Introduce yourself as a fairy-tale character.
Дай вечеру оценку в выдуманных единицах. | Rate tonight in made-up units.
Скажи комплимент человеку слева. | Compliment the person on your left.
Пересядь на другое место и объясни, почему там лучше. | Switch seats and explain why it's better.
Изобрази рекламный ролик собственных туфель. | Perform an ad for your shoes.
Говори шёпотом до конца следующего хода. | Whisper until the end of your next turn.
Расскажи следующий ответ как сказку. | Tell your next answer as a fairy tale.
Назови себя по-новому на один круг, например, «Капитан Тишина». | Rename yourself for one round, e.g., "Captain Quiet".
Скажи тост в честь ближайшего предмета. | Make a toast to the nearest object.
Раздай всем по смешному званию на этот круг. | Give everyone a funny rank for this round.
Говори следующую минуту только вопросами. | Speak only in questions for one minute.
Придумай хэштег нашего вечера. | Invent a hashtag for tonight.
Показывай жестами всё, что говоришь, один ход. | Gesture everything you say for one turn.
Выбери следующий вопрос для группы вместо себя. | Pick the next question for the group instead of yourself.
Скажи фразу «это было неожиданно» с серьёзным лицом. | Say "that was unexpected" with a straight face.
Назови трёх людей, которых ценишь, без объяснений. | Name three people you value, no explanations.
Расскажи смешной факт, который знаешь. | Share a fun fact you know.
Придумай новое «правило вечера» на один круг. | Invent a new "rule of the night" for one round.
Скажи спасибо вслух каждому из присутствующих. | Say thank you aloud to everyone present.
Придумай комплимент кому-то, кого нет в комнате. | Compliment someone who isn't in the room.
Произнеси скороговорку три раза. | Say a tongue-twister three times.
Покажи любимый эмодзи без слов. | Act out your favorite emoji.
Скажи «да» любой разумной просьбе соседа на этот круг. | Say "yes" to any reasonable request from a neighbor this round.
Выбери музыку для следующего хода. | Pick the music for the next turn.
Пропусти ход и расскажи, что сделал бы — это тоже ответ. | Skip and tell what you would have done: that counts too.
Поменяйся с соседом вопросом, если оба согласны. | Swap questions with a neighbor if you both agree.
`),
  ...mk('q', 'c', 1, 'На расстоянии (LDR)', `
Какой кусочек моего дня хочешь увидеть через камеру? | Which part of my day do you want to see on camera?
Что стоило бы сделать в одно и то же время, хоть и врозь? | What could we do at the same time, apart?
Какое место в твоём городе покажешь мне первым? | Which place in your city do you show me first?
Какое наше общее воспоминание согревает сегодня? | Which shared memory warms you today?
Что мы сделаем в первый вечер после встречи? | What will we do the first evening we meet?
Какую песню включим вместе и послушаем одновременно? | Which song do we play at the same time?
Что прислать тебе в посылке для улыбки? | What can I send you in a package to make you smile?
Какой ритуал «спокойной ночи» тебе подходит? | Which goodnight ritual suits you?
Что значит «быть рядом» на расстоянии? | What does "being close" mean at a distance?
Какое занятие в звонке не заставляет скучать? | Which call activity never gets boring?
Какие три места в твоём городе хочешь показать вживую? | Which three places do you want to show me in person?
Какой маленький сюрприз можно устроить онлайн? | What small surprise can we do online?
`),
  ...mk('d', 'g', 1, 'Безопасно для эфира', `
Покажи зрителям любимый смайлик жестами. | Show viewers your favorite emoji with gestures.
Выбери в чате одно слово и нарисуй его за десять секунд. | Pick a word from chat and draw it in ten seconds.
Расскажи о своём дне в один твит. | Describe your day in one tweet.
Сделай «минуту похвалы» чату: поблагодари трёх людей. | Praise chat: thank three people.
Придумай название стрима от лица чата. | Name the stream from chat's point of view.
Угадай, что выберет чат: «А» или «Б». | Guess what chat picks: A or B.
Выбери любимый ответ из комментариев и объясни почему. | Pick your favorite comment and explain why.
Сыграй сцену из любимого фильма с предметом. | Act a favorite movie scene with an object.
Расскажи шутку, которую любит чат. | Tell a joke chat likes.
Объясни свою ленту дня тремя эмодзи. | Describe your day in three emojis.
Придумай слоган для канала. | Create a slogan for the channel.
Назови любимое слово чата и используй в трёх предложениях. | Name chat's favorite word and use it in three sentences.
`),
  ...mk('d', 'g', 1, 'Вечер без алкоголя', `
Приготовь «коктейль» без алкоголя из того, что есть, и назови его. | Mix a non-alcoholic "cocktail" from what you have and name it.
Расскажи, чем чай отличается от кофе, как сомелье. | Describe tea vs. coffee like a sommelier.
Устрой дегустацию: что вкуснее — яблоко или груша? | Run a tasting: apple or pear?
Угадай напиток с закрытыми глазами. | Guess a drink with eyes closed.
Придумай тост за кого-то, кто сегодня не с нами. | Toast someone who isn't with us tonight.
Расскажи, какую музыку ставишь к чаю. | Say what music you play with tea.
Выбери «напиток вечера» для группы голосованием. | Vote for the "drink of the night".
Опиши идеальную тишину так, чтобы стало смешно. | Describe perfect silence in a funny way.
`),
];
