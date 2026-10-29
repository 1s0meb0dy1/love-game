// Режим «Правда или действие»: текст подколки. Событие (st.ev) задаёт движок, а реплику каждое устройство выбирает само,
// детерминированно по gid, seq и событию, поэтому на всех экранах одна и та же строка и по сети её передавать не нужно.
import { todHash } from './deck.js';

// подстановка за один проход: {name} -> имя, {a|b} -> форма по полу (guy -> a, girl -> b). Подставленное имя повторно не разбирается
export const todExpand = (template, player) => {
  const name = String((player && player.name) || ''); const girl = !!player && player.gender === 'girl';
  return String(template || '').replace(/\{name\}|\{([^{}|]*)\|([^{}|]*)\}/g, (m, a, b) => (m === '{name}' ? name : girl ? b : a));
};

// реплика к последнему событию: '' при выключенном тоне или если строк для события нет. Тон 2 берёт строки тона 2, а без них — тона 1.
// tf — необязательный перевод шаблона (t из src/i18n.js): переводится шаблон до подстановки, поэтому имя не попадает в словарь
export const todPickBanter = (state, lines, tf) => {
  if (!state || !state.opts || state.opts.tone === 0 || !state.ev || !Array.isArray(lines)) return '';
  const k = state.ev.k; const of = (tone) => lines.filter(l => l && l.ev === k && l.tone === tone);
  let cand = state.opts.tone === 2 ? of(2) : of(1);
  if (!cand.length && state.opts.tone === 2) cand = of(1);
  if (!cand.length) return '';
  const line = cand[todHash(state.gid + ':' + state.ev.seq + ':' + k) % cand.length];
  const player = Array.isArray(state.pl) ? state.pl[state.ev.p] : null;
  const tpl = typeof tf === 'function' ? tf(line.text) : line.text;
  return todExpand(tpl, player || { name: '', gender: 'guy' });
};
