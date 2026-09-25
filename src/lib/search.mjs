// Live filter for the calculator lists on the home and "All calculators" pages.
// Without JavaScript the full list shows and the search form submits to /calculators/.

export function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Every word typed must appear somewhere in the item's search text (prefix matches count,
// so "floor" finds "flooring" and "gal" finds "gallons").
export function matches(haystack, query) {
  const words = normalize(query).split(' ').filter(Boolean);
  if (!words.length) return true;
  const tokens = haystack.split(' ');
  return words.every((w) => tokens.some((t) => t.startsWith(w)) || haystack.includes(w));
}

function init() {
  const form = document.querySelector('[data-search-form]');
  const input = form && form.querySelector('[data-search-input]');
  if (!input) return;
  const status = form.querySelector('[data-search-status]');
  const items = [...document.querySelectorAll('[data-search]')];
  const groups = [...document.querySelectorAll('[data-group]')];
  const empty = document.getElementById('no-results');

  function visibleItems() {
    return items.filter((el) => !el.hidden);
  }

  function apply() {
    const query = input.value;
    let shown = 0;
    for (const el of items) {
      const ok = matches(el.dataset.search, query);
      el.hidden = !ok;
      if (ok) shown++;
    }
    for (const g of groups) g.hidden = !g.querySelector('[data-search]:not([hidden])');
    if (empty) {
      empty.hidden = shown > 0;
      const q = empty.querySelector('[data-query]');
      if (q) q.textContent = query.trim();
    }
    if (status) {
      status.textContent = normalize(query) ? `${shown} ${shown === 1 ? 'calculator' : 'calculators'} found` : '';
    }
  }

  input.addEventListener('input', apply);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const vis = visibleItems();
    // Enter jumps straight to the calculator when the search has narrowed it to one.
    if (normalize(input.value) && vis.length === 1) {
      const link = vis[0].querySelector('a');
      if (link) window.location.assign(link.href);
    }
  });

  const q = new URLSearchParams(window.location.search).get('q');
  if (q) input.value = q;
  apply();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}
