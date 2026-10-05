import { q, render, type Scene } from '../runtime';

const FRAMES = 38;
/** The 0.5 s sidebar animation is 30 frames; the last 8 are after `transitionend`. */
const ANIMATION_FRAMES = 30;
/** [first frame, length] of each long "render sidebar" task in the broken version. */
export const LONG_TASKS: readonly [number, number][] = [
  [3, 4],
  [11, 4],
  [20, 3],
];
const IDLE_CHUNKS = [31, 34];

export const jankScene: Scene = {
  label: { broken: 'main thread during the animation', fixed: 'work deferred until it ends' },

  async play({ root, phase, wait, caption, counter }) {
    const fixed = phase === 'fixed';
    render(
      root,
      `<div class="xr-stack">
        <div class="xr-lane"><span class="xr-k">main thread</span><div class="xr-track" data-tasks></div></div>
        <div class="xr-lane"><span class="xr-k">frames</span><div class="xr-track"><div class="xr-frames">${'<span></span>'.repeat(FRAMES)}</div></div></div>
      </div>`,
    );
    const tasks = q(root, '[data-tasks]');
    const frames = [...root.querySelectorAll<HTMLElement>('.xr-frames span')];
    const slot = (i: number) => `${(i / FRAMES) * 100}%`;
    const blocked = new Set<number>();
    if (!fixed)
      LONG_TASKS.forEach(([start, length]) =>
        [...Array(length).keys()].forEach((k) => blocked.add(start + k)),
      );

    caption(
      fixed
        ? 'The fix waits for transitionend, then works in small idle chunks.'
        : 'The sidebar renders its list on the main thread during the animation.',
    );
    let dropped = 0;
    counter('dropped frames', '0');
    for (let i = 0; i < FRAMES; i++) {
      const task = fixed ? undefined : LONG_TASKS.find(([start]) => start === i);
      if (task) {
        tasks.insertAdjacentHTML(
          'beforeend',
          `<span class="xr-task xr-task--long xr-pop" style="left:${slot(i)};width:${slot(task[1])}">render</span>`,
        );
      }
      if (fixed && IDLE_CHUNKS.includes(i)) {
        tasks.insertAdjacentHTML(
          'beforeend',
          `<span class="xr-task xr-task--idle xr-pop" style="left:${slot(i)};width:${slot(2)}">idle</span>`,
        );
      }
      if (i === ANIMATION_FRAMES) {
        tasks.insertAdjacentHTML(
          'beforeend',
          `<span class="xr-marker" style="left:${slot(i)}">transitionend</span>`,
        );
      }
      if (blocked.has(i)) {
        frames[i]!.className = 'xr-frame--drop';
        counter('dropped frames', String(++dropped));
        if (dropped === 1) caption('Long tasks block the frames under them. Those frames never paint.');
      } else {
        frames[i]!.className = 'xr-frame--ok';
      }
      await wait(55);
    }
    caption(
      fixed
        ? 'Every frame painted. The same work ran afterwards, in idle time.'
        : `${dropped} dropped frames in a 0.5 s animation: visible jank.`,
    );
  },
};
