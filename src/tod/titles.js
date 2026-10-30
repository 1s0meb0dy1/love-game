// Режим «Правда или действие»: титулы итогов («Зал позора» и добрые) и таблица игроков. Правила — раздел 9.3 спеки и Task 8 плана.
// Всё детерминированно: при равенстве титул «больше всех» достаётся игроку, который раньше в списке; у игрока не больше двух титулов.

const todSum = (a) => (Array.isArray(a) ? a.reduce((n, x) => n + (Number(x) || 0), 0) : 0);

// state, TOD_TITLES -> { shame:[{p,id}], cheer:[{p,id}], clean, rank:[{p,done,skips,hard}] }
export const todTitles = (state, titles) => {
  const stat = state && Array.isArray(state.stat) ? state.stat : []; const hardOn = !!(state && state.opts && state.opts.hard);
  const row = stat.map((s, p) => {
    const done = todSum(s && s.d); const skips = todSum(s && s.s); const lv = todSum(s && s.l); const c = (s && s.c) || [0, 0]; const l = (s && s.l) || [0, 0, 0]; const d = (s && s.d) || [0, 0, 0, 0];
    return { p, done, skips, hard: (s && s.dh) || 0, sh: (s && s.sh) || 0, ms: (s && s.ms) || 0, rd: (s && s.rd) || 0, lv, easy: l[0] || 0, hardLv: l[2] || 0, truths: c[0] || 0, dares: c[1] || 0, dDare: (d[1] || 0) + (d[2] || 0) + (d[3] || 0), dTruth: d[0] || 0 };
  });
  // один обладатель: наибольшее значение не меньше min, при равенстве — первый по списку
  const top = (key, min) => { let best = null; row.forEach(r => { if (r[key] >= min && (!best || r[key] > best[key])) best = r; }); return best ? [best.p] : []; };
  const all = (f) => row.filter(f).map(r => r.p);
  const RULES = {
    coward: () => top('skips', 2),
    deserter: () => all(r => r.ms >= 3),
    hard_fold: () => all(r => r.sh > 0),
    later: () => all(r => r.skips > r.done && r.skips + r.done >= 3),
    easy_life: () => all(r => r.lv >= 4 && r.easy / r.lv >= 0.8),
    // «Правда» не больше 3 раз подряд, поэтому «Действие» выбирают хотя бы раз в четыре хода; боится действий тот, кто брал его только по принуждению: не чаще одного на каждые три правды
    afraid_dare: () => all(r => r.truths >= 3 && r.dares <= Math.floor(r.truths / 3)),
    careful: () => all(r => hardOn && r.hardLv === 0 && r.dares >= 4),
    hero: () => top('hard', 1),
    fearless: () => all(r => r.skips === 0 && r.done >= 5),
    redeemed: () => all(r => r.rd > 0),
    dare_master: () => top('dDare', 1),
    honest: () => top('dTruth', 1),
  };
  const count = row.map(() => 0); const shame = []; const cheer = [];
  (Array.isArray(titles) ? titles : []).forEach(t => {
    const rule = t && RULES[t.id]; if (!rule) return;
    rule().forEach(p => { if (count[p] >= 2) return; count[p] += 1; (t.shame ? shame : cheer).push({ p, id: t.id }); });
  });
  const rank = row.map(r => ({ p: r.p, done: r.done, skips: r.skips, hard: r.hard }))
    .sort((a, b) => b.done - a.done || a.skips - b.skips || a.p - b.p);
  return { shame, cheer, clean: row.every(r => r.skips === 0), rank };
};
