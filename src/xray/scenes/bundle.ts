import { q, render, type Scene } from '../runtime';

/** Mirrors the demo's chunks: 514 KB in total, 74 KB of it core. */
export const FILES: readonly [string, number][] = [
  ['core', 74],
  ['graph', 142],
  ['search', 90],
  ['reports', 94],
  ['settings', 57],
  ['admin', 57],
];
const TIMELINE_MS = 3000;
/** Simulated load-and-run time per KB; the animation plays this at 0.8× real time. */
const MS_PER_KB = 4.9;
const STEP_MS = 50;

interface Load {
  file: string;
  kb: number;
  start: number;
  lazy?: boolean;
}

export const bundleScene: Scene = {
  label: { broken: 'JavaScript before the page works', fixed: 'core first, routes on demand' },

  async play({ root, phase, wait, caption, counter }) {
    const fixed = phase === 'fixed';
    render(
      root,
      `<div class="xr-waterfall">
        ${FILES.map(([f]) => `<div class="xr-lane"><span class="xr-k">${f}.js</span><div class="xr-bar-track"><span class="xr-bar" data-file="${f}" hidden></span></div></div>`).join('')}
        <div class="xr-ticks"><span>0 s</span><span>1 s</span><span>2 s</span><span>3 s</span></div>
        <div class="xr-overlay"><span class="xr-works" data-works hidden>page works</span></div>
      </div>`,
    );
    const bars = new Map(
      [...root.querySelectorAll<HTMLElement>('[data-file]')].map((b) => [b.dataset.file!, b]),
    );
    const works = q(root, '[data-works]');
    const at = (ms: number) => `${(ms / TIMELINE_MS) * 100}%`;
    const showWorks = (ms: number) => {
      works.hidden = false;
      works.style.left = at(ms);
    };

    let loads: Load[];
    let end: number;
    if (fixed) {
      caption('The fix ships the core first and loads each route when it’s opened.');
      loads = [
        { file: 'core', kb: 74, start: 0 },
        { file: 'graph', kb: 142, start: 1300, lazy: true },
      ];
      end = 2100;
    } else {
      caption('Every route’s code loads and runs before anything works.');
      let start = 0;
      loads = FILES.map(([file, kb]) => {
        const load = { file, kb, start };
        start += kb * MS_PER_KB;
        return load;
      });
      end = start;
    }

    let loaded = 0;
    counter('JS before it works', '0 KB');
    for (let t = 0; t <= end + STEP_MS; t += STEP_MS) {
      for (const load of loads) {
        if (t < load.start) continue;
        const bar = bars.get(load.file)!;
        const duration = load.kb * MS_PER_KB;
        const done = Math.min(t, load.start + duration);
        bar.hidden = false;
        bar.classList.toggle('xr-bar--lazy', Boolean(load.lazy));
        bar.style.left = at(load.start);
        bar.style.width = at(done - load.start);
        if (done === load.start + duration && !bar.dataset.done) {
          bar.dataset.done = '1';
          bar.textContent = `${load.kb} KB`;
          if (!load.lazy) {
            loaded += load.kb;
            counter('JS before it works', `${loaded} KB`);
          }
          if (fixed && load.file === 'core') showWorks(done);
        }
      }
      if (fixed && t === 1250) caption('The visitor opens Graph: only now does graph.js load.');
      await wait(STEP_MS * 0.8);
    }
    if (!fixed) showWorks(end);
    caption(
      fixed
        ? '74 KB before the page works, instead of 514 KB.'
        : '514 KB before the page responds, mostly for routes never opened.',
    );
  },
};
