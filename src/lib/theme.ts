export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

/** Must match the inline script in BaseLayout, which applies the theme before first paint. */
export const THEME_STORAGE_KEY = 'theme';

export const isThemePreference = (value: unknown): value is ThemePreference =>
  THEME_PREFERENCES.includes(value as ThemePreference);

export function readThemePreference(storage: Pick<Storage, 'getItem'> = localStorage): ThemePreference {
  try {
    const stored = storage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function saveThemePreference(
  preference: ThemePreference,
  storage: Pick<Storage, 'setItem' | 'removeItem'> = localStorage,
): void {
  try {
    if (preference === 'system') storage.removeItem(THEME_STORAGE_KEY);
    else storage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage can be unavailable (privacy modes); the choice then lasts for this page view only.
  }
}

/** Order used by the compact one-button switch on small screens. */
export function nextThemePreference(current: ThemePreference): ThemePreference {
  return THEME_PREFERENCES[(THEME_PREFERENCES.indexOf(current) + 1) % THEME_PREFERENCES.length]!;
}

/** "system" removes the override, so CSS `color-scheme: light dark` follows the OS. */
export function applyTheme(preference: ThemePreference, root: HTMLElement = document.documentElement): void {
  if (preference === 'system') delete root.dataset.theme;
  else root.dataset.theme = preference;
}

const LABELS: Record<ThemePreference, string> = { system: 'System', light: 'Light', dark: 'Dark' };

/**
 * Applies a preference with a view transition where supported: the new theme spreads in a circle from
 * `origin` (the control that was used). Without view transitions, or under reduced motion, it switches at
 * once.
 */
export function transitionTheme(
  preference: ThemePreference,
  origin: Element,
  doc: Document = document,
): void {
  const apply = () => applyTheme(preference, doc.documentElement);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!doc.startViewTransition || reduced) return apply();

  const box = origin.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const root = doc.documentElement;
  root.classList.add('theme-transition');
  const transition = doc.startViewTransition(apply);
  void transition.ready.then(() =>
    root.animate(
      { clipPath: [`circle(0 at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 480, easing: 'cubic-bezier(0.3, 1, 0.4, 1)', pseudoElement: '::view-transition-new(root)' },
    ),
  );
  void transition.finished.finally(() => root.classList.remove('theme-transition'));
}

/**
 * Wires the header's theme controls: the three-way radio group and the compact cycling button shown on
 * small screens. Both reflect the same saved preference.
 */
export function initThemeSwitch(doc: Document = document): void {
  const inputs = [...doc.querySelectorAll<HTMLInputElement>('.theme-switch input')];
  const cycle = doc.querySelector<HTMLButtonElement>('.theme-cycle')!;

  const sync = (preference: ThemePreference) => {
    for (const input of inputs) input.checked = input.value === preference;
    cycle.dataset.preference = preference;
    cycle.setAttribute('aria-label', `Colour theme: ${LABELS[preference]}. Change theme`);
  };
  const choose = (preference: ThemePreference, origin: Element) => {
    sync(preference);
    saveThemePreference(preference);
    transitionTheme(preference, origin, doc);
  };

  sync(readThemePreference());
  for (const input of inputs) {
    input.addEventListener('change', () => choose(input.value as ThemePreference, input.closest('label')!));
  }
  cycle.addEventListener('click', () =>
    choose(nextThemePreference(cycle.dataset.preference as ThemePreference), cycle),
  );
}
