/* ASK ME · Strategy Atlas — интерактив. Без зависимостей, работает офлайн. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* приватный режим */ } }
  };
  document.documentElement.classList.add('js');

  /* тема */
  var root = document.documentElement;
  function setTheme(t) { root.setAttribute('data-theme', t); store.set('atlas-theme', t); var b = $('#themeBtn'); if (b) b.textContent = t === 'dark' ? '☀️ Светлая' : '🌙 Тёмная'; }
  setTheme(store.get('atlas-theme') || 'dark');
  var tb = $('#themeBtn'); if (tb) tb.addEventListener('click', function () { setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); });

  /* тост */
  var toastEl = $('#toast'), toastT;
  function toast(msg) { if (!toastEl) return; toastEl.textContent = msg; toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 1800); }
  function copy(text, msg) {
    var done = function () { toast(msg || 'Скопировано'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    else fallback();
    function fallback() { var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ } t.remove(); }
  }
  $$('[data-copy]').forEach(function (el) { el.addEventListener('click', function () { copy(el.getAttribute('data-copy'), 'Скопировано: ' + el.getAttribute('data-copy')); }); });

  /* мобильное меню */
  var rail = $('#rail'), scrim = $('#scrim');
  function railOpen(o) { rail.classList.toggle('open', o); scrim.classList.toggle('on', o); }
  $$('[data-menu]').forEach(function (b) { b.addEventListener('click', function () { railOpen(!rail.classList.contains('open')); }); });
  if (scrim) scrim.addEventListener('click', function () { railOpen(false); });
  $$('.toc a').forEach(function (a) { a.addEventListener('click', function () { railOpen(false); }); });

  /* прогресс и подсветка текущей главы */
  var bar = $('#progress'), links = {}, chapters = $$('.chapter');
  $$('.toc a').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
  function onScroll() {
    var h = document.documentElement, max = h.scrollHeight - h.clientHeight;
    if (bar) bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
    var cur = null, y = window.innerHeight * 0.35;
    chapters.forEach(function (c) { if (c.getBoundingClientRect().top <= y) cur = c.id; });
    Object.keys(links).forEach(function (k) { links[k].classList.toggle('on', k === cur); });
    var on = $('.toc a.on'); if (on && rail && rail.scrollHeight > rail.clientHeight) { var r = on.getBoundingClientRect(), rr = rail.getBoundingClientRect(); if (r.top < rr.top + 80 || r.bottom > rr.bottom - 80) on.scrollIntoView({ block: 'center' }); }
  }
  var tick = false; window.addEventListener('scroll', function () { if (!tick) { tick = true; requestAnimationFrame(function () { onScroll(); tick = false; }); } }, { passive: true }); onScroll();

  /* вкладки */
  $$('.tabs').forEach(function (t) {
    var tabs = $$('.tab', t), panels = $$('.panel', t);
    function sel(i) { tabs.forEach(function (b, j) { b.setAttribute('aria-selected', j === i ? 'true' : 'false'); }); panels.forEach(function (p, j) { p.hidden = j !== i; }); }
    tabs.forEach(function (b, i) { b.addEventListener('click', function () { sel(i); }); });
    sel(0);
  });

  /* таблицы: сортировка и поиск */
  $$('.tbl-wrap').forEach(function (w) {
    var tbl = $('table', w), body = $('tbody', tbl), rows = $$('tr', body), cnt = $('.cnt', w), inp = $('input[type=search]', w);
    function upd() { var n = rows.filter(function (r) { return !r.hidden; }).length; if (cnt) cnt.textContent = n + ' из ' + rows.length; }
    if (inp) inp.addEventListener('input', function () { var q = inp.value.toLowerCase().trim(); rows.forEach(function (r) { r.hidden = q && r.textContent.toLowerCase().indexOf(q) < 0; }); upd(); });
    $$('th[data-sort]', tbl).forEach(function (th, _, all) {
      th.tabIndex = 0;
      function go() {
        var i = Array.prototype.indexOf.call(th.parentNode.children, th), asc = th.getAttribute('aria-sort') !== 'ascending', num = th.getAttribute('data-sort') === 'num';
        all.forEach(function (o) { o.removeAttribute('aria-sort'); }); th.setAttribute('aria-sort', asc ? 'ascending' : 'descending');
        var val = function (r) { var c = r.children[i], v = c.getAttribute('data-v'); if (v == null) v = c.textContent; return num ? (parseFloat(String(v).replace(/[^\d.\-]/g, '')) || 0) : String(v).toLowerCase(); };
        rows.sort(function (a, b) { var x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * (asc ? 1 : -1); }).forEach(function (r) { body.appendChild(r); });
      }
      th.addEventListener('click', go); th.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    upd();
  });

  /* чек-листы */
  $$('[data-chk]').forEach(function (ul) {
    var id = 'chk-' + ul.getAttribute('data-chk');
    var saved = {}; try { saved = JSON.parse(store.get(id) || '{}'); } catch (e) { saved = {}; }
    $$('input', ul).forEach(function (i) {
      var k = i.getAttribute('data-k'); i.checked = !!saved[k];
      i.addEventListener('change', function () { saved[k] = i.checked; store.set(id, JSON.stringify(saved)); });
    });
  });

  /* калькулятор юнит-экономики */
  var calc = $('#calc');
  if (calc) {
    var g = function (n) { return parseFloat($('[name=' + n + ']', calc).value); };
    var fmt = function (n) { return (n < 0 ? '−' : '') + '$' + Math.abs(n).toFixed(2).replace('.', ','); };
    function run() {
      $$('.ctl', calc).forEach(function (c) { var i = $('input', c), o = $('output', c); if (o) o.textContent = i.value + (i.getAttribute('data-u') || ''); });
      var price = g('price'), conv = g('conv') / 100, rep = g('rep'), vat = g('vat') / 100, ref = g('ref') / 100, fee = g('fee') / 100, fix = g('fix'), vc = g('vc'), cpc = g('cpc'), cc = g('cc') / 100, fixed = g('fixed'), want = g('want');
      var first = price / (1 + vat) * (1 - ref) - price * fee - fix - vc;
      var ltv = first * rep, maxCac = ltv / 3, perVisit = maxCac * conv;
      var cac = cc > 0 ? cpc / cc : Infinity;
      var visitsFixed = first > 0 && conv > 0 ? fixed / (first * conv) : Infinity;
      var visitsWant = first > 0 && conv > 0 ? (fixed + want) / (first * conv) : Infinity;
      var set = function (id, v, cls) { var e = $('#' + id, calc); e.firstElementChild.textContent = v; e.className = 'res' + (cls ? ' ' + cls : ''); };
      set('r-first', fmt(first), first > 0 ? '' : 'bad'); set('r-ltv', fmt(ltv)); set('r-cac', fmt(maxCac)); set('r-visit', fmt(perVisit));
      set('r-ad', isFinite(cac) ? fmt(cac) : '—', cac <= maxCac ? 'good' : 'bad');
      set('r-v1', isFinite(visitsFixed) ? Math.ceil(visitsFixed).toLocaleString('ru-RU') : '—'); set('r-v2', isFinite(visitsWant) ? Math.ceil(visitsWant).toLocaleString('ru-RU') : '—');
      $('#r-msg', calc).textContent = cac <= maxCac ? 'Реклама сходится: CAC ' + fmt(cac) + ' не выше допустимых ' + fmt(maxCac) + '.' : 'Реклама НЕ сходится: покупатель стоит ' + (isFinite(cac) ? fmt(cac) : '∞') + ', а допустимо ' + fmt(maxCac) + '. Нужны органика, выше цена или выше конверсия.';
    }
    $$('input', calc).forEach(function (i) { i.addEventListener('input', run); }); run();
  }

  /* обозреватель названий */
  var nm = $('#names');
  if (nm) {
    var data = JSON.parse($('#data-names').textContent), st = { g: 'all', f: {}, q: '', sort: 'sc' }, body = $('tbody', nm), cntN = $('.cnt', nm);
    var chipS = function (s, yes, no) { return '<span class="chip ' + (s === 'free' ? 'chip-ok' : s === 'taken' ? 'chip-mute' : 'chip-warn') + '">' + (s === 'free' ? (yes || 'свободен') : s === 'taken' ? (no || 'занят') : '?') + '</span>'; };
    var pl = { none: '<span class="chip chip-ok">нет</span>', partial: '<span class="chip chip-warn">похожее</span>', exact: '<span class="chip chip-bad">есть</span>', na: '<span class="chip chip-mute">—</span>' };
    function draw() {
      var q = st.q.toLowerCase();
      var list = data.filter(function (d) {
        if (st.g !== 'all' && d.g !== st.g) return false;
        if (st.f.com && d.com !== 'free') return false;
        if (st.f.app && d.app !== 'free') return false;
        if (st.f.play && d.play !== 'none') return false;
        if (st.f.pick && !d.pick) return false;
        if (q && (d.n + ' ' + d.gl).toLowerCase().indexOf(q) < 0) return false;
        return true;
      }).sort(function (a, b) { return st.sort === 'n' ? a.n.localeCompare(b.n) : (b.sc - a.sc) || a.n.localeCompare(b.n); });
      body.innerHTML = list.slice(0, 400).map(function (d) {
        return '<tr><td>' + (d.pick === 2 ? '⭐ ' : d.pick === 1 ? '◽ ' : '') + esc(d.n.charAt(0).toUpperCase() + d.n.slice(1)) + '</td><td>' + esc(d.gl) + '</td><td data-v="' + d.sc + '"><b>' + d.sc + '</b></td><td>' + chipS(d.com) + '</td><td>' + chipS(d.app) + '</td><td>' + chipS(d.party) + '</td><td>' + chipS(d.io, null, 'занят') + '</td><td>' + chipS(d.game) + '</td><td>' + (pl[d.play] || pl.na) + '</td></tr>';
      }).join('');
      cntN.textContent = list.length + ' из ' + data.length;
    }
    $$('[data-g]', nm).forEach(function (b) { b.addEventListener('click', function () { st.g = b.getAttribute('data-g'); $$('[data-g]', nm).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); draw(); }); });
    $$('[data-f]', nm).forEach(function (b) { b.addEventListener('click', function () { var k = b.getAttribute('data-f'); st.f[k] = !st.f[k]; b.setAttribute('aria-pressed', st.f[k] ? 'true' : 'false'); draw(); }); });
    $('input[type=search]', nm).addEventListener('input', function (e) { st.q = e.target.value; draw(); });
    $('select', nm).addEventListener('change', function (e) { st.sort = e.target.value; draw(); });
    draw();
  }

  /* банк карточек */
  var bk = $('#bank');
  if (bk) {
    var cards = JSON.parse($('#data-bank').textContent), bs = { k: 'all', a: 'all', l: 'all', q: '', n: 48 }, grid = $('.bank-grid', bk), cntB = $('.cnt', bk), more = $('.more-btn', bk), cur = [];
    var K = { q: 'Вопрос', d: 'Действие', f: 'Форфейт', c: 'Выбор' }, A = { g: 'Компания', c: 'Пара', b: 'Оба' }, L = ['', 'лёгкий', 'средний', 'острый'];
    function drawB() {
      var q = bs.q.toLowerCase();
      cur = cards.filter(function (c) {
        return (bs.k === 'all' || c.k === bs.k) && (bs.a === 'all' || c.a === bs.a || c.a === 'b') && (bs.l === 'all' || String(c.l) === bs.l) && (!q || (c.r + ' ' + c.e + ' ' + c.t).toLowerCase().indexOf(q) >= 0);
      });
      grid.innerHTML = cur.slice(0, bs.n).map(function (c, i) {
        return '<div class="bc" data-i="' + i + '" role="button" tabindex="0" title="Нажмите, чтобы скопировать"><b>' + esc(c.r) + '</b><em>' + esc(c.e) + '</em><div class="bm"><span class="chip chip-vio">' + K[c.k] + '</span><span class="chip chip-info">' + A[c.a] + '</span><span class="chip ' + (c.l === 3 ? 'chip-bad' : c.l === 2 ? 'chip-warn' : 'chip-ok') + '">' + L[c.l] + '</span></div></div>';
      }).join('');
      cntB.textContent = cur.length + ' из ' + cards.length;
      more.style.display = cur.length > bs.n ? '' : 'none';
    }
    grid.addEventListener('click', function (e) { var el = e.target.closest('.bc'); if (el) { var c = cur[+el.getAttribute('data-i')]; copy(c.r + ' / ' + c.e, 'Карточка скопирована'); } });
    $$('[data-bk]', bk).forEach(function (b) { b.addEventListener('click', function () { var k = b.getAttribute('data-bk'), v = b.getAttribute('data-v'); bs[k] = v; $$('[data-bk=' + k + ']', bk).forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); }); bs.n = 48; drawB(); }); });
    $('input[type=search]', bk).addEventListener('input', function (e) { bs.q = e.target.value; bs.n = 48; drawB(); });
    more.addEventListener('click', function () { bs.n += 96; drawB(); });
    function dl(name, text, type) { var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 500); }
    $('[data-export=csv]', bk).addEventListener('click', function () { var q = function (s) { return '"' + String(s).replace(/"/g, '""') + '"'; }; dl('ask-me-cards.csv', '﻿kind,audience,level,category,ru,en\n' + cur.map(function (c) { return [K[c.k], A[c.a], c.l, c.t, c.r, c.e].map(q).join(','); }).join('\n'), 'text/csv'); });
    $('[data-export=json]', bk).addEventListener('click', function () { dl('ask-me-cards.json', JSON.stringify(cur, null, 1), 'application/json'); });
    drawB();
  }

  /* поиск по документу (⌘K) */
  var pal = $('#palette'), inp = $('#palInput'), res = $('#palRes'), idx = null, sel = 0, shown = [];
  function build() {
    idx = [];
    $$('.chapter').forEach(function (c) {
      var ch = $('h2', c).textContent;
      $$('[data-s]', c).forEach(function (el) {
        var t = (el.getAttribute('data-s') || el.textContent).replace(/\s+/g, ' ').trim();
        if (t.length > 3) idx.push({ el: el, t: t, low: t.toLowerCase(), ch: ch });
      });
    });
  }
  function openPal(o) {
    pal.classList.toggle('on', o);
    if (o) { if (!idx) build(); inp.value = ''; render(); setTimeout(function () { inp.focus(); }, 30); }
  }
  function render() {
    var q = inp.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!q.length) { shown = $$('.chapter').map(function (c) { return { el: c, t: $('h2', c).textContent, ch: 'Глава' }; }); }
    else {
      shown = idx.filter(function (e) { return q.every(function (w) { return e.low.indexOf(w) >= 0; }); }).slice(0, 40);
    }
    sel = 0;
    res.innerHTML = shown.length ? shown.map(function (e, i) {
      var t = e.t.length > 140 ? e.t.slice(0, 140) + '…' : e.t;
      return '<a href="#" data-i="' + i + '" class="' + (i === 0 ? 'sel' : '') + '">' + t.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '<small>' + e.ch + '</small></a>';
    }).join('') : '<div class="pal-empty">Ничего не найдено</div>';
  }
  function go(i) {
    var e = shown[i]; if (!e) return; openPal(false);
    var p = e.el.parentElement; while (p) { if (p.tagName === 'DETAILS') p.open = true; p = p.parentElement; }
    var tp = e.el.closest('.panel'); if (tp && tp.hidden) { var tabs = tp.parentElement; var pi = $$('.panel', tabs).indexOf(tp); var b = $$('.tab', tabs)[pi]; if (b) b.click(); }
    e.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); e.el.classList.remove('hit'); void e.el.offsetWidth; e.el.classList.add('hit');
  }
  if (pal) {
    $$('[data-search]').forEach(function (b) { b.addEventListener('click', function () { openPal(true); }); });
    pal.addEventListener('click', function (e) { if (e.target === pal) openPal(false); });
    inp.addEventListener('input', render);
    res.addEventListener('click', function (e) { var a = e.target.closest('a'); if (a) { e.preventDefault(); go(+a.getAttribute('data-i')); } });
    inp.addEventListener('keydown', function (e) {
      var items = $$('a', res);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, Math.min(items.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1))); items.forEach(function (a, i) { a.classList.toggle('sel', i === sel); }); if (items[sel]) items[sel].scrollIntoView({ block: 'nearest' }); }
      else if (e.key === 'Enter') { e.preventDefault(); go(sel); }
    });
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPal(!pal.classList.contains('on')); }
      else if (e.key === 'Escape') { openPal(false); railOpen(false); }
      else if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); openPal(true); }
    });
  }

  /* печать */
  window.addEventListener('beforeprint', function () { $$('details').forEach(function (d) { d.open = true; }); setTheme('light'); });
  var pb = $('#printBtn'); if (pb) pb.addEventListener('click', function () { window.print(); });
})();
