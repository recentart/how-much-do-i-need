// Browser runtime for a calculator page. The page arrives with the form and the default result
// already rendered; this wires up live recalculation, the US/Metric switch, extra areas, share links,
// the printable shopping list, errors and reset.
// Nothing here talks to the network: once the page has loaded, it works offline.

import { UNITS, convert } from './units.mjs';
import { validate, calculate, fieldDefault, isVisible, extraAreaFields, MAX_EXTRA_AREAS } from './validate.mjs';
import { renderResult, resultSummary, renderExtraArea, renderPrintList } from './render.mjs';

const UNIT_PREF_KEY = 'hmdin-unit-system';

function readPref() {
  try {
    return localStorage.getItem(UNIT_PREF_KEY);
  } catch {
    return null;
  }
}

function writePref(value) {
  try {
    localStorage.setItem(UNIT_PREF_KEY, value);
  } catch {
    /* storage unavailable (private mode, blocked): the switch still works for this page */
  }
}

// Keep converted numbers readable: 3.6576 m -> 3.66, 0.3175 cm -> 0.318
function tidy(x) {
  if (!Number.isFinite(x)) return '';
  const n = Math.abs(x) >= 1 ? Number(x.toFixed(2)) : Number(x.toPrecision(3));
  return String(n);
}

export function mount(def) {
  const form = document.getElementById('calc-form');
  const out = document.getElementById('calc-result');
  const live = document.getElementById('result-live');
  const printBox = document.getElementById('print-summary');
  const statusBox = form && form.querySelector('[data-form-status]');
  const areaRows = form && form.querySelector('[data-extra-area-rows]');
  if (!form || !out) return;

  const touched = new Set();
  const input = (name) => form.elements.namedItem(name);
  const unitSelect = (name) => form.elements.namedItem(`${name}__unit`);
  const systemRadios = [...form.querySelectorAll('input[name="_system"]')];
  const checkedSystem = () => (systemRadios.find((r) => r.checked) || { value: 'us' }).value;
  let system = checkedSystem();
  let lastHtml = null;
  let lastModel = null;
  let workingOpen = true; // remembered even while the result is temporarily an error message
  let areaCount = 0; // extra rectangles, numbered Area 2, Area 3, …
  // Values the US/Metric switch converted, so switching straight back restores exactly what was typed
  // (7 ft -> 2.13 m -> 7 ft, not 6.99 ft).
  const conversions = new Map();

  const areaNumbers = () => Array.from({ length: areaCount }, (_, i) => i + 2);
  const extraFields = () => (def.areas ? areaNumbers().flatMap((n) => extraAreaFields(def, n)) : []);
  // Every field that holds a number, including the extra area rows.
  const numberFields = () => [...def.inputs.filter((f) => f.type !== 'checkbox' && f.type !== 'select'), ...extraFields()];
  const measureFields = () => numberFields().filter((f) => f.type === 'measure');

  const readMeasure = (name, withUnit) => {
    const el = input(name);
    return { text: el.value, bad: Boolean(el.validity && el.validity.badInput), unit: withUnit ? unitSelect(name).value : undefined };
  };

  function readRaw() {
    const raw = {};
    for (const f of def.inputs) {
      const el = input(f.name);
      if (f.type === 'checkbox') raw[f.name] = el.checked;
      else if (f.type === 'select') raw[f.name] = el.value;
      else raw[f.name] = readMeasure(f.name, f.type === 'measure');
    }
    if (def.areas) {
      raw.extraAreas = areaNumbers().map((n) => ({
        length: readMeasure(`xa${n}_length`, true),
        width: readMeasure(`xa${n}_width`, true),
      }));
    }
    return raw;
  }

  // ---- extra areas ----

  function setAreas(rows) {
    // rows: [{ length: {text, unit}, width: {text, unit} }]
    if (!areaRows) return;
    areaCount = Math.min(rows.length, MAX_EXTRA_AREAS);
    areaRows.innerHTML = areaNumbers()
      .map((n) => renderExtraArea(extraAreaFields(def, n), n, system))
      .join('');
    areaNumbers().forEach((n, i) => {
      for (const key of ['length', 'width']) {
        const r = rows[i][key] || {};
        const name = `xa${n}_${key}`;
        input(name).value = r.text || '';
        const sel = unitSelect(name);
        if (r.unit && [...sel.options].some((o) => o.value === r.unit)) sel.value = r.unit;
      }
    });
    const add = form.querySelector('[data-action="add-area"]');
    if (add) add.hidden = areaCount >= MAX_EXTRA_AREAS;
  }

  function addArea() {
    const rows = readRaw().extraAreas;
    // A new rectangle starts empty, in the same units as the main one.
    rows.push({
      length: { text: '', unit: unitSelect(def.areas.length).value },
      width: { text: '', unit: unitSelect(def.areas.width).value },
    });
    setAreas(rows);
    const first = input(`xa${areaCount + 1}_length`);
    if (first) first.focus();
    update();
  }

  function removeArea(n) {
    const rows = readRaw().extraAreas.filter((_, i) => i + 2 !== n);
    for (const key of [...touched]) if (key.startsWith('xa')) touched.delete(key);
    setAreas(rows);
    update();
    const add = form.querySelector('[data-action="add-area"]');
    if (add) add.focus();
  }

  // ---- defaults, units ----

  function setDefaults(sys) {
    conversions.clear();
    for (const f of def.inputs) {
      const d = fieldDefault(f, sys);
      const el = input(f.name);
      if (f.type === 'checkbox') el.checked = d;
      else if (f.type === 'select') el.value = d;
      else {
        el.value = d.text;
        if (f.type === 'measure') unitSelect(f.name).value = d.unit;
      }
    }
    setAreas([]);
  }

  function applyLabels() {
    for (const el of form.querySelectorAll('[data-label-us]')) {
      el.textContent = system === 'metric' ? el.dataset.labelMetric : el.dataset.labelUs;
    }
  }

  // Switch every measurement to the other system. Untouched defaults become that system's
  // defaults (round metric numbers, not 3.66 m); anything the user typed is converted.
  function switchSystem(next) {
    if (next === system) return;
    for (const f of measureFields()) {
      if (!f.default[next]) continue;
      const el = input(f.name);
      const sel = unitSelect(f.name);
      const current = sel.value;
      if (UNITS[f.dim][current].system === next) continue;
      const text = el.value.trim();
      const back = conversions.get(f.name);
      if (back && back.toText === text && back.toUnit === current && UNITS[f.dim][back.fromUnit].system === next) {
        el.value = back.fromText;
        sel.value = back.fromUnit;
        conversions.delete(f.name);
        continue;
      }
      const oldDefault = fieldDefault(f, system);
      const newDefault = fieldDefault(f, next);
      const n = Number(text);
      if (text !== '' && Number.isFinite(n)) {
        const isOldDefault = n === Number(oldDefault.text) && current === oldDefault.unit && !f.name.startsWith('xa');
        el.value = isOldDefault ? newDefault.text : tidy(convert(n, f.dim, current, newDefault.unit));
        conversions.set(f.name, { fromText: text, fromUnit: current, toText: el.value, toUnit: newDefault.unit });
      }
      sel.value = newDefault.unit;
    }
    system = next;
    for (const r of systemRadios) r.checked = r.value === next;
    applyLabels();
  }

  // ---- share links ----

  function shareUrl() {
    const p = new URLSearchParams();
    if (systemRadios.length) p.set('units', system);
    for (const f of def.inputs) {
      const el = input(f.name);
      if (f.type === 'checkbox') p.set(f.name, el.checked ? '1' : '0');
      else if (f.type === 'select') p.set(f.name, el.value);
      else {
        p.set(f.name, el.value.trim());
        if (f.type === 'measure') p.set(`${f.name}_u`, unitSelect(f.name).value);
      }
    }
    for (const f of extraFields()) {
      p.set(f.name, input(f.name).value.trim());
      p.set(`${f.name}_u`, unitSelect(f.name).value);
    }
    return `${location.origin}${location.pathname}?${p}`;
  }

  // Values arriving in the URL are only ever placed into the form, then validated like typed input.
  function applyParams(params) {
    if (!def.inputs.some((f) => params.has(f.name))) return false;
    const sys = params.get('units');
    if (systemRadios.length && (sys === 'us' || sys === 'metric')) {
      system = sys;
      for (const r of systemRadios) r.checked = r.value === sys;
    }
    const setUnit = (name, units) => {
      const u = params.get(`${name}_u`);
      if (u && units.includes(u)) unitSelect(name).value = u;
    };
    for (const f of def.inputs) {
      if (!params.has(f.name)) continue;
      const v = params.get(f.name);
      const el = input(f.name);
      if (f.type === 'checkbox') el.checked = v === '1';
      else if (f.type === 'select') {
        if ([...el.options].some((o) => o.value === v)) el.value = v;
      } else {
        el.value = v.slice(0, 40);
        if (f.type === 'measure') setUnit(f.name, f.units);
      }
    }
    if (def.areas) {
      const rows = [];
      for (let n = 2; n <= MAX_EXTRA_AREAS + 1 && params.has(`xa${n}_length`); n++) {
        const [L, W] = extraAreaFields(def, n);
        const unitOf = (f) => {
          const u = params.get(`${f.name}_u`);
          return u && f.units.includes(u) ? u : undefined;
        };
        rows.push({
          length: { text: (params.get(L.name) || '').slice(0, 40), unit: unitOf(L) },
          width: { text: (params.get(W.name) || '').slice(0, 40), unit: unitOf(W) },
        });
      }
      setAreas(rows);
    }
    applyLabels();
    return true;
  }

  function setStatus(text, url) {
    if (!statusBox) return;
    statusBox.textContent = text;
    if (url) {
      const box = document.createElement('input');
      box.className = 'input share-url';
      box.readOnly = true;
      box.value = url;
      box.setAttribute('aria-label', 'Link to this result');
      statusBox.append(' ', box);
      box.select();
    }
  }

  async function share() {
    const url = shareUrl();
    form.dataset.shareUrl = url;
    // Some browsers leave the clipboard request pending (e.g. waiting on a permission), so don't wait
    // more than a moment before offering the link to copy by hand.
    const copied = await Promise.race([
      navigator.clipboard ? navigator.clipboard.writeText(url).then(() => true, () => false) : Promise.resolve(false),
      new Promise((resolve) => setTimeout(() => resolve(false), 1500)),
    ]);
    if (copied) setStatus('Link copied. Anyone who opens it sees these numbers.');
    else setStatus('Copy this link:', url);
  }

  // ---- errors, announcements, printing ----

  function setFieldError(name, message) {
    const el = input(name);
    const box = document.getElementById(`f-${name}-error`);
    if (!box || !el) return;
    const ids = (el.getAttribute('aria-describedby') || '').split(' ').filter((id) => id && id !== box.id);
    if (message) {
      box.textContent = message;
      box.hidden = false;
      el.setAttribute('aria-invalid', 'true');
      ids.push(box.id);
    } else {
      box.textContent = '';
      box.hidden = true;
      el.removeAttribute('aria-invalid');
    }
    if (ids.length) el.setAttribute('aria-describedby', ids.join(' '));
    else el.removeAttribute('aria-describedby');
  }

  let announceTimer = 0;
  function announce(text) {
    if (!live) return;
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => {
      live.textContent = text;
    }, 700);
  }

  // The inputs as a reader would describe them, for the printed list: "Room length: 12 ft".
  function inputSummary() {
    const rows = [];
    for (const f of [...def.inputs, ...extraFields()]) {
      const wrap = form.querySelector(`[data-field="${f.name}"]`);
      if (!wrap || wrap.hidden) continue;
      const label = (wrap.querySelector('label') || {}).textContent || f.label;
      const clean = label.replace(/\s*\(optional\)|\s*\(percent\)/g, '').trim();
      const el = input(f.name);
      let value;
      if (f.type === 'checkbox') value = el.checked ? 'Yes' : 'No';
      else if (f.type === 'select') value = el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : '';
      else {
        if (el.value.trim() === '') continue;
        value = el.value.trim();
        if (f.type === 'measure') value += ` ${UNITS[f.dim][unitSelect(f.name).value].label}`;
        if (f.type === 'percent') value += '%';
      }
      rows.push([clean, value]);
    }
    return rows;
  }

  function renderPrint(model) {
    if (printBox) printBox.innerHTML = renderPrintList(def.name, model, inputSummary(), shareUrl());
  }

  function update({ quiet = false } = {}) {
    const raw = readRaw();
    for (const f of def.inputs) {
      if (!f.showIf) continue;
      const wrap = form.querySelector(`[data-field="${f.name}"]`);
      if (wrap) wrap.hidden = !isVisible(f, raw);
    }

    for (const group of form.querySelectorAll('.field-group')) {
      group.hidden = !group.querySelector('.field:not([hidden])');
    }

    const v = validate(def, raw);
    for (const f of numberFields()) {
      const message = v.errors[f.name];
      const show = message && (!v.emptyRequired.includes(f.name) || touched.has(f.name));
      setFieldError(f.name, show ? message : '');
    }

    const model = v.ok ? calculate(def, v.values, { system, units: v.units }).model : { error: v.message };
    lastModel = model;
    // Read the working section's state directly too: its "toggle" event arrives a moment after a
    // click, and would be lost if the section were replaced in between.
    const working = out.querySelector('details.result-working');
    if (working) workingOpen = working.open;
    const html = renderResult(model, { workingOpen });
    // Only touch the DOM when the result actually changed. Rebuilding it on every blur would
    // destroy the element under the pointer mid-click (e.g. the "How this was calculated" toggle).
    if (html !== lastHtml) {
      out.innerHTML = html;
      lastHtml = html;
      out.classList.toggle('is-empty', Boolean(model.error));
      if (!quiet) announce(resultSummary(model));
    }
    renderPrint(model);
  }

  // The "link copied" message stays until a value actually changes.
  function clearStatus() {
    if (statusBox && statusBox.textContent) setStatus('');
  }

  // <details> toggle events don't bubble, so listen in the capture phase.
  out.addEventListener(
    'toggle',
    (e) => {
      if (e.target.matches && e.target.matches('details.result-working')) {
        workingOpen = e.target.open;
        lastHtml = renderResult(lastModel, { workingOpen });
      }
    },
    true,
  );

  form.addEventListener('input', (e) => {
    if (e.target.name === '_system' || e.target.classList.contains('share-url')) return;
    clearStatus();
    update();
  });
  form.addEventListener('change', (e) => {
    if (e.target.classList.contains('share-url')) return;
    clearStatus();
    if (e.target.name === '_system') {
      switchSystem(e.target.value);
      writePref(e.target.value);
    }
    update();
  });
  form.addEventListener('focusout', (e) => {
    const name = e.target.name && !e.target.name.startsWith('_') ? e.target.name.replace(/__unit$/, '') : null;
    if (name && !touched.has(name)) {
      touched.add(name);
      update(); // may reveal an error for a field left empty
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    for (const f of numberFields()) touched.add(f.name);
    update();
  });
  form.addEventListener('click', (e) => {
    const button = e.target.closest && e.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'reset') {
      setDefaults(system);
      touched.clear();
      update({ quiet: true });
      announce(`Values reset to the defaults. ${resultSummary(lastModel)}`);
    } else if (action === 'add-area') addArea();
    else if (action === 'remove-area') removeArea(Number(button.dataset.area));
    else if (action === 'share') share();
    else if (action === 'print') {
      renderPrint(lastModel);
      window.print();
    }
  });
  window.addEventListener('beforeprint', () => renderPrint(lastModel));

  // If the browser restores the page or its form values (Back/Forward), recalculate from what is
  // actually in the form so the result can never disagree with the inputs.
  window.addEventListener('pageshow', () => {
    system = checkedSystem();
    applyLabels();
    conversions.clear();
    lastHtml = null;
    update({ quiet: true });
  });

  // A shared link wins over the remembered unit preference.
  const fromLink = applyParams(new URLSearchParams(location.search));
  if (!fromLink && systemRadios.length && readPref() === 'metric' && system !== 'metric') switchSystem('metric');
  applyLabels();
  update({ quiet: true });
  form.classList.add('is-live');
}
