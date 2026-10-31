// Чистая логика живой игры: версии без совпадений между устройствами, учёт «живых» устройств, ограничение размера истории.
const src = require('../src-loader.js')(); const g = (re) => { const m = src.match(re); if (!m) throw new Error('не найдено: ' + re); return m[0]; };
const consts = g(/const MAX_PLAYERS = [^\n]*\n/) + g(/const LIVE_POLL_MS = [^\n]*\n/);
const f = new Function(consts + g(/const liveHash = [^\n]*\n/) + g(/const liveFrac = [^\n]*\n/) + g(/const liveVerNext = [^\n]*\n/) + g(/const liveVerStart = [^\n]*\n/) + g(/const liveDeckKey = [^\n]*\n/) + g(/const AWAY_PREFIX = [^\n]*\n/) + g(/const liveAwayKey = [^\n]*\n/) + g(/const liveAwayParse = [^\n]*\n/) + g(/const liveAlive = [\s\S]*?\n        \};\n/) + g(/const liveHistStr = [\s\S]*?\n        \};\n/) +
  'return {liveHash,liveFrac,liveVerNext,liveVerStart,liveDeckKey,liveAlive,liveAwayKey,liveAwayParse,liveHistStr,LIVE_ALIVE_MS,LIVE_STALE_MS,LIVE_MAX_DEVICES,LIVE_SOLO_MS,LIVE_JOIN_WAIT_MS,LIVE_TAKEOVER_S,LIVE_TAKEOVER_STEP_S,LIVE_BEAT_MS};', )();
const MAX = Number((src.match(/const MAX_PLAYERS = (\d+)/) || [])[1]);
const res = []; const T = (n, c) => res.push((c ? 'PASS ' : 'FAIL ') + n);

T('лимит устройств равен числу игроков (' + MAX + ') и это 10', MAX === 10 && f.LIVE_MAX_DEVICES === MAX);
// версии: у разных устройств никогда не совпадают, всегда растут
const ids = Array.from({ length: 200 }, (_, i) => 'dev' + i.toString(36) + Math.random().toString(36).slice(2, 8));
const fr = ids.map(f.liveFrac); T('дробная часть версии лежит в (0;1]', fr.every(x => x > 0 && x <= 1));
let collide = 0, notGrow = 0; for (let k = 0; k < 50; k++) { const prev = Math.floor(Math.random() * 1000); const vs = ids.slice(0, 10).map(id => f.liveVerNext(prev, id)); if (new Set(vs).size !== vs.length) collide++; if (vs.some(v => v <= prev)) notGrow++; }
T('версии, выпущенные 10 разными устройствами от одной предыдущей, не совпадают (50 испытаний)', collide === 0);
T('новая версия всегда больше предыдущей', notGrow === 0);
T('следующая версия после любой дробной всегда больше (последовательные записи одного устройства растут)', (() => { let v = 0; for (let i = 0; i < 500; i++) { const n = f.liveVerNext(v, ids[i % ids.length]); if (!(n > v)) return false; v = n; } return true; })());
const dup = (() => { const seen = new Map(); ids.forEach(id => { const k = f.liveFrac(id); seen.set(k, (seen.get(k) || 0) + 1); }); return [...seen.values()].filter(c => c > 1).length; })();
T('200 случайных идентификаторов практически не делят одну дробную часть (совпадений: ' + dup + ')', dup <= 1);

// живые устройства
const now = 1_000_000_000; const p = { me: now - 1000, a: now - 5000, b: now - f.LIVE_ALIVE_MS - 1, c: now - f.LIVE_STALE_MS - 1, d: 'мусор', e: now };
const r = f.liveAlive(p, now, 'me');
T('«живые» — те, чья отметка свежее 30 с (включая себя)', r.alive.sort().join() === ['a', 'e', 'me'].sort().join());
T('«другие» — живые без меня', r.others.sort().join() === 'a,e');
T('устаревшими считаются отметки старше 120 с и нечисловые; промежуточные не считаются живыми, но и не удаляются', r.stale.sort().join() === 'c,d' && !r.alive.includes('b') && !r.stale.includes('b'));
T('пустые и неверные данные не ломают подсчёт', f.liveAlive(null, now, 'me').alive.length === 0 && f.liveAlive('x', now, 'me').alive.length === 0 && f.liveAlive([], now, 'me').alive.length === 0);
T('10 живых устройств = лимит, на одно больше уже не пускаем', (() => { const q = {}; for (let i = 0; i < 10; i++) q['d' + i] = now; return f.liveAlive(q, now, 'new').others.length >= f.LIVE_MAX_DEVICES; })());
T('9 живых — ещё можно войти десятым', (() => { const q = {}; for (let i = 0; i < 9; i++) q['d' + i] = now; return f.liveAlive(q, now, 'new').others.length < f.LIVE_MAX_DEVICES; })());

// история ходов не превышает предел правил базы (30000 знаков)
const mk = (n) => { const h = {}; for (let i = 0; i < n; i++) h[i] = { cur: 'p' + (i % 10), answered: ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9'], skippedBy: ['p3'], skippedAll: false, dev: 'dev-abcdef1234' }; return h; };
const small = mk(20), big = mk(400);
T('короткая история остаётся без изменений', f.liveHistStr(small) === JSON.stringify(small));
const bs = f.liveHistStr(big); T('длинная история укорачивается до ≤ 28000 знаков (было ' + JSON.stringify(big).length + ', стало ' + bs.length + ') — с запасом до предела базы 30000', JSON.stringify(big).length > 30000 && bs.length <= 28000 && JSON.parse(bs) !== null);
const kept = Object.keys(JSON.parse(bs)).map(Number); T('отбрасываются самые старые ходы, свежие сохраняются', kept.length > 0 && Math.max(...kept) === 399 && Math.min(...kept) > 0);
T('хеш состояния различает разные позиции', f.liveHash(1, 1, '{}') !== f.liveHash(2, 2, '{}') && f.liveHash(1, 1, '{}') === f.liveHash(1, 1, '{}'));
// колода партии: в комнате лежит только «отпечаток» (число вопросов + хеш), сам список — в отдельном узле без жёсткого лимита одной записи
const deck = Array.from({ length: 2400 }, (_, i) => 'q' + i.toString(36) + 'x'.repeat(i % 7));
const dkA = f.liveDeckKey(deck.join(',')), dkB = f.liveDeckKey(deck.slice().reverse().join(',')), dkC = f.liveDeckKey(deck.slice(0, 2399).join(','));
T('отпечаток колоды стабилен, начинается с числа вопросов и короткий (' + dkA + ')', dkA === f.liveDeckKey(deck.join(',')) && /^2400-[0-9a-z]+$/.test(dkA) && dkA.length < 20);
T('отпечаток различает другой порядок и другое число вопросов', dkA !== dkB && dkA !== dkC);
T('колода в 2400 вопросов (больше, чем в настоящей базе — около 1800) не упирается в лимит записи комнаты: в комнате лишь отпечаток', deck.join(',').length > 12000 && dkA.length < 40);
// версия первой записи новой партии не совпадает с версиями прошлых партий (иначе устройства из старой партии не заметили бы перехода)
T('версия новой партии выше версий прошлой, даже если за 5 минут в той было 300 обновлений (по обновлению в секунду — заведомо больше, чем бывает)', (() => { const t0 = 1_800_000_000_000; let v = f.liveVerStart('devA', t0); for (let i = 0; i < 300; i++) v = f.liveVerNext(v, 'devA'); return f.liveVerStart('devA', t0 + 5 * 60 * 1000) > v; })());
T('и никогда не совпадает с версией прошлой партии того же устройства (раньше счётчик начинался с 1 и мог её повторить)', (() => { const t0 = 1_800_000_000_000; for (let k = 1; k < 400; k++) { let v = f.liveVerStart('devA', t0); for (let i = 0; i < k; i++) v = f.liveVerNext(v, 'devA'); if (f.liveVerStart('devA', t0 + 120_000) === v) return false; } return true; })());
T('версия новой партии — обычное число, которое база принимает (конечное, с дробной частью, без потери точности)', (() => { const v = f.liveVerStart('devA', 1_800_000_000_000); return Number.isFinite(v) && v % 1 !== 0 && Math.abs(v - f.liveVerStart('devA', 1_800_000_000_000)) < 1e-9 && v < 2 ** 50; })());
T('ожидания: хозяин-одиночка заглядывает во вторую очередь не реже раза в 3 с, гость ждёт хозяина не меньше 10 с', f.LIVE_SOLO_MS <= 3000 && f.LIVE_JOIN_WAIT_MS >= 10000);
T('очередь подхвата таймера: шаг между устройствами больше периода опроса (4 с > 1 с), первое срабатывает не раньше 6 с', f.LIVE_TAKEOVER_STEP_S >= 3 && f.LIVE_TAKEOVER_S >= 5);
T('отметка «я здесь» чаще, чем срок «живости» (8 с < 30 с, запас на сбой сети)', f.LIVE_BEAT_MS * 3 < f.LIVE_ALIVE_MS);
// «отошёл»: ключи away~<устройство>~<время ухода> в тех же отметках присутствия (правила базы не меняются: значение — число ≥ 0)
{
  const k = f.liveAwayKey('ab12', now - 5000);
  T('ключ «отошёл» разбирается обратно: устройство и время ухода', k === 'away~ab12~' + (now - 5000) && JSON.stringify(f.liveAwayParse(k)) === JSON.stringify({ id: 'ab12', since: now - 5000 }) && f.liveAwayParse('away~x') === null && f.liveAwayParse('ab12') === null);
  const q = { me: now, d1: now - 2000, [k]: now - 1000 };
  const r2 = f.liveAlive(q, now, 'me');
  T('«отошёл» не считается устройством в игре и даёт паузу (away: устройство, ключ, время ухода)', r2.alive.length === 2 && r2.others.length === 1 && r2.away.length === 1 && r2.away[0].id === 'ab12' && r2.away[0].key === k && r2.away[0].since === now - 5000);
  T('метка «отошёл» старше 30 с не держит паузу (закрыл вкладку или пропал интернет — устройство исключено)', f.liveAlive({ [k]: now - 31000 }, now, 'me').away.length === 0);
  T('метка старше 2 минут уходит в уборку (stale)', f.liveAlive({ [k]: now - 130000 }, now, 'me').stale.includes(k));
  T('значение 0 («продолжить без них») — не пауза, метка убирается', (() => { const z = f.liveAlive({ [k]: 0 }, now, 'me'); return z.away.length === 0 && z.stale.includes(k); })());
  T('испорченный ключ away~… и нечисловое значение — в уборку', (() => { const z = f.liveAlive({ 'away~bad': now, [k]: 'x' }, now, 'me'); return z.away.length === 0 && z.stale.length === 2; })());
  T('несколько ушедших: все в away, живых устройств без них', f.liveAlive({ me: now, [f.liveAwayKey('aa', now - 9000)]: now, [f.liveAwayKey('bb', now - 3000)]: now - 4000 }, now, 'me').away.length === 2);
}
console.log(res.join('\n')); console.log('--- captured runtime errors: 0');
