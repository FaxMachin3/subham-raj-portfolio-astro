// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { enableBackLink, markOpenedFromHome } from '@/lib/back-link';

const fakeWindow = ({
  state = null as Record<string, unknown> | null,
  type = 'navigate' as string | null,
  length = 2,
  referrer = 'https://subhamraj.dev/',
  origin = 'https://subhamraj.dev',
} = {}) => {
  const history = {
    state,
    length,
    replaceState: vi.fn((next: Record<string, unknown>) => (history.state = next)),
    back: vi.fn(),
  };
  return {
    history,
    performance: { getEntriesByType: () => (type === null ? [] : [{ type }]) },
    document: { referrer },
    location: { origin },
  } as unknown as Window & { history: typeof history };
};

describe('markOpenedFromHome', () => {
  it('marks a same-tab navigation from the homepage, keeping existing state', () => {
    const win = fakeWindow({ state: { other: 1 } });
    markOpenedFromHome(win);
    expect(win.history.replaceState).toHaveBeenCalledWith({ other: 1, openedFromHome: true }, '');
  });

  it.each([
    ['already marked', { state: { openedFromHome: true } }],
    ['reloaded or restored', { type: 'reload' }],
    ['no navigation entry', { type: null }],
    ['a new tab (nothing to go back to)', { length: 1 }],
    ['no referrer', { referrer: '' }],
    ['another site', { referrer: 'https://example.com/' }],
    ['another page', { referrer: 'https://subhamraj.dev/resume' }],
  ])('leaves the link alone when %s', (_, options) => {
    const win = fakeWindow(options);
    markOpenedFromHome(win);
    expect(win.history.replaceState).not.toHaveBeenCalled();
  });
});

describe('enableBackLink', () => {
  const click = (link: HTMLAnchorElement, init: MouseEventInit = {}) => {
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init });
    link.dispatchEvent(event);
    return event.defaultPrevented;
  };

  it('goes back in history when the page was opened from home', () => {
    const win = fakeWindow({ state: { openedFromHome: true } });
    const link = document.createElement('a');
    enableBackLink(link, win);
    expect(click(link)).toBe(true);
    expect(win.history.back).toHaveBeenCalledOnce();
  });

  it('is an ordinary link otherwise', () => {
    const win = fakeWindow();
    const link = document.createElement('a');
    enableBackLink(link, win);
    expect(click(link)).toBe(false);
    expect(win.history.back).not.toHaveBeenCalled();
  });

  it.each(['target', 'download'])('preserves %s link behavior', (attribute) => {
    const win = fakeWindow({ state: { openedFromHome: true } });
    const link = document.createElement('a');
    link.setAttribute(attribute, attribute === 'target' ? '_blank' : 'study.html');
    enableBackLink(link, win);
    expect(click(link)).toBe(false);
    expect(win.history.back).not.toHaveBeenCalled();
  });

  it('respects a click already handled by another listener', () => {
    const win = fakeWindow({ state: { openedFromHome: true } });
    const link = document.createElement('a');
    link.addEventListener('click', (event) => event.preventDefault());
    enableBackLink(link, win);
    expect(click(link)).toBe(true);
    expect(win.history.back).not.toHaveBeenCalled();
  });

  it('keeps the fallback when the history entry is unavailable', () => {
    const win = fakeWindow({ state: { openedFromHome: true }, length: 1 });
    const link = document.createElement('a');
    enableBackLink(link, win);
    expect(click(link)).toBe(false);
    expect(win.history.back).not.toHaveBeenCalled();
  });

  it.each([{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }])(
    'ignores modified or non-primary clicks (%o)',
    (init) => {
      const win = fakeWindow({ state: { openedFromHome: true } });
      const link = document.createElement('a');
      enableBackLink(link, win);
      expect(click(link, init)).toBe(false);
      expect(win.history.back).not.toHaveBeenCalled();
    },
  );
});
