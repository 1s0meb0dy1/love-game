// Оглавление и обложка. Главы подключаются по мере готовности.
import c00 from './c00.mjs';
import c01 from './c01.mjs';
import c02 from './c02.mjs';
import c03 from './c03.mjs';
import c04 from './c04.mjs';
import c05 from './c05.mjs';
import c06 from './c06.mjs';
import c07 from './c07.mjs';
import c08 from './c08.mjs';
import c09 from './c09.mjs';
import c10 from './c10.mjs';
import c11 from './c11.mjs';
import c12 from './c12.mjs';
import c13 from './c13.mjs';
import c14 from './c14.mjs';
import c15 from './c15.mjs';
import c16 from './c16.mjs';
import c17 from './c17.mjs';
import c18 from './c18.mjs';
import c19 from './c19.mjs';
import c20 from './c20.mjs';
import c21 from './c21.mjs';
import c22 from './c22.mjs';
import c23 from './c23.mjs';
import c24 from './c24.mjs';

export const hero = {
  tag: 'Сверено со старым файлом от 30.10.2026 · данные на 31.10.2026',
  wordmark: 'Ask Me',
  title: 'Атлас без иллюзий: рынок, деньги, закон и первые 12 недель',
  lead: 'Всё, что нашлось по вашему промту: **240 проверенных названий**, живые данные Semrush и vidIQ по 8 рынкам, карточки конкурентов из Google Play, первоисточники по праву Украины и ЕС и построчная сверка со старым файлом. Каждое утверждение помечено: где факт, где модель, а где мы честно не знаем.',
  meta: [['Дата', '31.10.2026'], ['Источники', 'Semrush · vidIQ · Legal Data Hunter · Google Play · RDAP · Vercel и GoDaddy'], ['Не получено', 'Similarweb: лимит кредитов']],
  bento: [
    { big: '233/240', label: 'названий с уже занятым .com', sub: 'Реестр Verisign: свободны только 7. Односложный .com — не вариант.', tone: 'rose', ev: 'fact' },
    { big: '74 000', unit: '/мес', label: 'запросов «truth or dare questions» в США', sub: 'Semrush. Спрос на «вопросы» в 1,5 раза выше, чем на «truth or dare» (49 500).', tone: 'sky', ev: 'fact' },
    { big: '$0,02', label: 'CPC главных запросов ниши', sub: 'Реклама в поиске почти не стоит денег — и почти не приносит: бить надо SEO.', tone: 'lemon', ev: 'fact' },
    { big: '8,6 млн', label: 'просмотров одного рилса у приложения с 47 тыс. подписчиков', sub: 'vidIQ, окт. 2026. Social Gamebox: анимированное объяснение правил, 819× от медианы автора.', tone: 'orchid', ev: 'fact' },
    { big: '$5/нед', label: 'на чём горит лидер рынка', sub: 'Picolo: подписка вместо разовых $9; одна жалоба собрала 69 «полезно».', tone: 'ember', ev: 'fact' },
    { big: '0 %', label: 'комиссия Apple на покупки по ссылке в США (пока)', sub: 'Итог Epic v. Apple; ставка не установлена, Apple предлагает 15 %.', tone: 'mint', ev: 'src' },
  ],
  footer: ['ASK ME · Strategy Atlas 2026 · собран 31.10.2026', 'Не юридическая и не налоговая консультация: проверьте у бухгалтера и юриста.'],
};

export const chapters = [c00, c01, c02, c03, c04, c05, c06, c07, c08, c09, c10, c11, c12, c13, c14, c15, c16, c17, c18, c19, c20, c21, c22, c24, c23];
