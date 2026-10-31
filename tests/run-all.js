// Запуск всех проверок: node tests/run-all.js [--unit | --ui]
const { spawn } = require('child_process'); const path = require('path');
const fs = require('fs'); const os = require('os');
const captureDir = process.env.TEST_CAPTURE_FILES === '1' ? fs.mkdtempSync(path.join(os.tmpdir(), 'askme-tests-')) : null;
const UNIT = ['deck', 'ai', 'ai-worker', 'analytics-logic', 'punishment-logic', 'sound', 'topics-logic', 'turn-queue', 'reel-and-queue', 'live-logic', 'content', 'update', 'session-io', 'tod-rules', 'history', 'tod-model', 'tod-cards', 'tod-deck', 'tod-engine', 'tod-talk-titles', 'tod-channel', 'tod-pause', 'i18n', 'version'].map(n => ({ name: 'unit/' + n, file: `unit/${n}.test.js`, env: {} }));
const UI = [
  ['game', {}], ['timer', {}], ['modes', { FLOW: 'hard' }], ['modes', { FLOW: 'normal' }], ['modes', { FLOW: 'admin' }], ['results', {}],
  ['menu', { FLOW: 'player' }], ['menu', { FLOW: 'admin' }], ['punishment-templates', { FLOW: 'player' }], ['punishment-templates', { FLOW: 'admin' }],
  ['analytics', { FLOW: 'player' }], ['analytics', { FLOW: 'optout' }], ['analytics', { FLOW: 'admin' }], ['audit-regressions', {}],
  ['hidden-questions', { FLOW: 'player' }], ['hidden-questions', { FLOW: 'admin' }], ['question-form', {}], ['card-effects', {}], ['live', {}], ['live-lifecycle', {}], ['live-hard', {}], ['live-admin', {}], ['live-resume', {}], ['live-pause', {}], ['tod-pause-live', {}], ['quick-ui', { FLOW: 'player' }], ['quick-ui', { FLOW: 'admin' }], ['analytics-partial', {}], ['about-legal', {}], ['invite-join', {}], ['live-invite', {}], ['cloud-payload', {}], ['live-solo-timeout', {}], ['game-resume', {}], ['id-login', {}], ['invite-share', {}], ['live-cap', {}], ['resume-guard', {}], ['ui-polish', {}], ['scroll-top', {}], ['tod-cards-load', {}],
  ['i18n-uk', { FLOW: 'player' }], ['i18n-uk', { FLOW: 'admin' }], ['i18n-en', { FLOW: 'player' }], ['i18n-en', { FLOW: 'admin' }], ['tod-archive', { FLOW: 'player' }], ['tod-archive', { FLOW: 'offline' }], ['tod-archive', { FLOW: 'admin' }], ['tod-admin', {}], ['desktop', {}], ['history', {}], ['tod-lobby', {}], ['tod-game', {}], ['tod-results', {}], ['tod-live', {}], ['pause', {}], ['tod-resume', {}], ['intro', {}], ['home-players', {}]
].map(([n, env]) => ({ name: `ui/${n}${env.FLOW ? ' [' + env.FLOW + ']' : ''}`, file: `ui/${n}.test.js`, env }));
const only = process.argv[2]; const jobs = only === '--unit' ? UNIT : only === '--ui' ? UI : [...UNIT, ...UI];
const run = (job) => new Promise((resolve) => {
  const t0 = Date.now(); let out = '';
  const logFile = captureDir && path.join(captureDir, job.name.replace(/[^a-z0-9]/gi, '_') + '.log');
  const fd = logFile ? fs.openSync(logFile, 'w') : null;
  const p = spawn(process.execPath, [path.join(__dirname, job.file)], { env: { ...process.env, ...job.env }, cwd: __dirname, ...(fd !== null ? { stdio: ['ignore', fd, fd] } : {}) });
  const timer = setTimeout(() => { out += '\nFAIL таймаут 240 с\n'; p.kill('SIGKILL'); }, 240000);
  p.stdout?.on('data', d => out += d); p.stderr?.on('data', d => { if (!/Not implemented/.test(String(d))) out += d; });
  p.on('error', error => { out += '\nFAIL subprocess: ' + error.message + '\n'; });
  p.on('close', (code, signal) => { clearTimeout(timer); if (fd !== null) { fs.closeSync(fd); out += fs.readFileSync(logFile, 'utf8').split('\n').filter(line => !line.includes('Error: Not implemented:')).join('\n'); } const lines = out.split('\n'); const pass = lines.filter(l => l.startsWith('PASS')).length; const fail = lines.filter(l => l.startsWith('FAIL') || l.includes('TEST CRASH') || l.includes('Error:')).length;
    const m = out.match(/captured runtime errors: (\d+)/); const rte = m ? Number(m[1]) : 0; resolve({ job, pass, fail, rte, out, ms: Date.now() - t0, ok: code === 0 && !signal && fail === 0 && rte === 0 && pass > 0 }); });
});
(async () => {
  const results = []; const queue = [...jobs]; const workers = Array.from({ length: Math.min(4, queue.length) }, async () => { while (queue.length) { const j = queue.shift(); const r = await run(j); results.push(r); console.log(`${r.ok ? '✔' : '✘'} ${j.name}  (${r.pass} проверок, ${(r.ms / 1000).toFixed(0)} с)`); } });
  await Promise.all(workers);
  const bad = results.filter(r => !r.ok); const total = results.reduce((a, r) => a + r.pass, 0);
  bad.forEach(r => { console.log(`\n--- ${r.job.name} ---`); console.log(r.out.split('\n').filter(l => l.startsWith('FAIL') || l.includes('CRASH') || l.includes('errors') || l.includes('Error')).join('\n')); });
  console.log(`\nИтого: ${results.length - bad.length}/${results.length} наборов пройдено, ${total} проверок.`);
  if (captureDir) { if (bad.length) console.log('Журналы: ' + captureDir); else fs.rmSync(captureDir, { recursive: true, force: true }); }
  process.exit(bad.length ? 1 : 0);
})();
