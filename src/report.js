// Отправка сбоев в Sentry (проект ask-me-web, регион DE) без SDK: игра весит мало, а так видно, что именно уходит.
// Уходит только: тип ошибки, сообщение до 160 знаков (ID сессии из 8 знаков заменяются на [id]), «файл:строка» из стека,
// версия приложения и имя экрана без параметров. Тексты вопросов и ответов, имена игроков, ID сессии и ключи не отправляются.
// Не отправляется: с localhost и file://, при включённом «Не отслеживать» (DNT), без сети. Не больше 5 сбоев за визит.
const DSN = 'https://9ad7a0b1f256b2058b24e3dc656fa93d@o4512352312688640.ingest.de.sentry.io/4512352618479696';
const MAX_EVENTS = 5;

export const parseDsn = (dsn) => {
  const m = /^https:\/\/([0-9a-f]+)@([^/]+)\/(\d+)$/.exec(String(dsn));
  return m ? { key: m[1], host: m[2], project: m[3] } : null;
};

// «#/play?x=1» → «/play»: без параметров, чтобы в адрес не попали ID сессии и приглашения.
export const routeOf = (hash) => { const m = /^#(\/[a-z-]*)/.exec(String(hash || '')); return m ? m[1] : '/'; };

export const scrub = (text) => String(text == null ? '' : text).replace(/\b[A-Z0-9]{8}\b/g, '[id]').replace(/https?:\/\/\S+/g, (u) => u.split(/[?#]/)[0]).slice(0, 160);

// Стек браузера (Chrome: «at f (url:1:2)», Safari/Firefox: «f@url:1:2») → кадры Sentry: старые сверху, только имя файла.
export const framesOf = (stack) => String(stack || '').split('\n').map((line) => {
  const m = /(?:at\s+(?:(.*?)\s+\()?|^(.*?)@)(?:https?:\/\/[^/]+)?([^\s()]*?):(\d+):(\d+)\)?\s*$/.exec(line.trim());
  return m ? { function: scrub(m[1] || m[2] || '?'), filename: (m[3] || '').split('?')[0], lineno: Number(m[4]), colno: Number(m[5]) } : null;
}).filter(Boolean).reverse().slice(-30);

const hex = (n, rnd) => Array.from({ length: n }, () => Math.floor(rnd() * 16).toString(16)).join('');

export const buildEvent = ({ error, release, route, standalone, now = Date.now(), rnd = Math.random }) => {
  const e = error && typeof error === 'object' ? error : { name: 'Error', message: String(error) };
  return {
    event_id: hex(32, rnd), timestamp: now / 1000, platform: 'javascript', level: 'error', release: 'ask-me@' + release, environment: 'production',
    exception: { values: [{ type: scrub(e.name || 'Error'), value: scrub(e.message), mechanism: { type: 'generic', handled: false }, stacktrace: { frames: framesOf(e.stack) } }] },
    tags: { route, standalone: standalone ? 'yes' : 'no' },
  };
};

export const buildEnvelope = (event, dsn = DSN, now = Date.now()) =>
  [JSON.stringify({ event_id: event.event_id, sent_at: new Date(now).toISOString(), dsn }), JSON.stringify({ type: 'event' }), JSON.stringify(event)].join('\n');

export const canReport = (win) => {
  try {
    const { protocol, hostname } = win.location;
    if (protocol !== 'https:' || /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(hostname)) return false;
    if (win.navigator.doNotTrack === '1' || win.doNotTrack === '1') return false;
    return win.navigator.onLine !== false;
  } catch (e) { return false; }
};

export const installReporter = (win, release, send) => {
  const target = parseDsn(DSN); let sent = 0; const seen = new Set();
  if (!target) return false;
  const post = send || ((url, body) => win.fetch(url, { method: 'POST', body, keepalive: true, mode: 'cors', credentials: 'omit', headers: { 'Content-Type': 'text/plain;charset=UTF-8' } }));
  const report = (error) => {
    try {
      if (sent >= MAX_EVENTS || !canReport(win)) return;
      const event = buildEvent({ error, release, route: routeOf(win.location.hash), standalone: win.navigator.standalone === true });
      const key = event.exception.values[0].type + event.exception.values[0].value; if (seen.has(key)) return; seen.add(key); sent += 1;
      const url = `https://${target.host}/api/${target.project}/envelope/?sentry_key=${target.key}&sentry_version=7`;
      Promise.resolve(post(url, buildEnvelope(event))).catch(() => {});
    } catch (e) { /* отчёт о сбое не должен сам ломать игру */ }
  };
  win.addEventListener('error', (ev) => report(ev.error || { name: 'Error', message: ev.message }));
  win.addEventListener('unhandledrejection', (ev) => report(ev.reason || { name: 'UnhandledRejection', message: 'rejection' }));
  return report;
};
