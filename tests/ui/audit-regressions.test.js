const makeEnv = require('../harness.js');
const assert = require('node:assert/strict');
const KEY = 'AAAAAAAAAAAAAAAAAAAAAA';
const profile = (name, updatedAt = 1) => ({ sessionId: 'ABCD2345', sessionKey: KEY, players: [{ id: 'p1', name, gender: 'guy' }, { id: 'p2', name: 'B', gender: 'girl' }], archivedIds: [], disabledIds: [], savedGame: null, updatedAt, joinAt: Date.now() });
function env(p) {
  const E = makeEnv(); E.w.scrollTo = () => {};
  if (p) E.w.localStorage.setItem('askme_device_profile_v4', JSON.stringify(p));
  E.code = E.code.replace('if (PUBLIC_SCREENS.includes(screen)) {', 'globalThis.__audit = { profile, setProfile, handleDeleteMyData, startWithMode, handleFinishGame, syncSessionToCloud, openEditScreen, editForm, executeSaveEdit, useCloudProfile, isAdmin }; if (PUBLIC_SCREENS.includes(screen)) {');
  E.code += ';globalThis.__ct = { encryptSessionAES, decryptSessionAES, sessionDbKey, Auth, questionTarget, questionAudienceKey };';
  return E;
}
const ok = (data, etag = '"1"') => ({ ok: true, status: 200, headers: { get: () => etag }, json: async () => data });
(async () => {
  let E;
  try {
    E = env(); const base = E.w.fetch; let offline = true;
    E.w.fetch = (url, opt) => String(url).includes('/questions') && offline ? Promise.reject(new Error('offline')) : base(url, opt);
    E.w.eval(E.code); await E.sleep(180);
    assert(E.has('Повторить загрузку')); assert(!E.has('Синхронизация...'));
    offline = false; await E.click('Повторить загрузку', 300); assert(E.D.querySelector('input'));
    console.log('PASS first-load network failure exits the spinner; retry recovers onboarding'); E.w.close();

    E = env(); E.w.eval(E.code); await E.sleep(80);
    const cloud = { payload: await E.w.__ct.encryptSessionAES(profile('CLOUD NEW', 100), KEY), updatedAt: 100 };
    const path = await E.w.__ct.sessionDbKey(KEY); E.w.close();
    E = env(profile('LOCAL OLD')); const base2 = E.w.fetch; const writes = [];
    E.w.fetch = async (url, opt = {}) => {
      if (!String(url).includes('/sessions/' + path + '.json')) return base2(url, opt);
      if (!opt.method) { await E.sleep(800); return ok(cloud); }
      writes.push(JSON.parse(opt.body)); return ok(null, '"2"');
    };
    E.w.eval(E.code); await E.sleep(450); assert.equal(writes.length, 0);
    await E.sleep(900); assert.equal(E.w.__audit.profile.players[0].name, 'CLOUD NEW');
    if (writes.length) assert.equal((await E.w.__ct.decryptSessionAES(writes[0].payload, KEY)).players[0].name, 'CLOUD NEW');
    console.log('PASS slow hydration completes before the first cloud write and preserves newer cloud names'); E.w.close();

    E = env(profile('LOCAL OLD')); E.w.history.replaceState(null, '', '#/profile');
    const conflictBase = E.w.fetch; const conflictWrites = [];
    E.w.fetch = async (url, options = {}) => {
      if (!String(url).includes('/sessions/' + path + '.json')) return conflictBase(url, options);
      if (!options.method) { await E.sleep(500); return ok(cloud); }
      conflictWrites.push(options.body); return ok(null, '"2"');
    };
    E.w.eval(E.code); await E.sleep(180);
    E.w.__audit.setProfile(p => ({ ...p, archivedIds: ['local-edit'], updatedAt: Date.now() }));
    await E.sleep(850);
    assert.equal(conflictWrites.length, 0); assert.equal(E.w.__audit.profile.syncConflict, true);
    assert(E.has('Использовать облачную копию'));
    const conflicted = JSON.parse(E.w.localStorage.getItem('askme_device_profile_v4')); E.w.close();
    E = env(conflicted); E.w.history.replaceState(null, '', '#/profile'); const reloadBase = E.w.fetch;
    E.w.fetch = async (url, options = {}) => {
      if (!String(url).includes('/sessions/' + path + '.json')) return reloadBase(url, options);
      if (!options.method) return ok(cloud);
      conflictWrites.push(options.body); return ok(null, '"2"');
    };
    E.w.eval(E.code); await E.sleep(600);
    assert.equal(conflictWrites.length, 0); assert.equal(E.w.__audit.profile.syncConflict, true);
    await E.click('Использовать облачную копию', 300);
    assert.equal(E.w.__audit.profile.syncConflict, false); assert.equal(E.w.__audit.profile.players[0].name, 'CLOUD NEW');
    console.log('PASS edits during hydration remain in conflict across reload and cloud adoption requires an explicit choice'); E.w.close();

    E = env(profile('A')); const base3 = E.w.fetch; let exists = false, pending = false; const analyticsMarkers = [];
    E.w.localStorage.setItem('askme_device_profile_v3', JSON.stringify(profile('A')));
    E.w.localStorage.setItem('askme_sess_OTHER999', JSON.stringify({ sessionId: 'OTHER999' }));
    E.w.localStorage.setItem('askme_aid_OTHER999', 'other-analytics');
    E.w.localStorage.setItem('askme_aid_ABCD2345', 'my-analytics');
    E.w.fetch = async (url, opt = {}) => {
      if (String(url).includes('/analytics/') && opt.method === 'PUT') analyticsMarkers.push({ url: String(url), data: JSON.parse(opt.body) });
      if (!String(url).includes('/sessions/' + path + '.json')) return base3(url, opt);
      if (opt.method === 'PUT' && JSON.parse(opt.body)?.deleted) { exists = false; return ok(null); }
      if (opt.method === 'PUT') { pending = true; await E.sleep(800); exists = true; return ok(null); }
      if (opt.method === 'DELETE') { exists = false; return ok(null); }
      return ok(null);
    };
    E.w.eval(E.code); await E.sleep(500); assert(pending);
    await E.w.__audit.handleDeleteMyData(); await E.sleep(400);
    assert.equal(exists, false); assert.equal(E.w.localStorage.getItem('askme_device_profile_v3'), null);
    const fullMarker = analyticsMarkers.find(m => m.url.includes('/full/')).data;
    assert.equal(fullMarker.names, ''); assert.equal(fullMarker.sid, ''); assert.equal(fullMarker.deleted, true);
    assert(E.w.localStorage.getItem('askme_sess_OTHER999')); assert(E.w.localStorage.getItem('askme_aid_OTHER999'));
    console.log('PASS deletion waits for pending PUT, removes legacy profile and preserves other session references'); E.w.close();

    E = env({ ...profile('A'), legacyPath: 'sess_' + '1'.repeat(16) });
    const migrationBase = E.w.fetch; let allowJoin = false, legacyExists = true; const migrationOrder = [];
    E.w.fetch = async (url, options = {}) => {
      const text = String(url);
      if (text.includes('/sessions/sess_') && options.method === 'DELETE') { legacyExists = false; migrationOrder.push('delete-legacy'); return ok(null); }
      if (text.includes('/sessions/j_')) {
        if (!options.method) return ok(null, 'null_etag');
        migrationOrder.push(allowJoin ? 'join' : 'join-failed');
        return allowJoin ? ok(null) : { ok: false, status: 503, json: async () => null };
      }
      if (text.includes('/sessions/' + path + '.json')) {
        if (!options.method) return ok(null, 'null_etag');
        migrationOrder.push('save'); return ok(null, '"2"');
      }
      return migrationBase(url, options);
    };
    E.w.eval(E.code); await E.sleep(700); assert(legacyExists); assert(migrationOrder.includes('join-failed'));
    allowJoin = true; await E.w.__audit.syncSessionToCloud(E.w.__audit.profile);
    assert.equal(legacyExists, false); assert(migrationOrder.indexOf('delete-legacy') > migrationOrder.indexOf('join'));
    console.log('PASS failed join publication preserves legacy recovery and retry deletes it only after durable replacement'); E.w.close();

    E = env(profile('A')); E.w.eval(E.code); await E.sleep(200);
    E.w.__audit.startWithMode('normal'); await E.sleep(60); E.w.__audit.handleFinishGame(false); await E.sleep(100);
    assert.equal(E.w.__audit.profile.archivedIds.length, 0);
    console.log('PASS finishing before the first answer does not archive an unanswered question');
    const A = E.w.__ct.Auth;
    A.store.owner = { idToken: 'owner', refreshToken: 'keep', expiresAt: 0 };
    A.post = async () => { throw new Error('temporary network failure'); };
    await assert.rejects(A.token(), /temporary network failure/); assert.equal(A.store.owner.refreshToken, 'keep');
    console.log('PASS transient refresh failure preserves owner credentials and never downgrades the request');
    const audience = await E.w.__ct.questionTarget('ABCD2345', profile('A'));
    assert(/^aud_[a-f0-9]{64}$/.test(audience)); assert(!audience.includes('ABCD2345')); assert(!audience.includes(KEY));
    assert.notEqual(audience, await E.w.__ct.questionAudienceKey('BBBBBBBBBBBBBBBBBBBBBB'));
    assert.equal(await E.w.__ct.questionTarget('', profile('A'), audience), audience);
    console.log('PASS personal question audiences use the secret key digest and preserve targeting on edit');
    const allErrors = [...E.errors]; E.w.close();
    E = env(profile('A')); E.w.localStorage.setItem('askme_auth_v2', JSON.stringify({ owner: { idToken: 'owner', refreshToken: 'r', expiresAt: Date.now() + 3600000 } }));
    const base4 = E.w.fetch; const edits = [];
    E.w.fetch = async (url, options = {}) => { if (options.method === 'PATCH' && String(url).includes('/questions/')) edits.push(JSON.parse(options.body)); return base4(url, options); };
    E.w.eval(E.code); await E.sleep(180);
    E.w.__audit.openEditScreen({ dbKey: '123', id: 'targeted', num: 1, cleanText: 'Question text', categoryId: 'family', level: 'Простые', targetId: audience }, 'menu');
    await E.sleep(70);
    assert.equal(E.w.__audit.editForm.targetId, ''); assert.equal(E.w.__audit.editForm.savedTarget, audience);
    await E.w.__audit.executeSaveEdit(); await E.sleep(70);
    assert.equal(edits[0].targetId, audience);
    console.log('PASS editing a personal question preserves its audience without exposing or re-entering the login ID');
    const auth = E.w.__ct.Auth, originalPost = auth.post.bind(auth);
    auth.store.owner.expiresAt = 0;
    auth.post = async (url, ...args) => { if (String(url).includes('securetoken')) throw new Error('INVALID_REFRESH_TOKEN'); return originalPost(url, ...args); };
    await auth.token(); await E.sleep(50); assert.equal(E.w.__audit.isAdmin, false);
    console.log('PASS revoked owner credentials immediately remove the administrative UI role');
    E.w.localStorage.setItem('askme_deleted_ABCD2345', '1');
    E.w.dispatchEvent(new E.w.StorageEvent('storage', { key: 'askme_deleted_ABCD2345', newValue: '1' }));
    await E.sleep(80); assert.equal(E.w.__audit.profile, null);
    console.log('PASS a deletion notification from another tab closes the active session');
    allErrors.push(...E.errors); E.w.close();
    assert.equal(allErrors.length, 0);
    console.log('--- captured runtime errors: 0');
  } finally { E?.w.close(); }
})().catch(error => { console.error('FAIL', error); process.exitCode = 1; });
