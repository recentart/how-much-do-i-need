// HTML for calculator forms and results. Used by the build (to pre-render every page with its
// default result, so it works and reads well before any JavaScript runs) and by the browser
// (to re-render the result as values change). Everything interpolated is escaped.

import { UNITS } from './units.mjs';
import { fieldDefault, defaultRaw, isVisible } from './validate.mjs';

export function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const fid = (name) => `f-${name}`;

// A calculator gets the US/Metric switch if any of its fields has units in both systems.
export function hasSystemToggle(def) {
  return def.inputs.some((f) => f.type === 'measure' && f.default.us && f.default.metric);
}

function helpHtml(f) {
  return f.help ? `<p class="field-help" id="${fid(f.name)}-help">${esc(f.help)}</p>` : '';
}

function errorHtml(f) {
  return `<p class="field-error" id="${fid(f.name)}-error" hidden></p>`;
}

function describedBy(f) {
  return f.help ? ` aria-describedby="${fid(f.name)}-help"` : '';
}

function numberInput(f, text, extra = '') {
  const decimal = f.type !== 'count';
  const min = f.min ?? 0;
  return `<input class="input" id="${fid(f.name)}" name="${f.name}" type="number" inputmode="${decimal ? 'decimal' : 'numeric'}" step="${decimal ? 'any' : '1'}" min="${min}"${f.max != null ? ` max="${f.max}"` : ''} value="${esc(text)}"${f.optional ? '' : ' required'}${describedBy(f)}${extra}>`;
}

function labelText(f) {
  return `${esc(f.label)}${f.optional ? ' <span class="optional">(optional)</span>' : ''}`;
}

function renderField(f, raw) {
  const hidden = isVisible(f, raw) ? '' : ' hidden';
  const d = fieldDefault(f);
  const wrapOpen = `<div class="field field--${f.type}${f.wide ? ' field--wide' : ''}" data-field="${f.name}"${hidden}>`;

  if (f.type === 'checkbox') {
    return `${wrapOpen}
      <div class="check">
        <input id="${fid(f.name)}" name="${f.name}" type="checkbox"${d ? ' checked' : ''}${describedBy(f)}>
        <label for="${fid(f.name)}">${esc(f.label)}</label>
      </div>
      ${helpHtml(f)}
    </div>`;
  }

  if (f.type === 'select') {
    const opts = f.options
      .map((o) => `<option value="${esc(o.value)}"${o.value === d ? ' selected' : ''}>${esc(o.label)}</option>`)
      .join('');
    return `${wrapOpen}
      <label class="field-label" for="${fid(f.name)}">${labelText(f)}</label>
      <select class="input" id="${fid(f.name)}" name="${f.name}"${describedBy(f)}>${opts}</select>
      ${helpHtml(f)}
    </div>`;
  }

  if (f.type === 'measure') {
    const opts = f.units
      .map((u) => `<option value="${u}"${u === d.unit ? ' selected' : ''}>${esc(UNITS[f.dim][u].label)}</option>`)
      .join('');
    return `${wrapOpen}
      <label class="field-label" for="${fid(f.name)}">${labelText(f)}</label>
      <div class="input-group">
        ${numberInput(f, d.text)}
        <select class="unit-select" id="${fid(f.name)}-unit" name="${f.name}__unit" aria-label="${esc(f.label)} unit">${opts}</select>
      </div>
      ${helpHtml(f)}
      ${errorHtml(f)}
    </div>`;
  }

  // count, percent, number
  const suffix = f.type === 'percent' ? '%' : f.suffix;
  const srLabel = f.type === 'percent' ? '<span class="visually-hidden"> (percent)</span>' : '';
  return `${wrapOpen}
      <label class="field-label" for="${fid(f.name)}">${labelText(f)}${srLabel}</label>
      <div class="input-group${suffix ? ' has-suffix' : ''}">
        ${numberInput(f, d.text)}${suffix ? `<span class="input-suffix" aria-hidden="true">${esc(suffix)}</span>` : ''}
      </div>
      ${helpHtml(f)}
      ${errorHtml(f)}
    </div>`;
}

export function renderForm(def) {
  const raw = defaultRaw(def);
  const toggle = hasSystemToggle(def)
    ? `<fieldset class="system-toggle">
        <legend>Units</legend>
        <div class="segmented">
          <input type="radio" id="sys-us" name="_system" value="us" checked><label for="sys-us">US <span class="seg-hint">ft, in, gal</span></label>
          <input type="radio" id="sys-metric" name="_system" value="metric"><label for="sys-metric">Metric <span class="seg-hint">m, cm, L</span></label>
        </div>
      </fieldset>`
    : '';

  const groups = def.groups || [{ id: undefined, legend: null }];
  const body = groups
    .map((g) => {
      const fields = def.inputs.filter((f) => f.group === g.id).map((f) => renderField(f, raw)).join('');
      if (!fields) return '';
      return g.legend
        ? `<fieldset class="field-group"><legend>${esc(g.legend)}</legend><div class="field-grid">${fields}</div></fieldset>`
        : `<div class="field-grid">${fields}</div>`;
    })
    .join('');

  return `<form class="calc-form" id="calc-form" data-calculator="${esc(def.id)}" novalidate>
    ${toggle}
    ${body}
    <div class="form-actions">
      <button type="button" class="button button--secondary" data-action="reset">Reset to defaults</button>
      <p class="form-note">Results update as you type.</p>
    </div>
    <noscript><p class="form-note">JavaScript is turned off, so this page shows the result for the default values.</p></noscript>
  </form>`;
}

function rowsHtml(rows) {
  return rows
    .map((r) => `<div class="result-row${r.strong ? ' is-strong' : ''}"><dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd></div>`)
    .join('');
}

// Result model: { headline: {label, value, detail}, sections: [{title, kind, rows: [{label, value, strong}]}],
//                 steps: [string], notes: [string] }  — or { error: string }.
export function renderResult(model, { workingOpen = true } = {}) {
  if (!model || model.error) {
    return `<div class="result-empty"><p>${esc((model && model.error) || 'Enter your measurements to see an estimate.')}</p></div>`;
  }
  const h = model.headline;
  const sections = (model.sections || [])
    .map(
      (s) => `<section class="result-section result-section--${esc(s.kind || 'info')}">
        <h3>${esc(s.title)}</h3>
        <dl class="result-rows">${rowsHtml(s.rows)}</dl>
      </section>`,
    )
    .join('');
  const steps = model.steps && model.steps.length
    ? `<details class="result-working"${workingOpen ? ' open' : ''}>
        <summary>How this was calculated</summary>
        <ol>${model.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      </details>`
    : '';
  const notes = model.notes && model.notes.length
    ? `<ul class="result-notes">${model.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>`
    : '';
  return `<div class="result-headline">
      <p class="result-label">${esc(h.label)}</p>
      <p class="result-value">${esc(h.value)}</p>
      ${h.detail ? `<p class="result-detail">${esc(h.detail)}</p>` : ''}
    </div>
    ${sections}
    ${steps}
    ${notes}`;
}

// Short plain-text version of the headline, for the screen-reader live region.
export function resultSummary(model) {
  if (!model || model.error) return (model && model.error) || '';
  const h = model.headline;
  return `${h.label}: ${h.value}.${h.detail ? ` ${h.detail}` : ''}`;
}
