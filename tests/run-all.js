// Запуск всех проверок: node tests/run-all.js [--unit | --ui]
const { spawn } = require('child_process'); const path = require('path');
const UNIT = ['deck', 'analytics-logic', 'punishment-logic', 'sound', 'topics-logic', 'turn-queue', 'reel-and-queue', 'live-logic', 'content', 'update', 'tod-rules', 'tod-model', 'tod-cards'].map(n => ({ name: 'unit/' + n, file: `unit/${n}.test.js`, env: {} }));
const UI = [
  ['game', {}], ['timer', {}], ['modes', { FLOW: 'hard' }], ['modes', { FLOW: 'normal' }], ['modes', { FLOW: 'admin' }], ['results', {}],
  ['menu', { FLOW: 'player' }], ['menu', { FLOW: 'admin' }], ['punishment-templates', { FLOW: 'player' }], ['punishment-templates', { FLOW: 'admin' }],
  ['analytics', { FLOW: 'player' }], ['analytics', { FLOW: 'optout' }], ['analytics', { FLOW: 'admin' }],
  ['hidden-questions', { FLOW: 'player' }], ['hidden-questions', { FLOW: 'admin' }], ['question-form', {}], ['card-effects', {}], ['live', {}], ['live-lifecycle', {}], ['live-hard', {}], ['live-admin', {}], ['live-resume', {}], ['quick-ui', { FLOW: 'player' }], ['quick-ui', { FLOW: 'admin' }], ['analytics-partial', {}], ['about-legal', {}], ['invite-join', {}], ['live-invite', {}], ['cloud-payload', {}], ['live-solo-timeout', {}], ['game-resume', {}], ['id-login', {}], ['invite-share', {}], ['live-cap', {}], ['resume-guard', {}], ['ui-polish', {}], ['tod-cards-load', {}],
  ['tod-archive', { FLOW: 'player' }], ['tod-archive', { FLOW: 'offline' }], ['tod-archive', { FLOW: 'admin' }], ['tod-admin', {}]
].map(([n, env]) => ({ name: `ui/${n}${env.FLOW ? ' [' + env.FLOW + ']' : ''}`, file: `ui/${n}.test.js`, env }));
const only = process.argv[2]; const jobs = only === '--unit' ? UNIT : only === '--ui' ? UI : [...UNIT, ...UI];
const run = (job) => new Promise((resolve) => {
  const t0 = Date.now(); let out = '';
  const p = spawn(process.execPath, [path.join(__dirname, job.file)], { env: { ...process.env, ...job.env }, cwd: __dirname });
  const timer = setTimeout(() => { out += '\nFAIL таймаут 240 с\n'; p.kill('SIGKILL'); }, 240000);
  p.stdout.on('data', d => out += d); p.stderr.on('data', d => { if (!/Not implemented/.test(String(d))) out += d; });
  p.on('close', () => { clearTimeout(timer); const lines = out.split('\n'); const pass = lines.filter(l => l.startsWith('PASS')).length; const fail = lines.filter(l => l.startsWith('FAIL') || l.includes('TEST CRASH') || l.includes('Error:')).length;
    const m = out.match(/captured runtime errors: (\d+)/); const rte = m ? Number(m[1]) : 0; resolve({ job, pass, fail, rte, out, ms: Date.now() - t0, ok: fail === 0 && rte === 0 && pass > 0 }); });
});
(async () => {
  const results = []; const queue = [...jobs]; const workers = Array.from({ length: Math.min(4, queue.length) }, async () => { while (queue.length) { const j = queue.shift(); const r = await run(j); results.push(r); console.log(`${r.ok ? '✔' : '✘'} ${j.name}  (${r.pass} проверок, ${(r.ms / 1000).toFixed(0)} с)`); } });
  await Promise.all(workers);
  const bad = results.filter(r => !r.ok); const total = results.reduce((a, r) => a + r.pass, 0);
  bad.forEach(r => { console.log(`\n--- ${r.job.name} ---`); console.log(r.out.split('\n').filter(l => l.startsWith('FAIL') || l.includes('CRASH') || l.includes('errors') || l.includes('Error')).join('\n')); });
  console.log(`\nИтого: ${results.length - bad.length}/${results.length} наборов пройдено, ${total} проверок.`);
  process.exit(bad.length ? 1 : 0);
})();
