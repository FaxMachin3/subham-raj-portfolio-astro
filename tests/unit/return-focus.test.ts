// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rememberOpener, restoreOpener } from '@/lib/return-focus';

const pageshow = (persisted: boolean) => {
  const event = new Event('pageshow') as PageTransitionEvent;
  Object.defineProperty(event, 'persisted', { value: persisted });
  window.dispatchEvent(event);
};

const navigationType = (type: string | null) =>
  vi
    .spyOn(performance, 'getEntriesByType')
    .mockReturnValue((type === null ? [] : [{ type }]) as unknown as PerformanceEntryList);

describe('return focus', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <a data-opener href="/work/a">A</a>
      <a data-opener href="/work/b"><span>B</span></a>
      <a href="/elsewhere">Other</a>`;
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const link = (href: string) => document.querySelector<HTMLAnchorElement>(`a[href="${href}"]`)!;
  const click = (target: Element, detail: number) =>
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail }));

  it('remembers the card that was opened, and whether it was opened from the keyboard', () => {
    rememberOpener();
    click(link('/work/b').querySelector('span')!, 1);
    expect(JSON.parse(sessionStorage.getItem('return-focus')!)).toEqual({ href: '/work/b', keyboard: false });
    click(link('/work/a'), 0);
    expect(JSON.parse(sessionStorage.getItem('return-focus')!)).toEqual({ href: '/work/a', keyboard: true });
    sessionStorage.clear();
    click(link('/elsewhere'), 1);
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(sessionStorage.getItem('return-focus')).toBeNull();
  });

  it('survives blocked storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    rememberOpener();
    expect(() => click(link('/work/a'), 1)).not.toThrow();
  });

  it('keeps the existing opener when a card is opened in another tab or the click is cancelled', () => {
    rememberOpener();
    click(link('/work/a'), 1);
    const original = sessionStorage.getItem('return-focus');
    for (const options of [
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
      { altKey: true },
      { button: 1 },
    ]) {
      link('/work/b').dispatchEvent(new MouseEvent('click', { bubbles: true, ...options }));
      expect(sessionStorage.getItem('return-focus')).toBe(original);
    }
    const cancelled = new MouseEvent('click', { bubbles: true, cancelable: true });
    cancelled.preventDefault();
    link('/work/b').dispatchEvent(cancelled);
    link('/work/b').target = '_blank';
    click(link('/work/b'), 1);
    link('/work/b').target = '';
    link('/work/b').download = 'study';
    click(link('/work/b'), 1);
    expect(sessionStorage.getItem('return-focus')).toBe(original);
  });

  it('focuses the opened card on a Back return, without scrolling, and only once', () => {
    navigationType('navigate');
    restoreOpener();
    sessionStorage.setItem('return-focus', JSON.stringify({ href: '/work/b', keyboard: true }));
    const focus = vi.spyOn(link('/work/b'), 'focus');
    pageshow(true);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true, focusVisible: true });
    expect(sessionStorage.getItem('return-focus')).toBeNull();
  });

  it('also restores after a reloaded Back visit, and ignores fresh visits and missing cards', () => {
    const type = navigationType('back_forward');
    restoreOpener();
    sessionStorage.setItem('return-focus', JSON.stringify({ href: '/work/a', keyboard: false }));
    const focus = vi.spyOn(link('/work/a'), 'focus');
    pageshow(false);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true, focusVisible: false });

    focus.mockClear();
    type.mockReturnValue([{ type: 'navigate' }] as unknown as PerformanceEntryList);
    sessionStorage.setItem('return-focus', JSON.stringify({ href: '/work/a', keyboard: false }));
    pageshow(false);
    expect(focus).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('return-focus')).toBeNull();

    type.mockReturnValue([] as unknown as PerformanceEntryList);
    sessionStorage.setItem('return-focus', JSON.stringify({ href: '/work/gone', keyboard: false }));
    expect(() => pageshow(true)).not.toThrow();
    pageshow(true);
  });

  it('ignores unreadable storage', () => {
    navigationType('back_forward');
    restoreOpener();
    sessionStorage.setItem('return-focus', '{not json');
    const focus = vi.spyOn(link('/work/a'), 'focus');
    pageshow(true);
    expect(focus).not.toHaveBeenCalled();
  });
});
