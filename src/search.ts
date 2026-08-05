// Size matching and ranking.

import { PRESETS, RATIO_SIZES, HOT } from './presets.js';
import type { Dimensions, Preset, SavedSize, SizeResult, SizeResultKind } from './domain/types.js';

const NOISE = new Set<string>([
  'image', 'images', 'img', 'size', 'sizes', 'dimension', 'dimensions', 'pixel',
  'pixels', 'px', 'photo', 'photos', 'pic', 'pics', 'picture', 'for', 'the', 'a',
  'an', 'my', 'to', 'on', 'in', 'of', 'and', 'please', 'crop', 'make', 'i', 'want',
]);

const norm = (value: string): string => value
  .toLowerCase()
  .replace(/[^a-z0-9:.\s/×*-]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

export function ratioLabel(w: number, h: number): string {
  const divisor = gcd(w, h) || 1;
  const a = w / divisor;
  const b = h / divisor;
  if (a <= 40 && b <= 40) return `${a}:${b}`;
  return `${(w / h).toFixed(2)}:1`;
}

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const rows: number[][] = [Array.from({ length: b.length + 1 }, (_, index) => index)];
  for (let i = 1; i <= a.length; i += 1) {
    const row: number[] = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const previous = rows[i - 1];
      if (!previous) continue;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(
        (previous[j] ?? 0) + 1,
        (row[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
      const transpositionRow = rows[i - 2];
      if (i > 1 && j > 1 && transpositionRow
        && a[i - 1] === b[j - 2]
        && a[i - 2] === b[j - 1]) {
        row[j] = Math.min(row[j] ?? 0, (transpositionRow[j - 2] ?? 0) + 1);
      }
    }
    rows.push(row);
  }
  return rows[a.length]?.[b.length] ?? 3;
}

const isSubsequence = (needle: string, haystack: string): boolean => {
  let index = 0;
  for (const character of haystack) {
    if (character === needle[index]) index += 1;
  }
  return index === needle.length;
};

const TERMS = new Map<string, readonly string[]>(PRESETS.map((preset) => {
  const phrases = [preset.name, preset.group, ...preset.keywords];
  const terms = new Set<string>();
  for (const phrase of phrases) {
    const normalized = norm(phrase);
    terms.add(normalized);
    for (const word of normalized.split(' ')) {
      if (word.length > 1) terms.add(word);
    }
  }
  terms.add(`${preset.w}x${preset.h}`);
  terms.add(String(preset.w));
  terms.add(String(preset.h));
  terms.add(ratioLabel(preset.w, preset.h));
  return [preset.id, [...terms]] as const;
}));

function tokenScore(token: string, terms: readonly string[]): number {
  let best = 0;
  for (const term of terms) {
    if (term === token) return 1;
    if (term.startsWith(token)) best = Math.max(best, 0.9);
    else if (term.includes(token)) best = Math.max(best, 0.65);
    else if (token.length >= 4 && editDistance(token, term) <= (token.length >= 7 ? 2 : 1)) {
      best = Math.max(best, 0.55);
    } else if (token.length >= 3 && isSubsequence(token, term)) {
      best = Math.max(best, 0.3);
    }
  }
  return best;
}

function row(
  kind: SizeResultKind,
  name: string,
  detail: string,
  w: number,
  h: number,
  extra: Partial<SizeResult> = {},
): SizeResult {
  return { kind, key: `${kind}:${name}:${w}x${h}`, name, detail, w, h, ...extra };
}

const presetRow = (preset: Preset): SizeResult =>
  row('preset', preset.name, preset.group, preset.w, preset.h, { id: preset.id });

const savedRow = (size: SavedSize): SizeResult =>
  row('saved', size.name, 'Saved size', size.w, size.h, { savedId: size.id });

function savedTerms(size: SavedSize): readonly string[] {
  const terms = new Set<string>([
    norm(size.name),
    `${size.w}x${size.h}`,
    String(size.w),
    String(size.h),
    ratioLabel(size.w, size.h),
  ]);
  for (const word of norm(size.name).split(' ')) {
    if (word.length > 1) terms.add(word);
  }
  return [...terms];
}

function matchSaved(saved: readonly SavedSize[], tokens: readonly string[]): SavedSize[] {
  const scored: Array<{ readonly size: SavedSize; readonly score: number }> = [];
  for (const size of saved) {
    const terms = savedTerms(size);
    let total = 0;
    for (const token of tokens) {
      const score = tokenScore(token, terms);
      if (score === 0) {
        total = -1;
        break;
      }
      total += score;
    }
    if (total >= 0) scored.push({ size, score: total / Math.max(tokens.length, 1) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map(({ size }) => size);
}

function parseDimensions(query: string): Dimensions | null {
  const match = query.match(/(\d{1,5})\s*(?:x|×|\*|by|\/|\s)\s*(\d{1,5})/i);
  if (!match) return null;
  const w = Number(match[1]);
  const h = Number(match[2]);
  if (!(w > 0 && h > 0) || w > 16384 || h > 16384) return null;
  if (w < 50 && h < 50) return null;
  return { w, h };
}

interface ParsedRatio extends Dimensions {
  readonly ratio: number;
}

function parseRatio(query: string): ParsedRatio | null {
  const match = query.match(/(\d{1,3})(?:\.\d+)?\s*[:x×/]\s*(\d{1,3})(?:\.\d+)?/i);
  if (!match) return null;
  const a = Number(match[1]);
  const b = Number(match[2]);
  if (!(a > 0 && b > 0) || a > 50 || b > 50) return null;
  const ratio = a / b;
  const known = RATIO_SIZES.find((candidate) => Math.abs(candidate.ratio - ratio) < 0.001);
  if (known) return { w: known.w, h: known.h, ratio };
  const [w, h] = ratio >= 1
    ? [1600, Math.round(1600 / ratio)]
    : [Math.round(1600 * ratio), 1600];
  return { w, h, ratio };
}

export function wholeImageInside(image: Dimensions, bound: Dimensions): Dimensions {
  const scale = Math.min(bound.w / image.w, bound.h / image.h);
  return {
    w: Math.max(1, Math.round(image.w * scale)),
    h: Math.max(1, Math.round(image.h * scale)),
  };
}

export function search(
  raw: string,
  recents: readonly string[] = [],
  saved: readonly SavedSize[] = [],
  image: Dimensions | null = null,
): SizeResult[] {
  const query = norm(raw || '');

  if (!query) {
    const savedRows = saved.map((size) => ({ ...savedRow(size), section: 'Saved' }));
    const recentRows = recents
      .map((id) => PRESETS.find((preset) => preset.id === id))
      .filter((preset): preset is Preset => Boolean(preset))
      .map((preset) => ({ ...presetRow(preset), section: 'Recent' }));
    const seen = new Set(recentRows.map((result) => result.id));
    const hotRows = HOT
      .filter((preset) => !seen.has(preset.id))
      .map((preset) => ({ ...presetRow(preset), section: 'Popular' }));
    return [...savedRows, ...recentRows, ...hotRows];
  }

  const output: SizeResult[] = [];
  const push = (result: SizeResult): void => {
    if (!output.some((existing) => existing.key === result.key)) output.push(result);
  };

  const savedTokens = query.split(' ').filter(Boolean);
  for (const size of matchSaved(saved, savedTokens)) {
    push({ ...savedRow(size), section: 'Saved' });
  }

  const dimensions = parseDimensions(query);
  if (dimensions) {
    for (const preset of PRESETS) {
      if (preset.w === dimensions.w && preset.h === dimensions.h) {
        push({ ...presetRow(preset), section: 'Exact match' });
      }
    }
    push({
      ...row('custom', `${dimensions.w} × ${dimensions.h}`, 'Exact pixels', dimensions.w, dimensions.h),
      section: 'Exact match',
    });

    if (image) {
      const whole = wholeImageInside(image, dimensions);
      if (whole.w !== dimensions.w || whole.h !== dimensions.h) {
        push({
          ...row(
            'whole',
            'Whole image',
            `Nothing cropped — fits inside ${dimensions.w} × ${dimensions.h}`,
            whole.w,
            whole.h,
          ),
          section: 'Exact match',
        });
      }
    }
  }

  const ratio = dimensions ? null : parseRatio(query);
  if (ratio) {
    push({
      ...row(
        'custom',
        `${ratio.w} × ${ratio.h}`,
        `${ratioLabel(ratio.w, ratio.h)} — suggested size`,
        ratio.w,
        ratio.h,
      ),
      section: 'Shape',
    });
    for (const preset of PRESETS) {
      if (Math.abs(preset.w / preset.h - ratio.ratio) < 0.01) {
        push({ ...presetRow(preset), section: 'Shape' });
      }
    }
  }

  const tokens = query.split(' ').filter((token) => token && !NOISE.has(token));
  if (tokens.length) {
    const scored: Array<{ readonly preset: Preset; readonly score: number }> = [];
    for (const preset of PRESETS) {
      const terms = TERMS.get(preset.id) ?? [];
      let total = 0;
      let matches = true;
      for (const token of tokens) {
        const score = tokenScore(token, terms);
        if (score === 0) {
          matches = false;
          break;
        }
        total += score;
      }
      if (!matches) continue;
      let score = total / tokens.length;
      if (norm(preset.name) === query || norm(`${preset.group} ${preset.name}`) === query) score += 0.5;
      if (preset.hot) score += 0.05;
      const recentAt = recents.indexOf(preset.id);
      if (recentAt >= 0) score += 0.08 - recentAt * 0.01;
      scored.push({ preset, score });
    }
    scored.sort((a, b) => b.score - a.score);
    for (const { preset } of scored) push({ ...presetRow(preset), section: 'Sizes' });
  }

  const bare = query.match(/^(\d{2,5})$/);
  if (bare) {
    const size = Number(bare[1]);
    push({ ...row('custom', `${size} × ${size}`, 'Square', size, size), section: 'Sizes' });
  }

  return output;
}
