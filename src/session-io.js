// Все записи одной сессии проходят через общий барьер удаления.
export const createSessionTasks = ({ isDeleted = () => false } = {}) => {
  const pending = new Map();
  const paused = new Set();
  return {
    blocked: sid => paused.has(sid) || isDeleted(sid),
    resume(sid) { paused.delete(sid); },
    run(sid, job) {
      if (paused.has(sid) || isDeleted(sid)) return Promise.resolve(false);
      const jobs = pending.get(sid) || new Set();
      pending.set(sid, jobs);
      const task = Promise.resolve().then(() => (paused.has(sid) || isDeleted(sid)) ? false : job());
      jobs.add(task);
      const release = () => { jobs.delete(task); if (!jobs.size) pending.delete(sid); };
      task.then(release, release);
      return task;
    },
    async stop(sid) {
      paused.add(sid);
      while (pending.get(sid)?.size) await Promise.allSettled([...pending.get(sid)]);
    }
  };
};

export const mergeTurnHistories = (left, right) => {
  const result = Object.assign(Object.create(null), right);
  for (const [index, local] of Object.entries(left)) {
    const remote = right[index];
    if (!remote) { result[index] = local; continue; }
    const answered = [...new Set([...local.answered, ...remote.answered])];
    const skippedBy = [...new Set([...local.skippedBy, ...remote.skippedBy])];
    const skippedAll = local.skippedAll || remote.skippedAll;
    const cur = skippedAll ? null : [local.cur, remote.cur].filter(id => id && !answered.includes(id)).sort()[0] || null;
    const owner = local.cur === cur ? local : remote;
    result[index] = { cur, answered, skippedBy, skippedAll, ...(owner.dev ? { dev: owner.dev } : {}) };
  }
  return result;
};

export const createLiveWriter = ({ request, mergeHistory }) => async (url, method, body, context = {}) => {
  const headers = { 'Content-Type': 'application/json' };
  if (method !== 'PATCH' || typeof body?.ver !== 'number') {
    const response = await request(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { ok: response.ok };
  }
  for (let attempt = 0; attempt < 4; attempt++) {
    const read = await request(url, { headers: { 'X-Firebase-ETag': 'true' } });
    if (!read.ok) return { ok: false };
    const current = (await read.json()) || {};
    if (current.deleted || (context.gid && current.gid && context.gid !== current.gid && !body.gid)) return { ok: false };
    const patch = { ...body };
    let changed = typeof current.ver === 'number' && Math.floor(current.ver) >= Math.floor(body.ver);
    if (typeof patch.hist === 'string' && typeof current.hist === 'string') {
      const merged = mergeHistory(patch.hist, current.hist);
      changed = changed || merged !== patch.hist || Number(current.max) > Number(patch.max);
      patch.hist = merged;
      patch.max = Math.max(Number(patch.max) || 0, Number(current.max) || 0);
      if (body.idx >= body.max) patch.idx = Math.max(Number(body.idx) || 0, Number(current.idx) || 0);
    }
    if (changed) patch.ver = Math.floor(Math.max(current.ver, body.ver)) + 1 + (body.ver % 1);
    // RTDB conditional requests support PUT, not PATCH. Preserve the complete
    // snapshot (including presence), remove null children and retry on 412.
    const next = Object.fromEntries(Object.entries({ ...current, ...patch }).filter(([, value]) => value !== null));
    const response = await request(url, { method: 'PUT', headers: { ...headers, 'If-Match': read.headers?.get('ETag') || 'null_etag' }, body: JSON.stringify(next) });
    if (response.status === 412) continue;
    return { ok: response.ok, ...(changed && response.ok ? { snapshot: next } : {}) };
  }
  return { ok: false };
};

// ETag/If-Match оставляет конфликтующие изменения на устройстве, не затирая облако.
export const createSessionStore = ({ request, urlFor, encrypt, decrypt, maxPayload }) => {
  const states = new Map();
  const hydrate = (profile) => {
    const key = profile.sessionKey;
    if (states.has(key)) return states.get(key).loading;
    const state = { etag: 'null_etag', chain: Promise.resolve(), conflict: false };
    states.set(key, state);
    state.loading = (async () => {
      const url = await urlFor(key);
      const response = await request(url, { headers: { 'X-Firebase-ETag': 'true' } });
      if (!response.ok && response.status !== 404) throw new Error('cloud-unavailable');
      const data = response.ok ? await response.json() : null;
      state.etag = response.headers?.get('ETag') || 'null_etag';
      if (data?.deleted === true) throw new Error('session-deleted');
      const cloud = data?.payload ? await decrypt(data.payload, key) : null;
      if (data?.payload && !cloud) throw new Error('invalid-session');
      const content = value => JSON.stringify({ players: value?.players || [], archivedIds: value?.archivedIds || [], disabledIds: value?.disabledIds || [], savedGame: value?.savedGame || null });
      state.hydrationConflict = profile.syncConflict === true || (!!cloud && content(cloud) !== content(profile)) || Number(cloud?.updatedAt) > Number(profile.updatedAt);
      return cloud;
    })().catch(error => { states.delete(key); throw error; });
    return state.loading;
  };
  return {
    hydrate,
    requiresResolution(key) { return states.get(key)?.hydrationConflict === true; },
    acceptHydration(key) { const state = states.get(key); if (state) state.hydrationConflict = false; },
    forget(key) { states.delete(key); },
    async save(profile) {
      await hydrate(profile);
      const state = states.get(profile.sessionKey);
      const operation = state.chain.catch(() => {}).then(async () => {
        if (state.conflict || state.hydrationConflict) throw new Error('cloud-conflict');
        const pack = withGame => encrypt({ players: profile.players, archivedIds: profile.archivedIds || [], disabledIds: profile.disabledIds || [], savedGame: withGame ? profile.savedGame || null : null, updatedAt: profile.updatedAt }, profile.sessionKey);
        let payload = await pack(true);
        if (!payload) throw new Error('encrypt');
        if (payload.length >= maxPayload) payload = await pack(false);
        if (!payload || payload.length >= maxPayload) throw new Error('too-big');
        const response = await request(await urlFor(profile.sessionKey), {
          method: 'PUT', headers: { 'Content-Type': 'application/json', 'If-Match': state.etag, 'X-Firebase-ETag': 'true' },
          body: JSON.stringify({ payload, updatedAt: profile.updatedAt })
        });
        if (response.status === 412) { state.conflict = true; throw new Error('cloud-conflict'); }
        if (!response.ok) throw new Error('cloud-unavailable');
        // Отсутствие ETag не разрешает безусловный PUT: следующий save сделает GET.
        const etag = response.headers?.get('ETag');
        if (etag) state.etag = etag;
        else states.delete(profile.sessionKey);
        return true;
      });
      state.chain = operation;
      return operation;
    }
  };
};
