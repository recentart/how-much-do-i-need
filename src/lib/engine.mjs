// Browser runtime for a calculator page. The page arrives with the form and the default result
// already rendered; this wires up live recalculation, the US/Metric switch, errors and reset.
// Nothing here talks to the network: once the page has loaded, it works offline.

import { UNITS, convert } from './units.mjs';
import { validate, calculate, fieldDefault, isVisible } from './validate.mjs';
import { renderResult, resultSummary } from './render.mjs';

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
  // Values the US/Metric switch converted, so switching straight back restores exactly what was typed
  // (7 ft -> 2.13 m -> 7 ft, not 6.99 ft).
  const conversions = new Map();

  function readRaw() {
    const raw = {};
    for (const f of def.inputs) {
      const el = input(f.name);
      if (f.type === 'checkbox') raw[f.name] = el.checked;
      else if (f.type === 'select') raw[f.name] = el.value;
      else {
        raw[f.name] = {
          text: el.value,
          bad: Boolean(el.validity && el.validity.badInput),
          unit: f.type === 'measure' ? unitSelect(f.name).value : undefined,
        };
      }
    }
    return raw;
  }

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
  }

  // Switch every measurement to the other system. Untouched defaults become that system's
  // defaults (round metric numbers, not 3.66 m); anything the user typed is converted.
  function switchSystem(next) {
    if (next === system) return;
    for (const f of def.inputs) {
      if (f.type !== 'measure' || !f.default[next]) continue;
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
        const isOldDefault = n === Number(oldDefault.text) && current === oldDefault.unit;
        el.value = isOldDefault ? newDefault.text : tidy(convert(n, f.dim, current, newDefault.unit));
        conversions.set(f.name, { fromText: text, fromUnit: current, toText: el.value, toUnit: newDefault.unit });
      }
      sel.value = newDefault.unit;
    }
    system = next;
    for (const r of systemRadios) r.checked = r.value === next;
  }

  function setFieldError(f, message) {
    const el = input(f.name);
    const box = document.getElementById(`f-${f.name}-error`);
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

  function update({ quiet = false } = {}) {
    const raw = readRaw();
    for (const f of def.inputs) {
      if (!f.showIf) continue;
      const wrap = form.querySelector(`[data-field="${f.name}"]`);
      if (wrap) wrap.hidden = !isVisible(f, raw);
    }

    const v = validate(def, raw);
    for (const f of def.inputs) {
      const message = v.errors[f.name];
      const show = message && (!v.emptyRequired.includes(f.name) || touched.has(f.name));
      setFieldError(f, show ? message : '');
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
    if (e.target.name === '_system') return;
    update();
  });
  form.addEventListener('change', (e) => {
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
    for (const f of def.inputs) touched.add(f.name);
    update();
  });
  const resetButton = form.querySelector('[data-action="reset"]');
  if (resetButton) {
    resetButton.addEventListener('click', () => {
      setDefaults(system);
      touched.clear();
      update({ quiet: true });
      announce(`Values reset to the defaults. ${resultSummary(lastModel)}`);
    });
  }

  // If the browser restores the page or its form values (Back/Forward), recalculate from what is
  // actually in the form so the result can never disagree with the inputs.
  window.addEventListener('pageshow', () => {
    system = checkedSystem();
    conversions.clear();
    lastHtml = null;
    update({ quiet: true });
  });

  if (systemRadios.length && readPref() === 'metric' && system !== 'metric') switchSystem('metric');
  update({ quiet: true });
  form.classList.add('is-live');
}
