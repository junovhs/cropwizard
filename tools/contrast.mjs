// Contrast audit for the palette. Run with `node tools/contrast.mjs`.
//
// A dark interface fails in two different ways, and they need separate limits.
// Text that is too dim is a reading problem, and WCAG 1.4.3 asks 4.5:1 for it.
// Borders that are too dim are a *structure* problem: nothing is illegible, but
// no edge is visible either, so panels, stage and rail melt into one unbroken
// dark field and the eye has nothing to hold. WCAG 1.4.11 asks 3:1 for the
// boundaries that carry meaning — the outline that tells you where a button
// ends is doing work, and needs to be seen doing it.
//
// No dependencies and nothing at runtime (DEC-01); this reads styles.css and
// prints a table, so the ratios stay computed fact rather than a judgement.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles.css'),
  'utf8',
);

// Pull the token values straight out of :root so this can never drift from the
// stylesheet it is auditing.
function token(name) {
  const found = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!found) throw new Error(`--${name} not found in styles.css`);
  return found[1];
}

const luminance = (hex) => {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

// The four surfaces anything can be drawn on.
const SURFACES = ['stage', 'chrome', 'panel', 'raised'];

// Text tokens, and the 4.5:1 they answer to.
const TEXT = ['ink', 'muted', 'accent', 'good', 'warn', 'bad'];

// Boundary tokens that carry meaning, and the 3:1 they answer to. Each is
// checked only against the surfaces it is actually drawn on — holding a token
// to a contrast it never has to meet would be inventing a failure. --line is
// the exception that earns the full sweep: it fences buttons, inputs, chips,
// thumbnails, the panel edge and the palette, so it lands on all four.
const BOUNDARIES = [
  ['line', SURFACES],
  ['line-hover', ['raised']],
];

let failures = 0;

function table(title, rows, floor) {
  console.log(`\n${title}  (floor ${floor.toFixed(1)}:1)`);
  console.log(''.padEnd(14) + SURFACES.map((s) => s.padStart(9)).join(''));
  for (const [name, surfaces] of rows) {
    const value = token(name);
    let line = name.padEnd(14);
    for (const surface of SURFACES) {
      if (!surfaces.includes(surface)) { line += '        —'; continue; }
      const ratio = contrast(value, token(surface));
      const bad = ratio < floor;
      if (bad) failures++;
      line += `${ratio.toFixed(2)}${bad ? '!' : ' '}`.padStart(9);
    }
    console.log(`${line}   ${value}`);
  }
}

table('text (WCAG 1.4.3)', TEXT.map((t) => [t, SURFACES]), 4.5);
table('boundaries (WCAG 1.4.11)', BOUNDARIES, 3);

// --line-soft is deliberately exempt. It draws the rhythm between sections
// inside one panel, which is decoration rather than a component boundary — the
// sections are already fenced by the panel's own --line edge, and holding a
// decorative rule to 3:1 would make it shout as loudly as the button outlines
// it sits between, flattening the hierarchy this is meant to restore.
const soft = contrast(token('line-soft'), token('panel'));
console.log(`\nline-soft on panel: ${soft.toFixed(2)}:1  ${token('line-soft')}`);
console.log('  decorative intra-panel rhythm — exempt from 1.4.11, kept below --line on purpose');

console.log(failures ? `\n${failures} below floor\n` : '\nall clear\n');
process.exit(failures ? 1 : 0);
