// Size matching.
//
// Three ways in, all through one box: literal pixels ("1200 by 630"), a ratio
// ("16:9", "4x5"), or words ("ig story", "yt thumb", "link preview"). Words are
// matched token-by-token with AND semantics and typo tolerance, so a query only
// ever narrows — it never returns something that ignores half of what you typed.

import { PRESETS, RATIO_SIZES, HOT } from './presets.js';

// Words that describe the *act* of looking, not the thing looked for. Dropping
// them is what lets "og image" and "instagram story size" both work.
const NOISE = new Set([
  'image', 'images', 'img', 'size', 'sizes', 'dimension', 'dimensions', 'pixel',
  'pixels', 'px', 'photo', 'photos', 'pic', 'pics', 'picture', 'for', 'the', 'a',
  'an', 'my', 'to', 'on', 'in', 'of', 'and', 'please', 'crop', 'make', 'i', 'want',
]);

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9:.\s/×*-]/g, ' ').replace(/\s+/g, ' ').trim();

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
export function ratioLabel(w, h) {
  const g = gcd(w, h) || 1;
  const [a, b] = [w / g, h / g];
  if (a <= 40 && b <= 40) return `${a}:${b}`;
  return `${(w / h).toFixed(2)}:1`;
}

// Bounded Damerau-Levenshtein. Adjacent transposition counts as one edit, not
// two, because "stroy" and "thumbnial" are what people actually type.
function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const rows = [[...Array(b.length + 1).keys()]];
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(rows[i - 1][j] + 1, row[j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        row[j] = Math.min(row[j], rows[i - 2][j - 2] + 1);
      }
    }
    rows.push(row);
  }
  return rows[a.length][b.length];
}

const isSubsequence = (needle, hay) => {
  let i = 0;
  for (const ch of hay) if (ch === needle[i]) i++;
  return i === needle.length;
};

// Every string a preset can legitimately be found by, flattened once.
const TERMS = new Map(PRESETS.map((p) => {
  const phrases = [p.name, p.group, ...p.keywords];
  const terms = new Set();
  for (const phrase of phrases) {
    const n = norm(phrase);
    terms.add(n);
    for (const word of n.split(' ')) if (word.length > 1) terms.add(word);
  }
  terms.add(`${p.w}x${p.h}`);
  terms.add(String(p.w));
  terms.add(String(p.h));
  terms.add(ratioLabel(p.w, p.h));
  return [p.id, [...terms]];
}));

function tokenScore(token, terms) {
  let best = 0;
  for (const term of terms) {
    if (term === token) return 1;
    if (term.startsWith(token)) best = Math.max(best, 0.9);
    else if (term.includes(token)) best = Math.max(best, 0.65);
    else if (token.length >= 4 && editDistance(token, term) <= (token.length >= 7 ? 2 : 1)) {
      best = Math.max(best, 0.55);
    } else if (token.length >= 3 && isSubsequence(token, term)) best = Math.max(best, 0.3);
  }
  return best;
}

const row = (kind, name, detail, w, h, extra = {}) =>
  ({ kind, key: `${kind}:${name}:${w}x${h}`, name, detail, w, h, ...extra });

const presetRow = (p) => row('preset', p.name, p.group, p.w, p.h, { id: p.id });

const savedRow = (s) => row('saved', s.name, 'Saved size', s.w, s.h, { savedId: s.id });

// Saved sizes are matched the same way presets are — every token has to land —
// but over a much smaller vocabulary: the name you gave it and its numbers.
function savedTerms(s) {
  const terms = new Set([norm(s.name), `${s.w}x${s.h}`, String(s.w), String(s.h), ratioLabel(s.w, s.h)]);
  for (const word of norm(s.name).split(' ')) if (word.length > 1) terms.add(word);
  return [...terms];
}

function matchSaved(saved, tokens) {
  const scored = [];
  for (const s of saved) {
    const terms = savedTerms(s);
    let total = 0;
    for (const token of tokens) {
      const score = tokenScore(token, terms);
      if (score === 0) { total = -1; break; }
      total += score;
    }
    if (total >= 0) scored.push({ s, score: total / tokens.length });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map(({ s }) => s);
}

// Literal pixels: "1200x630", "1200 by 630", "1200 630". Two small numbers are
// a ratio, not a 16-pixel-wide image, so they fall through to the ratio parser.
function parseDimensions(q) {
  const m = q.match(/(\d{1,5})\s*(?:x|×|\*|by|\/|\s)\s*(\d{1,5})/i);
  if (!m) return null;
  const w = +m[1], h = +m[2];
  if (!(w > 0 && h > 0) || w > 16384 || h > 16384) return null;
  if (w < 50 && h < 50) return null;
  return { w, h };
}

function parseRatio(q) {
  const m = q.match(/(\d{1,3})(?:\.\d+)?\s*[:x×/]\s*(\d{1,3})(?:\.\d+)?/i);
  if (!m) return null;
  const a = +m[1], b = +m[2];
  if (!(a > 0 && b > 0) || a > 50 || b > 50) return null;
  const ratio = a / b;
  const known = RATIO_SIZES.find((r) => Math.abs(r.ratio - ratio) < 0.001);
  if (known) return { w: known.w, h: known.h, ratio };
  // Unlisted ratio: pick the nearest whole-pixel pair around a 1600px long edge.
  const [w, h] = ratio >= 1 ? [1600, Math.round(1600 / ratio)] : [Math.round(1600 * ratio), 1600];
  return { w, h, ratio };
}

/**
 * @param {string} raw       what the user typed
 * @param {string[]} recents preset ids, most recent first
 * @returns {Array} ranked rows, best first
 */
/**
 * The whole of `image`, scaled to sit inside `bound` with nothing cropped and
 * nothing padded. Since the result carries the image's own aspect, filling the
 * frame with it shows every pixel — which is what a plain resize means. Only
 * the bound the image actually runs into is honoured exactly; the other comes
 * out smaller, because that is what preserving the shape costs.
 */
export function wholeImageInside(image, bound) {
  const scale = Math.min(bound.w / image.w, bound.h / image.h);
  return {
    w: Math.max(1, Math.round(image.w * scale)),
    h: Math.max(1, Math.round(image.h * scale)),
  };
}

export function search(raw, recents = [], saved = [], image = null) {
  const q = norm(raw || '');

  if (!q) {
    // Cold start: your own sizes first, then what you used last, then the
    // sizes most people want.
    const savedRows = saved.map((s) => ({ ...savedRow(s), section: 'Saved' }));
    const recentRows = recents
      .map((id) => PRESETS.find((p) => p.id === id))
      .filter(Boolean)
      .map((p) => ({ ...presetRow(p), section: 'Recent' }));
    const seen = new Set(recentRows.map((r) => r.id));
    const hotRows = HOT.filter((p) => !seen.has(p.id))
      .map((p) => ({ ...presetRow(p), section: 'Popular' }));
    return [...savedRows, ...recentRows, ...hotRows];
  }

  const out = [];
  const push = (r) => { if (!out.some((o) => o.key === r.key)) out.push(r); };

  // 0. Your own sizes answer first: you named it, so you meant it.
  const savedTokens = q.split(' ').filter(Boolean);
  for (const s of matchSaved(saved, savedTokens)) {
    push({ ...savedRow(s), section: 'Saved' });
  }

  // 1. Exact pixels win outright — but if a real preset has those dimensions,
  //    show it by name first. "1200 by 630" should say "Open Graph".
  const dims = parseDimensions(q);
  if (dims) {
    for (const p of PRESETS) {
      if (p.w === dims.w && p.h === dims.h) push({ ...presetRow(p), section: 'Exact match' });
    }
    push({ ...row('custom', `${dims.w} × ${dims.h}`, 'Exact pixels', dims.w, dims.h), section: 'Exact match' });

    // Typing a size is ambiguous: it can mean "cut this shape out of it" or
    // "make the whole thing about this big". The first is the row above and the
    // only one that existed; this is the second, offered beside it so a plain
    // resize never requires understanding the frame. Skipped when the image
    // already has that shape, because then the two rows are the same act.
    if (image) {
      const whole = wholeImageInside(image, dims);
      if (whole.w !== dims.w || whole.h !== dims.h) {
        push({
          ...row('whole', 'Whole image', `Nothing cropped — fits inside ${dims.w} × ${dims.h}`, whole.w, whole.h),
          section: 'Exact match',
        });
      }
    }
  }

  // 2. A ratio resolves to concrete pixels, then to every preset that shape.
  const ratio = dims ? null : parseRatio(q);
  if (ratio) {
    push({
      ...row('custom', `${ratio.w} × ${ratio.h}`, `${ratioLabel(ratio.w, ratio.h)} — suggested size`, ratio.w, ratio.h),
      section: 'Shape',
    });
    for (const p of PRESETS) {
      if (Math.abs(p.w / p.h - ratio.ratio) < 0.01) push({ ...presetRow(p), section: 'Shape' });
    }
  }

  // 3. Words.
  const tokens = q.split(' ').filter((t) => t && !NOISE.has(t));
  if (tokens.length) {
    const scored = [];
    for (const p of PRESETS) {
      const terms = TERMS.get(p.id);
      let total = 0;
      let ok = true;
      for (const token of tokens) {
        const s = tokenScore(token, terms);
        if (s === 0) { ok = false; break; }
        total += s;
      }
      if (!ok) continue;
      let score = total / tokens.length;
      if (norm(p.name) === q || norm(`${p.group} ${p.name}`) === q) score += 0.5;
      if (p.hot) score += 0.05;
      const recentAt = recents.indexOf(p.id);
      if (recentAt >= 0) score += 0.08 - recentAt * 0.01;
      scored.push({ p, score });
    }
    scored.sort((a, b) => b.score - a.score);
    for (const { p } of scored) push({ ...presetRow(p), section: 'Sizes' });
  }

  // 4. A bare number means either "a size with 900 in it" — already matched
  //    above — or a 900-square. Always offer the square so it can't dead-end.
  const bare = q.match(/^(\d{2,5})$/);
  if (bare) {
    const n = +bare[1];
    push({ ...row('custom', `${n} × ${n}`, 'Square', n, n), section: 'Sizes' });
  }

  return out;
}
