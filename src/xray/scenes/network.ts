import { offset, q, render, type Scene } from '../runtime';

const PANELS = ['Wallet cluster', 'Exchange', 'Mixer', 'OTC desk', 'Bridge', 'Hot wallet'];
const VISIBLE = 3;

export const networkScene: Scene = {
  label: { broken: 'requests from the entity page', fixed: 'requests on demand' },

  async play({ root, phase, wait, caption, counter, instant }) {
    const fixed = phase === 'fixed';
    render(
      root,
      `<div class="xr-net">
        <div class="xr-viewport"><div class="xr-scroller" data-scroller>
          <div class="xr-slot${fixed ? ' xr-slot--reserved' : ''}" data-slot></div>
          ${PANELS.map((p, i) => `<div class="xr-panel xr-panel--wait" data-panel="${i}">${p}</div>`).join('')}
        </div><span class="xr-ghost" data-ghost hidden></span></div>
        <div class="xr-net__side"><span class="xr-k" data-poller>status poll</span><div class="xr-server"><b data-count>0</b><span>requests</span></div></div>
      </div>`,
    );
    const server = q(root, '.xr-server');
    let count = 0;
    counter('requests', '0');

    const arrive = () => {
      q(root, '[data-count]').textContent = String(++count);
      counter('requests', String(count));
    };
    const send = (from: Element, poll = false) => {
      if (instant) return arrive();
      const a = offset(from, root);
      const b = offset(server, root);
      const dot = document.createElement('span');
      dot.className = `xr-dot${poll ? ' xr-dot--poll' : ''}`;
      const x = a.x + a.width - 8;
      const y = a.y + a.height / 2;
      dot.style.translate = `${x}px ${y}px`;
      root.append(dot);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => (dot.style.translate = `${b.x + b.width / 2}px ${b.y + b.height / 2}px`)),
      );
      setTimeout(() => {
        dot.remove();
        arrive();
      }, 420);
    };
    const load = async (indexes: number[]) => {
      for (const i of indexes) {
        const panel = q(root, `[data-panel="${i}"]`);
        send(panel);
        panel.classList.remove('xr-panel--wait');
        await wait(70);
      }
    };
    const banner = () => {
      const slot = q(root, '[data-slot]');
      slot.innerHTML = '<span>New: 3 alerts</span>';
      slot.classList.add('xr-slot--on');
    };

    if (!fixed) {
      caption('On load, every panel fetches, even ones far below the fold.');
      await load([...PANELS.keys()]);
      await wait(450);
      caption('A status check polls in a tight loop, with no back-off.');
      for (let i = 0; i < 12; i++) {
        send(q(root, '[data-poller]'), true);
        await wait(90);
      }
      caption('A late banner arrives with no space reserved and shoves the list.');
      const ghost = q(root, '[data-ghost]');
      const first = offset(q(root, '[data-panel="0"]'), q(root, '.xr-viewport'));
      Object.assign(ghost.style, { top: `${first.y}px`, height: `${first.height * VISIBLE}px` });
      ghost.hidden = false;
      banner();
      await wait(1400);
      caption(`${count} requests in seconds, and a layout shift while reading.`);
      return;
    }

    caption('The fix fetches a panel only when it nears the viewport.');
    await load([...PANELS.keys()].slice(0, VISIBLE));
    await wait(450);
    caption('The banner drops into reserved space. Nothing moves.');
    banner();
    await wait(800);
    caption('Scrolling fetches only the next panels; polling backs off.');
    q(root, '[data-scroller]').classList.add('xr-scroller--down');
    await wait(500);
    await load([VISIBLE, VISIBLE + 1]);
    send(q(root, '[data-poller]'), true);
    await wait(700);
    caption(`${count} requests, and no layout shift.`);
  },
};
