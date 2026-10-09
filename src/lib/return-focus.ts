const KEY = 'return-focus';

interface Opener {
  href: string;
  keyboard: boolean;
}

const read = (store: Storage): Opener | null => {
  try {
    const raw = store.getItem(KEY);
    store.removeItem(KEY);
    return raw ? (JSON.parse(raw) as Opener) : null;
  } catch {
    return null;
  }
};

/**
 * Remembers which card opened a case study, so coming back puts focus on that card instead of the top of
 * the page. A keyboard activation (click `detail` of 0) is remembered too: only then is the ring shown.
 */
export function rememberOpener(root: Document = document, store?: Storage): void {
  root.addEventListener('click', (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const link = (event.target as Element | null)?.closest?.<HTMLAnchorElement>('a[data-opener]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    try {
      (store ?? sessionStorage).setItem(
        KEY,
        JSON.stringify({ href: link.getAttribute('href'), keyboard: event.detail === 0 }),
      );
    } catch {
      // Storage unavailable: focus simply isn't restored.
    }
  });
}

/** On a Back/Forward return (restored from cache or reloaded), focuses the card that was opened. */
export function restoreOpener(win: Window = window): void {
  win.addEventListener('pageshow', (event) => {
    const [entry] = win.performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    let opener: Opener | null;
    try {
      opener = read(win.sessionStorage);
    } catch {
      return;
    }
    if (!opener || !(event.persisted || entry?.type === 'back_forward')) return;
    const card = [...win.document.querySelectorAll<HTMLAnchorElement>('a[data-opener]')].find(
      (a) => a.getAttribute('href') === opener.href,
    );
    // The browser has already restored the scroll position; focusing must not move it.
    card?.focus({ preventScroll: true, focusVisible: opener.keyboard } as FocusOptions);
  });
}
