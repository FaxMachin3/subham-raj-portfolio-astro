/** Native disclosure fallback, with a reversible circular reveal and modal keyboard behaviour. */
export function enhanceMobileNav(menu: HTMLDetailsElement, doc: Document = document): () => void {
  const summary = menu.querySelector('summary')!;
  const panel = menu.querySelector<HTMLElement>('.mobile-nav__panel')!;
  const label = menu.querySelector('[data-menu-label]')!;
  const header = menu.closest('header')!;
  const view = doc.defaultView!;
  const background = new Map<HTMLElement, boolean>();
  let animation: Animation | undefined;
  let revision = 0;
  let closing = false;
  let scrollPosition: { left: number; top: number } | undefined;
  let pointerPosition: { left: number; top: number } | undefined;

  function settle(open: boolean) {
    animation?.cancel();
    animation = undefined;
    menu.open = open;
    closing = false;
    menu.removeAttribute('data-closing');
    if (!open) {
      for (const [element, inert] of background) element.inert = inert;
      background.clear();
      // WebKit can adjust scroll when removing the focused disclosure's fixed panel.
      // Restore synchronously, before paint or a chosen link's default navigation.
      if (scrollPosition) view.scrollTo({ ...scrollPosition, behavior: 'instant' });
      scrollPosition = undefined;
    }
  }

  function change(open: boolean, immediate = false) {
    const current = animation ? view.getComputedStyle(panel).clipPath : undefined;
    const token = ++revision;
    animation?.cancel();
    animation = undefined;
    closing = !open;
    menu.toggleAttribute('data-closing', !open);
    summary.setAttribute('aria-expanded', String(open));
    label.textContent = open ? 'Close navigation' : 'Open navigation';
    if (!open && scrollPosition) view.scrollTo({ ...scrollPosition, behavior: 'instant' });
    if (open) {
      scrollPosition ??= { left: view.scrollX, top: view.scrollY };
      menu.open = true;
      for (const element of Array.from(doc.body.children)) {
        if (element instanceof HTMLElement && element !== header && !background.has(element)) {
          background.set(element, element.inert);
          element.inert = true;
        }
      }
      view.scrollTo({ ...scrollPosition, behavior: 'instant' });
    }
    const finish = () => {
      if (token !== revision) return;
      settle(open);
      if (open) {
        panel.querySelector<HTMLElement>('a')!.focus({ preventScroll: true });
        view.scrollTo({ ...scrollPosition!, behavior: 'instant' });
      }
    };
    if (immediate || view.matchMedia('(prefers-reduced-motion: reduce)').matches || !panel.animate) {
      finish();
      return;
    }
    const rect = summary.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const radius = Math.hypot(Math.max(x, view.innerWidth - x), Math.max(y, view.innerHeight - y));
    const small = `circle(0px at ${x}px ${y}px)`;
    const large = `circle(${radius}px at ${x}px ${y}px)`;
    animation = panel.animate(
      [{ clipPath: current ?? (open ? small : large) }, { clipPath: open ? large : small }],
      { duration: open ? 380 : 260, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' },
    );
    void animation.finished.then(finish, () => {});
  }

  const click = (event: MouseEvent) => {
    const target = event.target as Element;
    if (target.closest('summary') === summary) {
      event.preventDefault();
      if (!menu.open) scrollPosition = event.detail ? pointerPosition : undefined;
      pointerPosition = undefined;
      const open = !menu.open || closing;
      if (!open) summary.focus({ preventScroll: true });
      change(open);
    } else if (target.closest('a')) change(false, true);
  };
  const keydown = (event: KeyboardEvent) => {
    if (!menu.open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      summary.focus({ preventScroll: true });
      change(false);
    } else if (event.key === 'Tab') {
      const stops = Array.from(header.querySelectorAll<HTMLElement>('a, summary, button, input')).filter(
        (element) => element.getClientRects().length && !element.hasAttribute('disabled'),
      );
      const first = stops[0]!;
      const last = stops[stops.length - 1]!;
      if (event.shiftKey && doc.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && doc.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };
  const pointerdown = (event: PointerEvent) => {
    if (menu.open && !header.contains(event.target as Node)) change(false, true);
  };
  // Capture before native pointer focus: WebKit may move a sticky summary before click runs.
  const captureScroll = () => {
    pointerPosition = { left: view.scrollX, top: view.scrollY };
  };
  const resize = () => {
    if (menu.open) change(view.innerWidth <= 720 && !closing, true);
  };
  const pagehide = () => change(false, true);
  menu.addEventListener('click', click);
  summary.addEventListener('pointerdown', captureScroll);
  doc.addEventListener('keydown', keydown);
  doc.addEventListener('pointerdown', pointerdown);
  view.addEventListener('resize', resize);
  view.addEventListener('pagehide', pagehide);
  return () => {
    ++revision;
    settle(false);
    menu.removeEventListener('click', click);
    summary.removeEventListener('pointerdown', captureScroll);
    doc.removeEventListener('keydown', keydown);
    doc.removeEventListener('pointerdown', pointerdown);
    view.removeEventListener('resize', resize);
    view.removeEventListener('pagehide', pagehide);
  };
}
