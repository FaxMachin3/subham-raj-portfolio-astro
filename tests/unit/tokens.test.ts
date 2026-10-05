import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { contrastRatio, type Rgb } from '@/lab/contrast';

const css = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8');

const hex = (value: string): Rgb => {
  const h = value.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as unknown as Rgb;
};

/** Reads `--color-x: light-dark(#light, #dark)` or a single hex shared by both themes. */
function token(name: string, theme: 'light' | 'dark'): Rgb {
  const match = css.match(new RegExp(`--color-${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`Missing token --color-${name}`);
  const value = match[1]!.trim();
  const pair = value.match(/^light-dark\((#[0-9a-f]{6}),\s*(#[0-9a-f]{6})\)$/i);
  if (pair) return hex(theme === 'light' ? pair[1]! : pair[2]!);
  if (/^#[0-9a-f]{6}$/i.test(value)) return hex(value);
  throw new Error(`--color-${name} is not a plain colour: ${value}`);
}

const AAA = 7;
const AA = 4.5;
const LARGE_OR_UI = 3;

/** [foreground, background, minimum ratio]. Body text is held to AAA; everything else to AA. */
const PAIRS: [string, string, number][] = [
  ['ink', 'paper', AAA],
  ['ink', 'surface', AAA],
  ['ink', 'sunken', AAA],
  ['muted', 'paper', AAA],
  ['muted', 'surface', AAA],
  ['muted', 'sunken', AAA],
  ['on-ink', 'ink', AAA],
  ['on-warn', 'warn', AAA],
  ['good', 'good-bg', AA],
  ['good', 'surface', AA],
  ['bad', 'bad-bg', AA],
  ['bad', 'surface', AA],
  ['busy', 'busy-bg', AA],
  ['busy-ink', 'busy-bg', AA],
  ['accent', 'paper', AA],
  ['accent', 'surface', AA],
  ['on-good', 'good', AA],
  ['on-merged', 'merged', AA],
  ['on-ink', 'muted', AA],
  ['violet', 'paper', LARGE_OR_UI],
  ['hero-dim', 'paper', LARGE_OR_UI],
];

describe.each(['light', 'dark'] as const)('%s theme tokens', (theme) => {
  it.each(PAIRS)('%s on %s meets %s:1', (fg, bg, min) => {
    expect(contrastRatio(token(fg, theme), token(bg, theme))).toBeGreaterThanOrEqual(min);
  });

  it('keeps the deliberately broken demo text below AA, so the demo stays honest', () => {
    expect(contrastRatio(token('broken-ink', theme), token('broken-bg', theme))).toBeLessThan(AA);
  });
});
