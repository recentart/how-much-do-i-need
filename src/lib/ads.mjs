// Ads: consent and loading. Only included on pages when ads are switched on (see site.config.mjs).
// Each ad is an iframe pointing at a small page on this site (/ads/<unit>.html) that runs the ad
// network's code. The frame is sandboxed without allow-same-origin, so the ad code can't read the
// calculator, the page's storage, or navigate the page.

export const CONSENT_KEY = 'hmdin-ad-consent';

// Time zones where ads wait for consent: the EU/EEA, the UK and Switzerland. All of Europe/* is
// included (a few non-EU zones too, which only means those visitors are asked first).
const CONSENT_ZONES = /^(Europe\/|Arctic\/Longyearbyen$|Atlantic\/(Reykjavik|Canary|Madeira|Azores|Faroe)$|Asia\/(Nicosia|Famagusta)$)/;

export const needsConsent = (timeZone) => CONSENT_ZONES.test(timeZone || '');

// 'show' = load ads, 'hide' = no ads, 'ask' = show the consent bar and wait.
export function decide(stored, timeZone) {
  if (stored === 'yes') return 'show';
  if (stored === 'no') return 'hide';
  return needsConsent(timeZone) ? 'ask' : 'show';
}

// The widest unit that fits the available width (units: [{ width, ... }]), or null.
export function pickUnit(units, available) {
  let best = null;
  for (const u of units) if (u.width <= available && (!best || u.width > best.width)) best = u;
  return best;
}

function storageGet() {
  try {
    return localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
}

function storageSet(value) {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // Private mode or blocked storage: the choice lasts for this page only.
  }
}

function zone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    return '';
  }
}

export function mountAds(doc = document) {
  const win = doc.defaultView;
  const slots = [...doc.querySelectorAll('[data-ad-slot]')];
  const bar = doc.getElementById('ad-consent');
  const choices = doc.querySelector('[data-ad-choices]');
  let observer = null;

  const fill = (slot) => {
    if (slot.dataset.adState) return;
    const min = Number(slot.dataset.minViewport) || 0;
    if (win.innerWidth < min) return;
    let units;
    try {
      units = JSON.parse(slot.dataset.adUnits || '[]');
    } catch {
      return;
    }
    const box = slot.querySelector('.ad-frame');
    slot.hidden = false;
    slot.classList.remove('ad-slot--pending');
    const unit = pickUnit(units, box.clientWidth || slot.parentElement.clientWidth);
    if (!unit) {
      slot.hidden = true;
      slot.dataset.adState = 'none';
      return;
    }
    const frame = doc.createElement('iframe');
    frame.src = unit.frame;
    frame.width = String(unit.width);
    frame.height = String(unit.height);
    frame.title = 'Advertisement';
    frame.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox');
    frame.setAttribute('scrolling', 'no');
    frame.setAttribute('loading', 'lazy');
    box.style.height = `${unit.height}px`;
    box.replaceChildren(frame);
    slot.dataset.adState = 'loaded';
  };

  const show = () => {
    if (!('IntersectionObserver' in win)) {
      slots.forEach(fill);
      return;
    }
    observer = observer || new win.IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          observer.unobserve(e.target);
          fill(e.target);
        }
      },
      { rootMargin: '300px 0px' },
    );
    for (const s of slots) {
      if (s.dataset.adState) continue;
      // A hidden element never intersects, so the slot is shown collapsed (no label, no height)
      // until it comes near the screen.
      s.hidden = false;
      s.classList.add('ad-slot--pending');
      observer.observe(s);
    }
  };

  const hide = () => {
    if (observer) observer.disconnect();
    observer = null;
    for (const s of slots) {
      s.hidden = true;
      s.classList.remove('ad-slot--pending');
      delete s.dataset.adState;
      const box = s.querySelector('.ad-frame');
      if (box) {
        box.replaceChildren();
        box.style.height = '';
      }
    }
  };

  const openBar = () => {
    if (!bar) return;
    bar.hidden = false;
  };

  const choose = (value) => {
    storageSet(value);
    if (bar) bar.hidden = true;
    if (value === 'yes') show();
    else hide();
    if (choices) choices.focus();
  };

  if (bar) {
    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-ad-consent]');
      if (btn) choose(btn.dataset.adConsent);
    });
  }
  if (choices) {
    choices.hidden = false;
    choices.addEventListener('click', () => {
      openBar();
      const first = bar && bar.querySelector('[data-ad-consent]');
      if (first) first.focus();
    });
  }

  const state = decide(storageGet(), zone());
  if (state === 'show') show();
  else if (state === 'ask') openBar();

  return { show, hide, state };
}

if (typeof document !== 'undefined') mountAds();
