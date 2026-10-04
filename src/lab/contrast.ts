export type Rgb = readonly [number, number, number];

/** Parses `rgb()`/`rgba()` strings as returned by getComputedStyle. Returns null if fully transparent. */
export function parseCssColor(value: string): Rgb | null {
  const parts = value.match(/[\d.]+/g)?.map(Number);
  if (!parts || parts.length < 3) return null;
  const [r, g, b, a = 1] = parts as [number, number, number, number?];
  if (a === 0) return null;
  return [r, g, b];
}

/** WCAG 2.x relative luminance. */
export function relativeLuminance([r, g, b]: Rgb): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG 2.x contrast ratio, from 1 (none) to 21 (black on white). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Walks up from `element` to the first ancestor with a non-transparent background. */
export function effectiveBackground(element: Element | null): Rgb {
  let node: Element | null = element;
  while (node) {
    const color = parseCssColor(getComputedStyle(node).backgroundColor);
    if (color) return color;
    node = node.parentElement;
  }
  return [255, 255, 255];
}
