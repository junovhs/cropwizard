// The size palette: one text box that always lands on the right size.

import { search, ratioLabel } from './search.js';

const RECENTS_KEY = 'cropwizard.recents';
const MAX_RECENTS = 5;

const loadRecents = () => {
  try { return JSON.parse(localStorage.getItem(RECENTS_KEY)) || []; }
  catch { return []; }
};
const saveRecents = (ids) => {
  try { localStorage.setItem(RECENTS_KEY, JSON.stringify(ids.slice(0, MAX_RECENTS))); }
  catch { /* private mode — recents are a nicety, not a feature */ }
};

// A little rectangle at the row's aspect ratio, so the shape is readable
// before the words are.
function swatch(w, h) {
  const el = document.createElement('span');
  el.className = 'swatch';
  const long = 22;
  const [sw, sh] = w >= h ? [long, Math.max(5, (long * h) / w)] : [Math.max(5, (long * w) / h), long];
  el.style.width = `${sw}px`;
  el.style.height = `${sh}px`;
  return el;
}

export function createSizePicker({ root, input, list, trigger, onPick }) {
  let rows = [];
  let cursor = 0;
  let recents = loadRecents();

  function render() {
    rows = search(input.value, recents);
    cursor = Math.min(cursor, Math.max(0, rows.length - 1));
    list.textContent = '';

    if (!rows.length) {
      const none = document.createElement('p');
      none.className = 'picker-empty';
      none.textContent = 'No size by that name. Type exact pixels instead — like 1200 x 630.';
      list.append(none);
      return;
    }

    let section = null;
    rows.forEach((r, i) => {
      if (r.section && r.section !== section) {
        section = r.section;
        const head = document.createElement('div');
        head.className = 'picker-section';
        head.textContent = section;
        list.append(head);
      }
      const el = document.createElement('div');
      el.className = 'picker-row';
      el.id = `picker-row-${i}`;
      el.setAttribute('role', 'option');
      el.setAttribute('aria-selected', String(i === cursor));
      el.dataset.index = String(i);
      el.append(swatch(r.w, r.h));

      const text = document.createElement('span');
      text.className = 'picker-text';
      const name = document.createElement('strong');
      name.textContent = r.name;
      const detail = document.createElement('span');
      detail.textContent = r.detail;
      text.append(name, detail);

      const dims = document.createElement('span');
      dims.className = 'picker-dims';
      dims.textContent = `${r.w} × ${r.h}`;

      const ratio = document.createElement('span');
      ratio.className = 'picker-ratio';
      ratio.textContent = ratioLabel(r.w, r.h);

      el.append(text, ratio, dims);
      // `mousedown` rather than `click`: the input must not lose focus first.
      el.addEventListener('mousedown', (e) => { e.preventDefault(); choose(i); });
      el.addEventListener('mousemove', () => setCursor(i));
      list.append(el);
    });
    scrollToCursor();
  }

  function setCursor(next) {
    if (next === cursor) return;
    cursor = next;
    for (const el of list.querySelectorAll('.picker-row')) {
      el.setAttribute('aria-selected', String(+el.dataset.index === cursor));
    }
    input.setAttribute('aria-activedescendant', `picker-row-${cursor}`);
  }

  function scrollToCursor() {
    const el = list.querySelector(`#picker-row-${cursor}`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }

  function move(delta) {
    if (!rows.length) return;
    setCursor((cursor + delta + rows.length) % rows.length);
    scrollToCursor();
  }

  function choose(index = cursor) {
    const r = rows[index];
    if (!r) return;
    if (r.id) {
      recents = [r.id, ...recents.filter((x) => x !== r.id)].slice(0, MAX_RECENTS);
      saveRecents(recents);
    }
    close();
    onPick(r);
  }

  function open() {
    root.hidden = false;
    // Pre-select the text so the next keystroke replaces the old query.
    input.select();
    input.focus();
    cursor = 0;
    render();
    requestAnimationFrame(() => root.classList.add('open'));
  }

  function close() {
    root.classList.remove('open');
    root.hidden = true;
    trigger.focus();
  }

  input.addEventListener('input', () => { cursor = 0; render(); });
  input.addEventListener('keydown', (e) => {
    const keys = {
      ArrowDown: () => move(1),
      ArrowUp: () => move(-1),
      Enter: () => choose(),
      Escape: () => close(),
      Tab: () => close(),
    };
    const action = keys[e.key];
    if (!action) return;
    if (e.key !== 'Tab') e.preventDefault();
    action();
  });

  // Clicking the backdrop dismisses; clicking the panel must not.
  root.addEventListener('mousedown', (e) => { if (e.target === root) close(); });
  trigger.addEventListener('click', open);

  addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      root.hidden ? open() : close();
    }
  });

  return { open, close, isOpen: () => !root.hidden };
}
