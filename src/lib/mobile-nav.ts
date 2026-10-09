/**
 * The phone menu is a native <details> disclosure, so it opens and closes without JavaScript. This adds what
 * <details> lacks: it closes when a link is chosen, on Escape (returning focus to "Menu"), and on a tap
 * outside it.
 */
export function enhanceMobileNav(menu: HTMLDetailsElement, doc: Document = document): void {
  const summary = menu.querySelector('summary')!;
  menu.addEventListener('click', (event) => {
    if ((event.target as Element).closest('a')) menu.open = false;
  });
  doc.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !menu.open) return;
    menu.open = false;
    summary.focus();
  });
  doc.addEventListener('pointerdown', (event) => {
    if (menu.open && !menu.contains(event.target as Node)) menu.open = false;
  });
}
