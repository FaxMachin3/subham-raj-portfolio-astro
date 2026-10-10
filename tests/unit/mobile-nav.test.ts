// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enhanceMobileNav } from '@/lib/mobile-nav';

describe('phone menu', () => {
  let menu: HTMLDetailsElement;
  let cleanup: () => void;
  let summary: HTMLElement;
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    document.body.innerHTML = `<header><a href="/">Home</a><details><summary><span data-menu-label>Open navigation</span></summary><nav class="mobile-nav__panel"><a href="/#work"><span>Work</span></a><p>text</p></nav></details><button>Theme</button></header><main>outside</main><aside>Already inert</aside>`;
    document.querySelector<HTMLElement>('aside')!.inert = true;
    menu = document.querySelector('details')!;
    summary = menu.querySelector('summary')!;
    cleanup = enhanceMobileNav(menu);
  });
  afterEach(() => cleanup());
  const press = (key: string, shiftKey = false) =>
    document.dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, cancelable: true }));
  const pointer = (target: Element) => target.dispatchEvent(new Event('pointerdown', { bubbles: true }));

  it('opens from the icon, makes background inert, restores prior state and closes for links', () => {
    const down = new Event('pointerdown', { bubbles: true, cancelable: true });
    summary.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(false);
    summary.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    expect(menu.open).toBe(true);
    expect(summary.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector<HTMLElement>('main')!.inert).toBe(true);
    expect(document.activeElement).toBe(menu.querySelector('a'));
    menu.querySelector('p')!.click();
    expect(menu.open).toBe(true);
    menu.querySelector<HTMLElement>('a span')!.click();
    expect(menu.open).toBe(false);
    expect(window.scrollTo).toHaveBeenCalledWith({ left: 0, top: 0, behavior: 'instant' });
    expect(document.querySelector<HTMLElement>('main')!.inert).not.toBe(true);
    expect(document.querySelector<HTMLElement>('aside')!.inert).toBe(true);
  });
  it('closes on Escape, returns focus, and ignores other keys or Escape while closed', () => {
    press('Escape');
    expect(document.activeElement).not.toBe(summary);
    summary.click();
    press('Enter');
    expect(menu.open).toBe(true);
    press('Escape');
    expect(menu.open).toBe(false);
    expect(document.activeElement).toBe(summary);
  });
  it('keeps theme controls usable, closes outside, on pagehide, resize and cleanup', () => {
    pointer(document.querySelector('main')!);
    window.dispatchEvent(new Event('resize'));
    summary.click();
    pointer(document.querySelector('button')!);
    expect(menu.open).toBe(true);
    pointer(document.querySelector('main')!);
    expect(menu.open).toBe(false);
    summary.click();
    window.dispatchEvent(new Event('pagehide'));
    expect(menu.open).toBe(false);
    summary.click();
    window.dispatchEvent(new Event('resize'));
    expect(menu.open).toBe(false);
    summary.click();
    cleanup();
    expect(menu.open).toBe(false);
  });
  it('wraps keyboard focus at both ends without trapping theme controls', () => {
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList);
    summary.click();
    document.querySelector('header')!.insertAdjacentHTML('beforeend', '<button disabled>Disabled</button>');
    const first = document.querySelector<HTMLElement>('header > a')!;
    const last = document.querySelector<HTMLElement>('button')!;
    first.focus();
    press('Tab', true);
    expect(document.activeElement).toBe(last);
    press('Tab');
    expect(document.activeElement).toBe(first);
    summary.focus();
    press('Tab');
    expect(document.activeElement).toBe(summary);
  });
  it('reverses a circular animation and ignores stale completion', async () => {
    const pending: { finish: () => void; reject: () => void }[] = [];
    const animate = vi.fn(() => {
      let finish!: () => void;
      let reject!: () => void;
      const finished = new Promise<void>((resolve, fail) => {
        finish = resolve;
        reject = fail;
      });
      pending.push({ finish, reject });
      return { finished, cancel: vi.fn() } as unknown as Animation;
    });
    menu.querySelector<HTMLElement>('nav')!.animate = animate;
    summary.click();
    expect(animate.mock.calls.length).toBe(1);
    summary.click();
    expect(menu.hasAttribute('data-closing')).toBe(true);
    pending[0]!.finish();
    await Promise.resolve();
    expect(menu.open).toBe(true);
    summary.click();
    pending[1]!.reject();
    pending[2]!.finish();
    await Promise.resolve();
    expect(menu.open).toBe(true);
    expect(menu.hasAttribute('data-closing')).toBe(false);
    summary.click();
    pending[3]!.finish();
    await Promise.resolve();
    expect(menu.open).toBe(false);
  });
  it('captures before native focus, but ignores a cancelled pointer for keyboard opening', () => {
    const top = vi.spyOn(window, 'scrollY', 'get').mockReturnValue(1200);
    summary.dispatchEvent(new Event('pointerdown'));
    top.mockReturnValue(1168);
    summary.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    expect(window.scrollTo).toHaveBeenLastCalledWith({ left: 0, top: 1200, behavior: 'instant' });
    summary.click();
    top.mockReturnValue(800);
    summary.dispatchEvent(new Event('pointerdown'));
    top.mockReturnValue(1000);
    summary.click();
    expect(window.scrollTo).toHaveBeenLastCalledWith({ left: 0, top: 1000, behavior: 'instant' });
  });

  it('settles resizing an open mobile panel immediately', () => {
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(390);
    summary.click();
    window.dispatchEvent(new Event('resize'));
    expect(menu.open).toBe(true);
    summary.click();
    expect(menu.open).toBe(false);
  });
});
