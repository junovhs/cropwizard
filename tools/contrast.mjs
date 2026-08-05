// Contrast audit for the palette. Run with `node tools/contrast.mjs`.
//
// A paper interface fails in two different ways, and they need separate limits.
// Text that is too pale is a reading problem, and WCAG 1.4.3 asks 4.5:1 for it.
// Borders that are too pale are a *control* problem: nothing is illegible, but
// no edge is visible either, so a field or button melts into its background.
// WCAG 1.4.11 asks 3:1 when that outline is what identifies the component.
//
// No dependencies and nothing at runtime (DEC-01); this reads styles.css and
// prints a table, so the ratios stay computed fact rather than a judgement.
//
// The palette is authored in OKLCH, so the colours are converted here rather
// than duplicated as hex — a second copy is a second thing to forget.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles.css'),
  'utf8',
);

// ---- colour ----------------------------------------------------------------

const srgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** OKLCH -> linear sRGB, then to the 0..1 gamma-encoded channels. */
function oklchToRgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;

  return [
    srgb(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    srgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    srgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s),
  ].map((v) => Math.min(1, Math.max(0, v)));
}

/** Parse `oklch(L C H)` or `oklch(L C H / A)`; hex is still accepted. */
function parseColor(value) {
  const ok = value.match(
    /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)/,
  );
  if (ok) {
    const [, L, C, H, A] = ok;
    return { rgb: oklchToRgb(+L, +C, +H), alpha: A === undefined ? 1 : +A };
  }
  const hex = value.match(/#([0-9a-fA-F]{6})/);
  if (hex) {
    const n = hex[1];
    return { rgb: [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255), alpha: 1 };
  }
  throw new Error(`cannot parse colour: ${value}`);
}

// Pull the token values straight out of :root so this can never drift from the
// stylesheet it is auditing.
function token(name) {
  const found = css.match(new RegExp(`--${name}:\\s*([^;]+);`));
  if (!found) throw new Error(`--${name} not found in styles.css`);
  return parseColor(found[1].trim());
}

/** A translucent colour is only ever seen over something. Flatten it first. */
function over({ rgb, alpha }, backdrop) {
  if (alpha >= 1) return rgb;
  return rgb.map((c, i) => c * alpha + backdrop.rgb[i] * (1 - alpha));
}

const luminance = (channels) => {
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

function contrast(fg, bg) {
  const back = over(bg, { rgb: [1, 1, 1], alpha: 1 });
  const [x, y] = [luminance(over(fg, { rgb: back, alpha: 1 })), luminance(back)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// ---- what gets audited -----------------------------------------------------

// The surfaces anything can be drawn on.
const SURFACES = ['bg', 'bg-2', 'surface', 'surface-2'];

// Text tokens, and the 4.5:1 they answer to. --ink-4 is the documented
// exception: the guide assigns it to labels, placeholders and inactive states,
// which 1.4.3 does not govern, and it is never the only statement of anything.
const TEXT = ['ink', 'ink-2', 'ink-3', 'accent', 'accent-2', 'positive', 'warn', 'danger'];

// --edge identifies controls and can land on every authored surface. --line is
// intentionally a subtler structural hairline: adjacent region colours and
// layout already identify those boundaries, so the rule is not their sole cue.
const BOUNDARIES = [['edge', SURFACES]];

let failures = 0;

function table(title, rows, floor) {
  console.log(`\n${title}  (floor ${floor.toFixed(1)}:1)`);
  console.log(''.padEnd(12) + SURFACES.map((s) => s.padStart(11)).join(''));
  for (const [name, surfaces] of rows) {
    const value = token(name);
    let line = name.padEnd(12);
    for (const surface of SURFACES) {
      if (!surfaces.includes(surface)) { line += '          —'; continue; }
      const ratio = contrast(value, token(surface));
      const bad = ratio < floor;
      if (bad) failures++;
      line += `${ratio.toFixed(2)}${bad ? '!' : ' '}`.padStart(11);
    }
    console.log(line);
  }
}

table('text (WCAG 1.4.3)', TEXT.map((t) => [t, SURFACES]), 4.5);
table('boundaries (WCAG 1.4.11)', BOUNDARIES, 3);

// White on the accent is the primary button — the single most important control
// in the workflow, so it is checked rather than assumed.
const onAccent = contrast({ rgb: [1, 1, 1], alpha: 1 }, token('accent'));
const onAccentBad = onAccent < 4.5;
if (onAccentBad) failures++;
console.log(`\nwhite on --accent (primary button): ${onAccent.toFixed(2)}:1${onAccentBad ? '  !' : ''}`);

// --ink-4 is deliberately exempt from 1.4.3: labels, placeholders, counts and
// inactive states, never the sole carrier of meaning.
console.log(`ink-4 on bg (labels, placeholders, inactive): ${contrast(token('ink-4'), token('bg')).toFixed(2)}:1`);
console.log('  non-essential per 1.4.3 — kept below --ink-3 on purpose');

const line = contrast(token('line'), token('bg-2'));
console.log(`line on bg-2 (structural region seam): ${line.toFixed(2)}:1`);
console.log('  adjacent surfaces also establish the boundary — exempt from 1.4.11');

// --line-soft draws the rhythm between sections inside one panel: decoration
// rather than a component boundary. Holding it to 3:1 would make it shout as
// loudly as control outlines, flattening the hierarchy it exists to restore.
console.log(`line-soft on bg-2 (intra-panel rhythm): ${contrast(token('line-soft'), token('bg-2')).toFixed(2)}:1`);
console.log('  decorative — exempt from 1.4.11, kept below --line on purpose');

console.log(failures ? `\n${failures} below floor\n` : '\nall clear\n');
process.exit(failures ? 1 : 0);
