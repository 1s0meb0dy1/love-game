// Рендер блоков контента → HTML. Статика: интерактив добавляет template/app.js.
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const EV = {
  fact: ['ФАКТ', 'Проверено инструментом или первоисточником 31.10.2026'],
  src: ['ИСТОЧНИК', 'Утверждение стороннего источника, не перепроверено'],
  model: ['МОДЕЛЬ', 'Мой расчёт с явными допущениями'],
  know: ['ЗНАНИЕ', 'Общая экспертиза; в этой сессии не перепроверялось'],
  hyp: ['ГИПОТЕЗА', 'Нужно проверить тестом'],
  unk: ['НЕ ПРОВЕРЕНО', 'Данных нет или доступ не получен'],
  go: ['ДЕЛАТЬ', ''], test: ['ТЕСТИРОВАТЬ', ''], stop: ['НЕ ДЕЛАТЬ', ''], risk: ['РИСК', ''],
};

export function md(src) {
  if (src == null) return '';
  let s = esc(src);
  s = s.replace(/::(\w+)::/g, (m, k) => (EV[k] ? `<span class="ev ev-${k}" title="${esc(EV[k][1])}">${EV[k][0]}</span>` : m));
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[\s(>])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>');
  s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return s.replace(/\n/g, '<br>');
}
const plain = (s) => String(s ?? '').replace(/::\w+::/g, '').replace(/[*`]/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim();

/* контраст WCAG */
const lum = (hex) => {
  const c = hex.replace('#', ''); const v = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
};
export const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

/* ячейка таблицы */
function cell(v) {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.chip) return `<span class="chip chip-${v.chip}">${md(v.v)}</span>`;
    if (v.spark) {
      const a = v.spark, mx = Math.max(...a), mn = Math.min(...a), w = 92, h = 26;
      const pts = a.map((y, i) => `${(i / (a.length - 1)) * (w - 6) + 3},${h - 3 - ((y - mn) / (mx - mn || 1)) * (h - 6)}`);
      const last = pts[pts.length - 1].split(',');
      return `<svg class="spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="тренд за 12 месяцев"><polyline points="${pts.join(' ')}"/><circle cx="${last[0]}" cy="${last[1]}" r="2.6"/></svg>`;
    }
    if (v.bar != null) return `${md(v.v ?? v.bar)}<span class="mini"><i style="--w:${Math.max(2, Math.min(100, (v.bar / (v.max || 100)) * 100))}%"></i></span>`;
    return md(v.v);
  }
  return md(v);
}

export function createCtx(data) { let n = 0; return { data, uid: (p = 'x') => `${p}${++n}` }; }

const ICON = { fact: '📌', risk: '⚠️', legal: '⚖️', tip: '💡', insight: '🔎', money: '💸', hot: '🔥' };

export function blocks(list, ctx) { return (list || []).map((b) => block(b, ctx)).join('\n'); }

function block(b, ctx) {
  const w = (inner, cls = '') => `<div class="blk ${cls}">${inner}</div>`;
  switch (b.t) {
    case 'p': return `<p class="blk">${md(b.x)}</p>`;
    case 'lead': return `<p class="blk lead">${md(b.x)}</p>`;
    case 'h': return `<h3 data-s="${esc(plain(b.x))}" id="${ctx.uid('h')}">${md(b.x)}</h3>${b.sub ? `<p class="h3-sub">${md(b.sub)}</p>` : ''}`;
    case 'ul': { const tag = b.ordered ? 'ol' : 'ul'; return `<${tag} class="blk">${b.items.map((i) => `<li>${md(i)}</li>`).join('')}</${tag}>`; }
    case 'callout': return `<aside class="callout co-${b.k || 'insight'} blk ${b.wide ? 'wide' : ''}"><div aria-hidden="true">${b.icon || ICON[b.k || 'insight']}</div><div>${b.title ? `<h4 data-s="${esc(plain(b.title))}">${md(b.title)}</h4>` : ''}${String(b.x).split('\n\n').map((p) => `<p>${md(p)}</p>`).join('')}</div></aside>`;
    case 'quote': return `<blockquote class="quote blk">${md(b.x)}${b.by ? `<cite>${md(b.by)}</cite>` : ''}</blockquote>`;
    case 'bento': return w(`<div class="bento">${b.items.map((i) => `<div class="bt bt-${i.tone || 'rose'} ${i.span ? 's' + i.span : ''}" data-s="${esc(plain(i.big + ' ' + i.label))}">${i.ev ? `<span class="ev ev-${i.ev}">${EV[i.ev][0]}</span>` : ''}<div class="bt-big">${esc(i.big)}${i.unit ? `<small>${esc(i.unit)}</small>` : ''}</div><div class="bt-lab">${md(i.label)}</div>${i.sub ? `<div class="bt-sub">${md(i.sub)}</div>` : ''}</div>`).join('')}</div>`);
    case 'table': {
      const id = ctx.uid('t');
      const head = b.cols.map((c) => `<th ${c.sort ? `data-sort="${c.sort}"` : ''} scope="col">${esc(c.h)}</th>`).join('');
      const rows = b.rows.map((r) => {
        const arr = Array.isArray(r) ? r : b.cols.map((c) => r[c.k]);
        return `<tr data-s="${esc(plain(arr.map((x) => (typeof x === 'object' && x ? x.v ?? '' : x)).join(' · ')))}">${arr.map((v, i) => `<td${b.cols[i]?.sort === 'num' ? ` data-v="${esc(typeof v === 'object' && v ? v.bar ?? v.v : v)}"` : ''}>${cell(v)}</td>`).join('')}</tr>`;
      }).join('');
      return w(`<div class="tbl-wrap${b.rows.length > 14 ? ' long' : ''}" id="${id}"><div class="tbl-bar">${b.cap ? `<span class="cap" data-s="${esc(plain(b.cap))}">${md(b.cap)}</span>` : '<span class="cap"></span>'}${b.search === false ? '' : `<input type="search" placeholder="Поиск по таблице" aria-label="Поиск по таблице: ${esc(plain(b.cap || ''))}">`}<span class="cnt"></span></div><div class="tbl-scroll"><table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>${b.note ? `<div class="tbl-note">${md(b.note)}</div>` : ''}</div>`);
    }
    case 'cards': return w(`<div class="cards ${b.wide ? 'c2' : ''}">${b.items.map((i) => `<article class="card ${i.tone ? 't-' + i.tone : ''}" data-s="${esc(plain((i.title || '') + ' ' + (i.x || '')))}">${i.tag ? `<span class="tag">${md(i.tag)}</span>` : ''}${i.big ? `<div class="big">${esc(i.big)}</div>` : ''}${i.title ? `<h4>${md(i.title)}</h4>` : ''}${i.x ? `<p>${md(i.x)}</p>` : ''}${i.ul ? `<ul>${i.ul.map((u) => `<li>${md(u)}</li>`).join('')}</ul>` : ''}${i.meta ? `<div class="meta">${md(i.meta)}</div>` : ''}</article>`).join('')}</div>`);
    case 'accordion': return w(b.items.map((i) => `<details class="acc" ${i.open ? 'open' : ''}><summary data-s="${esc(plain(i.h))}">${md(i.h)}</summary><div class="acc-b">${i.blocks ? blocks(i.blocks, ctx) : String(i.x).split('\n\n').map((p) => `<p>${md(p)}</p>`).join('')}</div></details>`).join(''));
    case 'tabs': return w(`<div class="tabs"><div class="tablist" role="tablist">${b.tabs.map((t, i) => `<button class="tab" role="tab" aria-selected="${i === 0}">${md(t.h)}</button>`).join('')}</div>${b.tabs.map((t) => `<div class="panel" role="tabpanel">${blocks(t.blocks, ctx)}</div>`).join('')}</div>`);
    case 'steps': return w(`<ol class="steps">${b.items.map((i) => `<li data-s="${esc(plain(i.h + ' ' + (i.x || '')))}"><b>${md(i.h)}</b>${i.x ? md(i.x) : ''}</li>`).join('')}</ol>`);
    case 'timeline': return w(`<ol class="tl">${b.items.map((i) => `<li data-s="${esc(plain(i.when + ' ' + i.h))}"><span class="when">${md(i.when)}</span><div class="box"><b>${md(i.h)}</b>${i.x ? `<p>${md(i.x)}</p>` : ''}</div></li>`).join('')}</ol>`);
    case 'diff': {
      const ST = { ok: ['chip-ok', 'подтверждено'], fix: ['chip-warn', 'исправлено'], add: ['chip-info', 'добавлено'], no: ['chip-bad', 'оспорено'], unk: ['chip-mute', 'не проверено'] };
      return w(`<div class="diff">${b.rows.map((r) => `<div class="diff-row" data-s="${esc(plain((r.old || '') + ' ' + (r.new || '')))}"><div class="diff-st"><span class="chip ${ST[r.st][0]}">${ST[r.st][1]}</span>${r.tag ? `<small>${esc(r.tag)}</small>` : ''}</div><div class="diff-body">${r.old ? `<div class="dl dl-old"><i>−</i><div>${md(r.old)}</div></div>` : ''}${r.keep ? `<div class="dl dl-keep"><i>=</i><div>${md(r.keep)}</div></div>` : ''}${r.new ? `<div class="dl dl-new"><i>+</i><div>${md(r.new)}</div></div>` : ''}${r.note ? `<div class="dl-note">${md(r.note)}</div>` : ''}</div></div>`).join('')}</div>`);
    }
    case 'hbar': { const mx = b.max || Math.max(...b.data.map((d) => d.v)); return w(`<div class="chart"><h4 data-s="${esc(plain(b.title))}">${md(b.title)}</h4>${b.note ? `<p class="cn">${md(b.note)}</p>` : ''}${b.data.map((d) => `<div class="hb" ${d.c ? `style="--hc:var(--${d.c}-rgb)"` : b.c ? `style="--hc:var(--${b.c}-rgb)"` : ''}><span>${md(d.l)}</span><span class="hb-t"><i style="--w:${Math.max(1.5, (d.v / mx) * 100)}%"></i></span><b>${esc(d.t ?? d.v.toLocaleString('ru-RU'))}${esc(b.unit || '')}</b></div>`).join('')}</div>`); }
    case 'cols': { const mx = b.max || Math.max(...b.data.map((d) => d.v)); return w(`<div class="chart"><h4>${md(b.title)}</h4>${b.note ? `<p class="cn">${md(b.note)}</p>` : ''}<div class="cols">${b.data.map((d) => `<div class="col" ${d.c ? `style="--hc:var(--${d.c}-rgb)"` : ''}><b>${esc(d.t ?? d.v)}</b><i style="--h:${Math.max(3, (d.v / mx) * 100)}%"></i><span>${md(d.l)}</span></div>`).join('')}</div></div>`); }
    case 'funnel': return w(`<div class="chart"><h4>${md(b.title)}</h4>${b.note ? `<p class="cn">${md(b.note)}</p>` : ''}<div class="funnel">${b.data.map((d, i) => `<div class="fn" style="--w:${100 - i * (70 / Math.max(1, b.data.length - 1))}%"><span>${md(d.l)}</span><span>${esc(d.t)}</span></div>`).join('')}</div></div>`);
    case 'donut': { const tot = b.data.reduce((s, d) => s + d.v, 0); let acc = 0; const COL = ['var(--rose)', 'var(--ember)', 'var(--orchid)', 'var(--mint)', 'var(--sky)', 'var(--lemon)']; const g = b.data.map((d, i) => { const a = acc / tot * 100; acc += d.v; return `${COL[i % 6]} ${a}% ${acc / tot * 100}%`; }).join(','); return w(`<div class="chart"><h4>${md(b.title)}</h4>${b.note ? `<p class="cn">${md(b.note)}</p>` : ''}<div class="donut"><div class="donut-r" style="--g:${g}" data-c="${esc(b.center || tot)}" role="img" aria-label="${esc(plain(b.title))}"></div><ul class="legend">${b.data.map((d, i) => `<li><i style="--lc:${COL[i % 6]}"></i>${md(d.l)} — <b>${esc(d.t ?? d.v)}</b></li>`).join('')}</ul></div></div>`); }
    case 'palette': {
      const on = (h) => (contrast(h, '#000000') > contrast(h, '#ffffff') ? '#0b0610' : '#ffffff');
      const sw = b.items.map((i) => `<button class="sw" style="--sw:${i.hex};--on:${on(i.hex)}" data-copy="${i.hex}" aria-label="Скопировать ${i.hex}"><span>${esc(i.n)}</span><small>${i.hex.toUpperCase()}${i.role ? ' · ' + esc(i.role) : ''}</small></button>`).join('');
      const tbl = b.pairs ? `<div class="tbl-wrap" style="margin-top:12px"><div class="tbl-scroll"><table><thead><tr><th>Пара (текст на фоне)</th><th>Контраст</th><th>Обычный текст AA ≥4,5</th><th>Крупный/UI AA ≥3</th></tr></thead><tbody>${b.pairs.map((p) => { const r = contrast(p.fg, p.bg); return `<tr><td>${esc(p.l)} <code>${p.fg}</code> на <code>${p.bg}</code></td><td data-v="${r.toFixed(2)}"><b>${r.toFixed(2).replace('.', ',')}:1</b></td><td><span class="chip ${r >= 4.5 ? 'chip-ok' : 'chip-bad'}">${r >= 4.5 ? 'проходит' : 'не проходит'}</span></td><td><span class="chip ${r >= 3 ? 'chip-ok' : 'chip-bad'}">${r >= 3 ? 'проходит' : 'не проходит'}</span></td></tr>`; }).join('')}</tbody></table></div><div class="tbl-note">Контраст рассчитан сборщиком по формуле WCAG 2.2 для сплошных sRGB-цветов; градиенты и состояния проверяйте отдельно.</div></div>` : '';
      return w(`<h4 data-s="${esc(plain(b.title))}" style="margin-bottom:10px">${md(b.title)}</h4><div class="pal">${sw}</div>${b.note ? `<p class="pal-meta">${md(b.note)}</p>` : ''}${tbl}`);
    }
    case 'checklist': return w(`<ul class="chk" data-chk="${esc(b.id)}">${b.items.map((i, k) => `<li data-s="${esc(plain(i))}"><label><input type="checkbox" data-k="${k}"><span>${md(i)}</span></label></li>`).join('')}</ul>`);
    case 'kv': return w(`<div class="kv">${b.items.map(([k, v]) => `<div>${md(k)}</div><div>${md(v)}</div>`).join('')}</div>`);
    case 'two': return w(`<div class="two"><div>${blocks(b.l, ctx)}</div><div>${blocks(b.r, ctx)}</div></div>`);
    case 'sources': return w(`<ol class="src">${b.items.map(([l, u, n]) => `<li data-s="${esc(l)}"><a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(l)}</a>${n ? ` — ${md(n)}` : ''}</li>`).join('')}</ol>`);
    case 'html': return b.x;
    case 'calc': return w(`<div class="tool" id="calc"><div class="tool-h"><h4 data-s="Калькулятор юнит-экономики">Калькулятор юнит-экономики Ask Me</h4><span class="ev ev-model" title="${esc(EV.model[1])}">МОДЕЛЬ</span></div><div class="ctl-grid">${[
      ['price', 'Цена пака, $', 9.99, 0.99, 29.99, 0.5, '$'], ['conv', 'Посетитель → покупка', 3, 0.2, 12, 0.1, '%'], ['rep', 'Покупок на плательщика за 90 дней', 1.2, 1, 3, 0.1, ''],
      ['vat', 'НДС/налог в цене', 20, 0, 27, 1, '%'], ['ref', 'Возвраты', 5, 0, 20, 0.5, '%'], ['fee', 'Комиссия провайдера (% от цены)', 5, 0, 30, 0.5, '%'],
      ['fix', 'Фикс. комиссия за платёж, $', 0.5, 0, 1.5, 0.05, '$'], ['vc', 'Прочие затраты на покупку, $', 0.1, 0, 2, 0.05, '$'], ['cpc', 'Цена клика (реклама), $', 0.6, 0.05, 3, 0.05, '$'],
      ['cc', 'Клик → покупка', 2, 0.1, 10, 0.1, '%'], ['fixed', 'Фиксированные расходы в месяц, $', 50, 0, 500, 5, '$'], ['want', 'Желаемый доход основателя в месяц, $', 2000, 0, 8000, 100, '$']]
      .map(([n, l, v, mn, mx, st, u]) => `<div class="ctl"><label for="c-${n}">${l}<output></output></label><input id="c-${n}" name="${n}" type="range" min="${mn}" max="${mx}" step="${st}" value="${v}" data-u="${u === '$' ? '' : u}"></div>`).join('')}</div><div class="res-grid">
      <div class="res" id="r-first"><b></b><small>Вклад первой покупки</small></div><div class="res" id="r-ltv"><b></b><small>Вклад за 90 дней на плательщика</small></div><div class="res" id="r-cac"><b></b><small>Предельный CAC при LTV/CAC = 3</small></div><div class="res" id="r-visit"><b></b><small>Предельная цена одного посетителя</small></div><div class="res" id="r-ad"><b></b><small>Ваш CAC из рекламы (CPC ÷ конверсия)</small></div><div class="res" id="r-v1"><b></b><small>Посетителей/мес, чтобы покрыть фикс. расходы</small></div><div class="res" id="r-v2"><b></b><small>Посетителей/мес для расходов + дохода</small></div></div><p id="r-msg" style="margin:16px 0 0;font-weight:600"></p><p style="margin:8px 0 0;font-size:13.5px;color:var(--t3)">Формула: цена ÷ (1 + НДС) × (1 − возвраты) − цена × комиссия − фикс. комиссия − прочие затраты. Налоги ФОП, ЕСВ, зарплата и поддержка не включены.</p></div>`);
    case 'names': return w(`<div class="tool" id="names"><div class="tool-h"><h4 data-s="Обозреватель названий">Обозреватель названий</h4><span class="cnt"></span></div><div class="filters">${[['all', 'Все'], ['latin', 'Латынь'], ['english', 'Английские'], ['invented', 'Придуманные'], ['ua', 'Украинская транслитерация'], ['compound', 'Составные'], ['old', 'Из прошлого файла']].map(([g, l], i) => `<button class="fchip" data-g="${g}" aria-pressed="${i === 0}">${l}</button>`).join('')}</div><div class="filters"><button class="fchip" data-f="com" aria-pressed="false">.com свободен</button><button class="fchip" data-f="app" aria-pressed="false">.app свободен</button><button class="fchip" data-f="play" aria-pressed="false">В Google Play нет совпадений</button><button class="fchip" data-f="pick" aria-pressed="false">Только мой шорт-лист</button><input class="field" type="search" placeholder="Поиск по названию или смыслу" aria-label="Поиск названия"><select class="field" aria-label="Сортировка"><option value="sc">Сначала лучшие по баллу</option><option value="n">По алфавиту</option></select></div><div class="tbl-wrap long" style="max-height:none"><div class="tbl-scroll" style="max-height:min(70vh,720px)"><table><thead><tr><th>Название</th><th>Смысл / психология</th><th>Балл</th><th>.com</th><th>.app</th><th>.party</th><th>.io</th><th>.game</th><th>Google Play</th></tr></thead><tbody></tbody></table></div><div class="tbl-note">Балл (0–10) — только техническая доступность: .com +3, .app +1,5, .party +1, .io +0,5, Google Play без совпадений +3 / «похожее» +1, длина ≤7 +1. Он ничего не говорит о произносимости и праве на торговую марку.</div></div><script type="application/json" id="data-names">${JSON.stringify(ctx.data.names).replace(/</g, '\\u003c')}</script></div>`);
    case 'bank': return w(`<div class="tool" id="bank"><div class="tool-h"><h4 data-s="Банк карточек">Банк карточек: вопросы, действия, форфейты</h4><span class="cnt"></span></div><div class="filters"><span style="align-self:center;color:var(--t3);font-size:13.5px">Тип:</span>${[['all', 'Все'], ['q', 'Вопросы'], ['d', 'Действия'], ['f', 'Форфейты'], ['c', 'Выбор']].map(([v, l], i) => `<button class="fchip" data-bk="k" data-v="${v}" aria-pressed="${i === 0}">${l}</button>`).join('')}</div><div class="filters"><span style="align-self:center;color:var(--t3);font-size:13.5px">Для кого:</span>${[['all', 'Все'], ['g', 'Компания'], ['c', 'Пара']].map(([v, l], i) => `<button class="fchip" data-bk="a" data-v="${v}" aria-pressed="${i === 0}">${l}</button>`).join('')}<span style="align-self:center;color:var(--t3);font-size:13.5px;margin-left:8px">Острота:</span>${[['all', 'Любая'], ['1', 'Лёгкая'], ['2', 'Средняя'], ['3', 'Острая']].map(([v, l], i) => `<button class="fchip" data-bk="l" data-v="${v}" aria-pressed="${i === 0}">${l}</button>`).join('')}</div><div class="filters"><input class="field" type="search" placeholder="Поиск по тексту (RU/EN)" aria-label="Поиск карточки"><button class="pill-btn" data-export="csv">⬇ CSV</button><button class="pill-btn" data-export="json">⬇ JSON</button></div><div class="bank-grid"></div><button class="pill-btn more-btn">Показать ещё</button><script type="application/json" id="data-bank">${JSON.stringify(ctx.data.bank).replace(/</g, '\\u003c')}</script></div>`);
    default: throw new Error('Неизвестный блок: ' + b.t);
  }
}

export function chapter(ch, ctx) {
  const v = ch.verdict;
  return `<section class="chapter" id="${ch.id}" data-chapter><div class="wrap"><header class="ch-head"><div class="ch-num" aria-hidden="true">${ch.num}</div><div class="ch-part"><span class="ic" aria-hidden="true">${ch.icon}</span>${esc(ch.part)}</div><h2 data-s="${esc(ch.title)}">${esc(ch.title)}</h2>${ch.sub ? `<p class="ch-sub">${md(ch.sub)}</p>` : ''}${v ? `<div class="verdict v-${v.tone}"><b>${{ go: '🟢 Вердикт главы', test: '🟡 Вердикт главы', stop: '🔴 Вердикт главы', info: '🔵 Вердикт главы' }[v.tone]}</b><p>${md(v.x)}</p></div>` : ''}</header>${blocks(ch.blocks, ctx)}</div></section>`;
}
