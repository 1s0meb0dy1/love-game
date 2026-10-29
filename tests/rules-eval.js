// Небольшой вычислитель правил Firebase Realtime Database для тестов: проверяет запись по тому же JSON, что лежит в консоли (tests/fixtures/*-rules.json).
// Синтаксис выражений правил совместим с JS, поэтому они считаются через `new Function`. Это не полный эмулятор Firebase, а то, что нужно проверкам:
//   makeRules(json).check(method, path, auth, data) -> null (запись разрешена) | строка с причиной отказа.
// Что умеет:
//   .write — сверху вниз по пути записи, достаточно одного true (как в Firebase: разрешение «стекает» вниз);
//   .validate — для узла, куда пишем, и для всех присутствующих потомков (пустые null пропускаются); при DELETE (data = null) не проверяется;
//   узлы-шаблоны ($id, $room…): их значение подставляется переменной в выражения; явное дочернее правило важнее $other и любого другого шаблона;
//   в выражениях: auth, newData (child, hasChildren, hasChild, isString, isNumber, isBoolean, exists, val), now, переменные шаблонов.
// Чего не умеет — и в таких случаях всегда возвращает отказ с причиной, тихого «разрешено» не бывает:
//   data, root, строковые методы Firebase (matches, contains…) — выражение упадёт, и вернётся отказ с текстом ошибки;
//   запись НИЖЕ узла с .validate (например, одно поле внутри карточки: tod/<id>/text) — отказ «не поддержано: .validate предка…»: newData предка зависит от
//   соседних данных, которых у вычислителя нет (для PUT и для DELETE одинаково); запись в сам узел с .validate (tod/<id>) и в узлы выше него (tod), где .validate нет, работает;
//   .read не применяется (чтение в тестах не ограничивается).
const wrap = (v) => {
  const obj = v !== null && typeof v === 'object';
  return {
    val: () => (v === undefined ? null : v),
    exists: () => v !== undefined && v !== null,
    isString: () => typeof v === 'string',
    isNumber: () => typeof v === 'number' && Number.isFinite(v),
    isBoolean: () => typeof v === 'boolean',
    child: (k) => wrap(obj ? v[k] : undefined),
    hasChild: (k) => obj && v[k] !== undefined && v[k] !== null,
    hasChildren: (keys) => obj && (Array.isArray(keys) ? keys.every(k => v[k] !== undefined && v[k] !== null) : Object.keys(v).length > 0),
  };
};

// значение правила: true/false или выражение-строка; выражение с ошибкой — отказ (как в Firebase)
const evalRule = (rule, ctx) => {
  if (typeof rule === 'boolean') return { ok: rule };
  try {
    const names = ['auth', 'newData', 'now'].concat(Object.keys(ctx.vars));
    const fn = new Function(...names, '"use strict"; return (' + rule + ');');
    return { ok: fn(ctx.auth, ctx.newData, Date.now(), ...Object.keys(ctx.vars).map(k => ctx.vars[k])) === true };
  } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
};

// дочерний узел правил: явное имя важнее шаблона ($…); ключи с точкой (.write…) и служебные строки (_comment) — не узлы
const childRule = (node, key) => {
  if (!node || typeof node !== 'object') return null;
  const isNode = (k) => k[0] !== '.' && node[k] !== null && typeof node[k] === 'object';
  if (Object.prototype.hasOwnProperty.call(node, key) && isNode(key) && key[0] !== '$') return { rule: node[key], vars: {} };
  const wild = Object.keys(node).find(k => k[0] === '$' && isNode(k));
  return wild ? { rule: node[wild], vars: { [wild]: key } } : null;
};

module.exports.makeRules = function makeRules(json) {
  // проверка .validate для значения и всех его потомков; возвращает null или причину
  const validate = (rule, vars, value, at, auth) => {
    if (value === null || value === undefined) return null;
    if (rule && rule['.validate'] !== undefined) {
      const r = evalRule(rule['.validate'], { auth, newData: wrap(value), vars });
      if (!r.ok) return '.validate отклонил ' + (at.join('/') || '(корень)') + (r.error ? ' (ошибка в выражении: ' + r.error + ')' : '');
    }
    if (value !== null && typeof value === 'object') {
      for (const k of Object.keys(value)) {
        const c = childRule(rule, k);
        const err = validate(c && c.rule, c ? { ...vars, ...c.vars } : vars, value[k], at.concat(k), auth);
        if (err) return err;
      }
    }
    return null;
  };

  return {
    check(method, path, auth, data) {
      const del = String(method).toUpperCase() === 'DELETE';
      const value = del ? null : data;
      let node = json, vars = {}, allowed = false, ancestorValidate = null; const errors = [];
      const tryWrite = (n, depth) => {
        if (!n || n['.write'] === undefined || allowed) return;
        // newData для .write доступна только на самом узле записи: у предков она зависит от соседних данных
        const r = evalRule(n['.write'], { auth, newData: depth === path.length ? wrap(value) : null, vars });
        if (r.ok) allowed = true; else if (r.error) errors.push(r.error);
      };
      tryWrite(node, 0);
      for (let i = 0; i < path.length; i++) {
        if (node && node['.validate'] !== undefined && !ancestorValidate) ancestorValidate = path.slice(0, i).join('/') || '(корень)'; // строгий предок узла записи
        const c = childRule(node, String(path[i]));
        if (!c) { node = null; break; }
        node = c.rule; vars = { ...vars, ...c.vars }; tryWrite(node, i + 1);
      }
      if (!allowed) return 'нет разрешения на запись в ' + path.join('/') + (errors.length ? ' (ошибка в выражении: ' + errors[0] + ')' : '');
      if (ancestorValidate) return 'не поддержано: .validate предка ' + ancestorValidate + ' при записи в ' + path.join('/') + ' (вычислитель не знает соседних данных предка)';
      if (del) return null;
      return validate(node, vars, value, path.map(String), auth);
    },
  };
};
