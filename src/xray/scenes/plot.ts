import { q, render, type Scene } from '../runtime';

/** Ten incoming elements; n2 and n3 arrive twice, as repeated addresses do in real investigations. */
export const INCOMING = ['n1', 'n2', 'n3', 'n4', 'n2', 'n5', 'n6', 'n3', 'n7', 'n8'];

/** Comparisons the scan makes: every plotted element up to and including a match, or all of them. */
export function scanComparisons(ids: readonly string[]): number {
  const plotted: string[] = [];
  let comparisons = 0;
  for (const id of ids) {
    const at = plotted.indexOf(id);
    comparisons += at === -1 ? plotted.length : at + 1;
    if (at === -1) plotted.push(id);
  }
  return comparisons;
}

const chip = (id: string, index: number) =>
  `<span class="xr-chip xr-pop" data-id="${id}">${id}<i>${index}</i></span>`;

export const plotScene: Scene = {
  label: { broken: 'scan inside the loop', fixed: 'memoized indexes' },

  async play({ root, phase, wait, caption, counter }) {
    const fixed = phase === 'fixed';
    render(
      root,
      `<div class="xr-stack">
        <div class="xr-lane"><span class="xr-k">incoming</span><span class="xr-chip xr-chip--in" data-in>·</span><span class="xr-tag" data-lookup hidden></span></div>
        <div class="xr-lane"><span class="xr-k">plotted</span><div class="xr-row" data-row></div></div>
        ${fixed ? '<div class="xr-lane"><span class="xr-k">index Map</span><div class="xr-row xr-row--map" data-map></div></div>' : ''}
      </div>`,
    );
    const incoming = q(root, '[data-in]');
    const row = q(root, '[data-row]');

    if (!fixed) {
      caption('Each incoming element scans everything already plotted to find its index.');
      let comparisons = 0;
      counter('comparisons', '0');
      for (const id of INCOMING) {
        incoming.textContent = id;
        let found: HTMLElement | null = null;
        for (const existing of row.children as HTMLCollectionOf<HTMLElement>) {
          existing.classList.add('xr-scan');
          counter('comparisons', String(++comparisons));
          await wait(45);
          existing.classList.remove('xr-scan');
          if (existing.dataset.id === id) {
            found = existing;
            break;
          }
        }
        if (found) {
          found.classList.add('xr-hit');
          await wait(160);
          found.classList.remove('xr-hit');
        } else {
          row.insertAdjacentHTML('beforeend', chip(id, row.children.length));
        }
        await wait(50);
      }
      caption(`${comparisons} comparisons for ${INCOMING.length} elements. The scan grows with n².`);
      return;
    }

    caption('The fix remembers each index in a Map: finding it again is one lookup.');
    const map = q(root, '[data-map]');
    const lookup = q(root, '[data-lookup]');
    const index = new Map<string, number>();
    let lookups = 0;
    counter('lookups', '0');
    for (const id of INCOMING) {
      incoming.textContent = id;
      lookup.hidden = false;
      counter('lookups', String(++lookups));
      const at = index.get(id);
      lookup.textContent = at === undefined ? `Map.get('${id}') → none` : `Map.get('${id}') → ${at}`;
      await wait(110);
      if (at === undefined) {
        index.set(id, row.children.length);
        row.insertAdjacentHTML('beforeend', chip(id, index.get(id)!));
        map.insertAdjacentHTML('beforeend', `<span class="xr-pop">${id}→${index.get(id)}</span>`);
      } else {
        const hit = row.children[at] as HTMLElement;
        hit.classList.add('xr-hit');
        await wait(160);
        hit.classList.remove('xr-hit');
      }
      await wait(50);
    }
    lookup.hidden = true;
    caption(`${lookups} lookups instead of ${scanComparisons(INCOMING)} comparisons. Linear: O(n).`);
  },
};
