/**
 * "All case studies" goes back like the browser's Back button (the exact scroll position, and the closing
 * page transition) when this page was opened from the homepage in this tab. Otherwise (new tab, direct visit,
 * arriving from elsewhere) it stays an ordinary link to /#work.
 *
 * The decision is stored in this page's history entry, so it survives reloads and back/forward visits, and
 * never leaks into other tabs.
 */
export function markOpenedFromHome(win: Window = window): void {
  if (win.history.state?.openedFromHome) return;
  const [entry] = win.performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  if (entry?.type !== 'navigate' || win.history.length < 2 || !win.document.referrer) return;
  const from = new URL(win.document.referrer);
  if (from.origin !== win.location.origin || from.pathname !== '/') return;
  win.history.replaceState({ ...win.history.state, openedFromHome: true }, '');
}

export function enableBackLink(link: HTMLAnchorElement, win: Window = window): void {
  link.addEventListener('click', (event) => {
    if (event.defaultPrevented || link.hasAttribute('download') || (link.target && link.target !== '_self'))
      return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!win.history.state?.openedFromHome || win.history.length < 2) return;
    event.preventDefault();
    win.history.back();
  });
}
