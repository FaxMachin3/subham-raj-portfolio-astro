import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

/** Social preview images (1200×630), rendered once at build time. Nothing here ships to the browser. */
export interface OgCard {
  eyebrow: string;
  title: string;
  /** Optional headline number, e.g. "15.5 s → 14 ms". */
  metric?: string;
  metricLabel?: string;
}

const require = createRequire(join(process.cwd(), 'package.json'));
const font = (pkg: string, file: string) => readFileSync(require.resolve(`@fontsource/${pkg}/files/${file}`));

const fonts = [
  { name: 'Poppins', data: font('poppins', 'poppins-latin-400-normal.woff'), weight: 400 as const },
  { name: 'Poppins', data: font('poppins', 'poppins-latin-600-normal.woff'), weight: 600 as const },
  { name: 'Poppins', data: font('poppins', 'poppins-latin-800-normal.woff'), weight: 800 as const },
  {
    name: 'JetBrains Mono',
    data: font('jetbrains-mono', 'jetbrains-mono-latin-500-normal.woff'),
    weight: 500 as const,
  },
];

const mark = `data:image/svg+xml;base64,${Buffer.from(
  // Resolved from the project root: this module is bundled into a different directory at build time.
  readFileSync(join(process.cwd(), 'public/favicon.svg')),
).toString('base64')}`;

type Node = { type: string; props: Record<string, unknown> };
const el = (
  type: string,
  style: Record<string, unknown>,
  children?: unknown,
  extra: Record<string, unknown> = {},
): Node => ({
  type,
  props: { style, children, ...extra },
});

// The bundled font subsets have no "→", so arrows are drawn as shapes.
const arrow = el(
  'svg',
  {},
  [
    el('path', {}, undefined, {
      d: 'M2 12h18m-7-7 7 7-7 7',
      stroke: '#08734a',
      strokeWidth: 2.6,
      fill: 'none',
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    }),
  ],
  { width: 30, height: 30, viewBox: '0 0 24 24' },
);
const withArrows = (text: string) =>
  text
    .split('→')
    .flatMap((part, i) => (i === 0 ? [el('span', {}, part.trim())] : [arrow, el('span', {}, part.trim())]));

export async function renderOgImage({ eyebrow, title, metric, metricLabel }: OgCard): Promise<Uint8Array> {
  const tree = el(
    'div',
    {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '64px 72px',
      background: '#f5f4ef',
      color: '#121212',
      fontFamily: 'Poppins',
    },
    [
      el('div', { display: 'flex', alignItems: 'center', justifyContent: 'space-between' }, [
        el(
          'div',
          { display: 'flex', alignItems: 'center', fontSize: 40, fontWeight: 800, letterSpacing: -1.5 },
          [
            el('span', {}, 'subham'),
            el('span', {
              width: 14,
              height: 14,
              margin: '10px 4px 0',
              borderRadius: 14,
              background: '#10a46a',
            }),
            el('span', {}, 'raj'),
          ],
        ),
        el('img', { width: 72, height: 72 }, undefined, { src: mark, width: 72, height: 72 }),
      ]),
      el('div', { display: 'flex', flexDirection: 'column', gap: 18 }, [
        el('div', { fontFamily: 'JetBrains Mono', fontSize: 26, color: '#4b4b45' }, eyebrow),
        el(
          'div',
          { fontSize: title.length > 60 ? 58 : 70, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2.5 },
          title,
        ),
      ]),
      el('div', { display: 'flex', alignItems: 'center', gap: 20 }, [
        ...(metric
          ? [
              el(
                'div',
                {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '10px 22px',
                  borderRadius: 14,
                  background: '#dcf5e8',
                  color: '#08734a',
                  fontFamily: 'JetBrains Mono',
                  fontSize: 34,
                },
                withArrows(metric),
              ),
              el('div', { fontSize: 26, color: '#4b4b45' }, metricLabel ?? ''),
            ]
          : [
              el(
                'div',
                { fontSize: 28, color: '#4b4b45' },
                'Senior Frontend Engineer · React · TypeScript · Performance',
              ),
            ]),
      ]),
    ],
  );

  const svg = await satori(tree as Parameters<typeof satori>[0], { width: 1200, height: 630, fonts });
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}
