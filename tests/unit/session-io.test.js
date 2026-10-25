const assert = require('node:assert/strict');
(async () => {
  const { createSessionTasks, createSessionStore, createLiveWriter, mergeTurnHistories } = await import('../../src/session-io.js');
  const tasks = createSessionTasks(); let finish; const order = [];
  const write = tasks.run('a', async () => { order.push('write-start'); await new Promise(r => { finish = r; }); order.push('write-end'); });
  await Promise.resolve();
  const stop = tasks.stop('a').then(() => order.push('delete'));
  assert.equal(await tasks.run('a', () => order.push('unexpected')), false);
  finish(); await Promise.all([write, stop]);
  assert.deepEqual(order, ['write-start', 'write-end', 'delete']);
  assert.equal(await tasks.run('b', () => true), true);
  console.log('PASS deletion drains active writes, blocks future writes and preserves other sessions');

  let remote = { payload: JSON.stringify({ updatedAt: 10, players: [] }), updatedAt: 10 }, revision = 1;
  let reads = 0, puts = 0;
  const response = (data, status = 200) => ({ ok: status === 200, status, headers: { get: () => '"' + revision + '"' }, json: async () => data });
  const request = async (url, options = {}) => {
    if (!options.method) { reads++; return response(remote); }
    puts++;
    if (options.headers['If-Match'] !== '"' + revision + '"') return response(null, 412);
    remote = JSON.parse(options.body); revision++; return response(remote);
  };
  const store = createSessionStore({ request, urlFor: async () => '/session', encrypt: async p => JSON.stringify(p), decrypt: async p => JSON.parse(p), maxPayload: 59000 });
  const profile = { sessionKey: 'k', players: [], updatedAt: 11 };
  assert.equal((await store.hydrate(profile)).updatedAt, 10);
  await Promise.all([store.save(profile), store.save({ ...profile, updatedAt: 12 })]);
  assert.equal(reads, 1); assert.equal(remote.updatedAt, 12);
  console.log('PASS profile writes are serialized and use the last acknowledged server ETag');
  revision++; remote.updatedAt = 100;
  await assert.rejects(store.save({ ...profile, updatedAt: 13 }), /cloud-conflict/);
  const attempts = puts;
  await assert.rejects(store.save({ ...profile, updatedAt: 14 }), /cloud-conflict/);
  assert.equal(puts, attempts); assert.equal(remote.updatedAt, 100);
  console.log('PASS concurrent remote edits are preserved and subsequent blind saves are blocked');
  store.forget('k'); remote = { deleted: true, payload: '', updatedAt: 101 };
  await assert.rejects(store.hydrate(profile), /session-deleted/);
  console.log('PASS a deleted server session cannot be hydrated or silently recreated');

  let liveRevision = 1;
  let live = { ver: 1, gid: 'game', hist: '{}', idx: 0, max: 0 };
  const liveRequest = async (url, options = {}) => {
    const snapshot = structuredClone(live), etag = '"' + liveRevision + '"';
    const reply = status => ({ ok: status === 200, status, headers: { get: () => etag }, json: async () => snapshot });
    if (!options.method) return reply(200);
    assert.equal(options.method, 'PUT'); // RTDB rejects conditional PATCH.
    if (options.headers['If-Match'] !== etag) return reply(412);
    live = { ...live, ...JSON.parse(options.body) }; liveRevision++;
    return reply(200);
  };
  const writer = createLiveWriter({ request: liveRequest, mergeHistory: (a, b) => JSON.stringify(mergeTurnHistories(JSON.parse(a), JSON.parse(b))) });
  const entry = (cur, answered) => ({ cur, answered, skippedBy: [], skippedAll: false });
  await Promise.all([
    writer('/room', 'PATCH', { ver: 2.1, hist: JSON.stringify({ 0: entry('p2', ['p1']) }), idx: 0, max: 0 }, { gid: 'game' }),
    writer('/room', 'PATCH', { ver: 2.2, hist: JSON.stringify({ 0: entry('p1', ['p2']) }), idx: 0, max: 0 }, { gid: 'game' })
  ]);
  assert.deepEqual(JSON.parse(live.hist)[0].answered.sort(), ['p1', 'p2']);
  assert.equal(JSON.parse(live.hist)[0].cur, null);
  assert(live.ver > 2.2);
  console.log('PASS concurrent live writes retry conditional conflicts and retain both player actions');
  const olderRemote = { 0: entry(null, ['p1', 'p2']), 1: entry('p2', ['p1']) };
  live.hist = JSON.stringify(olderRemote); liveRevision++;
  await writer('/room', 'PATCH', { ver: 100, hist: JSON.stringify({ 0: entry(null, ['p1', 'p2']) }), idx: 0, max: 1 }, { gid: 'game' });
  assert.deepEqual(JSON.parse(live.hist)[1], olderRemote[1]);
  console.log('PASS reconnecting with a higher local version also retains lower-version remote actions');
  const stale = await writer('/room', 'PATCH', { ver: 4, hist: '{}' }, { gid: 'old-game' });
  assert.equal(stale.ok, false);
  live.deleted = true;
  assert.equal((await writer('/room', 'PATCH', { ver: 4, hist: '{}' }, { gid: 'game' })).ok, false);
  console.log('PASS stale game commands and deleted rooms cannot be republished');
})().catch(error => { console.error('FAIL', error); process.exitCode = 1; });
