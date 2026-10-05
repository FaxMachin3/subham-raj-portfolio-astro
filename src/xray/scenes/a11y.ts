import { offset, q, render, type Scene } from '../runtime';

export const a11yScene: Scene = {
  label: { broken: 'what keyboard and screen-reader users get', fixed: 'real semantics' },

  async play({ root, phase, wait, caption, counter }) {
    const fixed = phase === 'fixed';
    render(
      root,
      `<div class="xr-a11y${fixed ? '' : ' xr-a11y--broken'}">
        <div class="xr-a11y__row">
          <span class="xr-box" data-stop="search">Search</span>
          <div class="xr-a11y__panel">
            <div class="xr-a11y__tools"><span class="xr-box" data-stop="filter">Filter</span><span class="xr-box" data-stop="export">Export</span><span class="xr-box" data-stop="more">⋯</span></div>
            <div class="xr-a11y__table"><span data-stop="h0">Address</span><span data-stop="h1">Type</span><span data-stop="h2">Risk</span><span data-stop="c0">0x9f…a21</span><span>Exchange</span><span>Low</span></div>
          </div>
          <span class="xr-box" data-stop="next">Next</span>
        </div>
        <div class="xr-keys" data-keys></div>
        <div class="xr-sr"><span>🔊</span><span data-said>…</span></div>
        <span class="xr-ring" data-ring></span>
      </div>`,
    );
    const a11y = q(root, '.xr-a11y');
    const ring = q(root, '[data-ring]');
    const said = q(root, '[data-said]');
    const keys = q(root, '[data-keys]');
    const focus = (stop: string, leap = false) => {
      const target = offset(q(root, `[data-stop="${stop}"]`), a11y);
      ring.classList.toggle('xr-ring--leap', leap);
      Object.assign(ring.style, {
        translate: `${target.x - 3}px ${target.y - 3}px`,
        width: `${target.width + 6}px`,
        height: `${target.height + 6}px`,
      });
    };
    const announce = (text: string, vague = false) => {
      said.textContent = text;
      said.classList.toggle('xr-said--vague', vague);
    };
    const press = async (key: string, stop: string, text: string, pause = 430) => {
      keys.insertAdjacentHTML('beforeend', `<kbd class="xr-pop">${key}</kbd>`);
      if (keys.children.length > 6) keys.firstElementChild?.remove();
      focus(stop);
      announce(text);
      await wait(pause);
    };

    focus('search');
    announce('Search, edit text');

    if (!fixed) {
      caption('The controls are clickable divs: no focus, no role, no name.');
      counter('keyboard-reachable', '0 / 18');
      await wait(600);
      keys.insertAdjacentHTML('beforeend', '<kbd class="xr-pop">Tab</kbd>');
      focus('next', true);
      announce('Next, link');
      await wait(900);
      caption('Tab skips the whole panel; a screen reader hears nothing useful.');
      for (const text of ['clickable', 'clickable', 'clickable', 'group']) {
        announce(text, true);
        await wait(300);
      }
      caption('0 of 18 controls reachable, one unlabeled icon, faint text.');
      return;
    }

    caption('The fix: real buttons, names, visible focus, one Tab stop per table.');
    counter('keyboard-reachable', '18 / 18');
    await wait(400);
    await press('Tab', 'filter', 'Filter, menu button');
    await press('Tab', 'export', 'Export, button');
    await press('Tab', 'more', 'More actions, menu button');
    await press('Tab', 'c0', 'Linked addresses, table. 0x9f…a21');
    caption('In the table: S moves by row, D by header, Enter sorts.');
    await press('S', 'c0', 'Row 1 of 4: 0x9f…a21, Exchange, Low risk');
    await press('D', 'h1', 'Type column header, not sorted');
    await press('Enter', 'h1', 'Sorted by Type, ascending', 700);
    caption('Every control reachable and announced by name.');
  },
};
