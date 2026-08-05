// Image adjustments.
//
// Three knobs, one representation. An adjustment is a plain object of numbers
// in -100..100 where 0 is "leave it alone", and the single thing that turns it
// into pixels is `filterFor` — a canvas filter string. The stage, the filmstrip
// and the export all draw through that same string, so what is on screen and
// what lands on disk cannot drift apart.

// Order matters: exposure lifts the image, contrast stretches what is there,
// saturation colours the result. Reversing it makes the knobs fight.
export const CHANNELS = [
  { key: 'exposure',   label: 'Exposure',   fn: 'brightness' },
  { key: 'contrast',   label: 'Contrast',   fn: 'contrast' },
  { key: 'saturation', label: 'Saturation', fn: 'saturate' },
];

export const NEUTRAL = Object.freeze(
  Object.fromEntries(CHANNELS.map((c) => [c.key, 0])),
);

export const neutral = () => ({ ...NEUTRAL });

export const isNeutral = (adjust) =>
  !adjust || CHANNELS.every((c) => !adjust[c.key]);

/**
 * A canvas/CSS filter string for one adjustment, or `'none'` when it is
 * neutral. -100 is the floor (black, flat, grey) and +100 doubles.
 */
export function filterFor(adjust) {
  if (isNeutral(adjust)) return 'none';
  return CHANNELS
    .map((c) => `${c.fn}(${(1 + (adjust[c.key] || 0) / 100).toFixed(3)})`)
    .join(' ');
}

// `ctx.filter` is how the preview and the export stay identical, so a browser
// without it cannot honour the promise this panel makes. Rather than quietly
// exporting pixels that do not match the screen, the controls turn themselves
// off and say why. Every current browser supports it; this is the honest floor,
// not a supported path, which is why there is no pixel-loop fallback.
export const CAN_FILTER = (() => {
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.filter = 'saturate(2)';
    return ctx.filter !== 'none';
  } catch {
    return false;
  }
})();

/**
 * The Adjust panel: one row per channel, built from CHANNELS so the list of
 * knobs is stated once. `onChange` receives a fresh adjustment object; the
 * caller owns where it is stored.
 */
export function createAdjustPanel({ rows, reset, note, onChange, onAnnounce }) {
  let value = neutral();
  const controls = new Map();

  for (const channel of CHANNELS) {
    const row = document.createElement('div');
    row.className = 'adjust-row';

    const id = `adj-${channel.key}`;
    const label = document.createElement('label');
    label.setAttribute('for', id);
    label.textContent = channel.label;

    const input = document.createElement('input');
    input.type = 'range';
    input.id = id;
    input.min = '-100';
    input.max = '100';
    input.step = '1';
    input.value = '0';

    // The number is the reset button. A row that is already neutral has nothing
    // to reset, so it reads as a plain value until there is something to undo.
    const zero = document.createElement('button');
    zero.type = 'button';
    zero.className = 'adjust-value';
    zero.textContent = '0';
    zero.title = `Reset ${channel.label.toLowerCase()}`;
    zero.setAttribute('aria-label', `Reset ${channel.label.toLowerCase()}`);
    zero.disabled = true;

    input.addEventListener('input', () => commit(channel.key, +input.value));
    zero.addEventListener('click', () => {
      commit(channel.key, 0);
      onAnnounce?.(`${channel.label} reset`);
      input.focus();
    });

    row.append(label, input, zero);
    rows.append(row);
    controls.set(channel.key, { input, zero });
  }

  reset.addEventListener('click', () => {
    value = neutral();
    paint();
    onChange(value);
    onAnnounce?.('Adjustments reset');
  });

  function commit(key, next) {
    value = { ...value, [key]: next };
    paint();
    onChange(value);
  }

  function paint() {
    for (const channel of CHANNELS) {
      const { input, zero } = controls.get(channel.key);
      const v = value[channel.key] || 0;
      if (+input.value !== v) input.value = String(v);
      zero.textContent = v > 0 ? `+${v}` : String(v);
      zero.disabled = !v;
    }
    reset.hidden = isNeutral(value);
  }

  if (!CAN_FILTER) {
    note.hidden = false;
    for (const { input, zero } of controls.values()) {
      input.disabled = true;
      zero.disabled = true;
    }
  }

  return {
    /** Show one item's adjustment. Never fires onChange — this is a read. */
    load(adjust) {
      value = { ...neutral(), ...(adjust || null) };
      paint();
      return value;
    },
    enabled: CAN_FILTER,
  };
}
