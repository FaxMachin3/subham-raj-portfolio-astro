// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initThemeSwitch, THEME_STORAGE_KEY, transitionTheme } from '@/lib/theme';

const markup = `
  <fieldset class="theme-switch">
    ${['system', 'light', 'dark'].map((v) => `<label><input type="radio" name="theme" value="${v}" /></label>`).join('')}
  </fieldset>
  <button class="theme-cycle"></button>`;

const reducedMotion = (reduce: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: reduce && q.includes('reduce') }));

beforeEach(() => {
  document.body.innerHTML = markup;
  delete document.documentElement.dataset.theme;
  localStorage.clear();
  reducedMotion(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete (document as { startViewTransition?: unknown }).startViewTransition;
});

const radio = (value: string) => document.querySelector<HTMLInputElement>(`input[value="${value}"]`)!;
const cycle = () => document.querySelector<HTMLButtonElement>('.theme-cycle')!;

describe('theme switch', () => {
  it('reflects the saved preference in both controls on load', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    initThemeSwitch();
    expect(radio('dark').checked).toBe(true);
    expect(cycle().getAttribute('aria-label')).toBe('Colour theme: Dark. Change theme');
  });

  it('applies a radio choice at once where view transitions are missing, and saves it', () => {
    initThemeSwitch();
    radio('light').checked = true;
    radio('light').dispatchEvent(new Event('change'));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('cycles system → light → dark → system from the compact button', () => {
    initThemeSwitch();
    const seen = [1, 2, 3].map(() => {
      cycle().click();
      return cycle().dataset.preference;
    });
    expect(seen).toEqual(['light', 'dark', 'system']);
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(radio('system').checked).toBe(true);
  });
});

describe('theme transition', () => {
  it('reveals the new theme in a circle from the control when view transitions exist', async () => {
    const animate = vi.fn();
    document.documentElement.animate = animate;
    let finish!: () => void;
    const finished = new Promise<void>((resolve) => (finish = resolve));
    (document as { startViewTransition?: unknown }).startViewTransition = (update: () => void) => {
      update();
      return { ready: Promise.resolve(), finished };
    };
    transitionTheme('dark', cycle());
    expect(document.documentElement.classList.contains('theme-transition')).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
    await Promise.resolve();
    expect(animate).toHaveBeenCalledWith(
      expect.objectContaining({ clipPath: expect.arrayContaining([expect.stringContaining('circle(0')]) }),
      expect.objectContaining({ pseudoElement: '::view-transition-new(root)' }),
    );
    finish();
    await finished;
    await Promise.resolve();
    expect(document.documentElement.classList.contains('theme-transition')).toBe(false);
  });

  it('keeps the theme applied and cleans up when the transition is skipped before ready', async () => {
    const animate = vi.fn();
    document.documentElement.animate = animate;
    const ready = Promise.reject(new DOMException('Transition was skipped', 'AbortError'));
    (document as { startViewTransition?: unknown }).startViewTransition = (update: () => void) => {
      update();
      return { ready, finished: Promise.resolve() };
    };
    transitionTheme('dark', cycle());
    await Promise.resolve();
    await Promise.resolve();
    expect(animate).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.classList.contains('theme-transition')).toBe(false);
  });

  it('cleans up when an invalid-state abort rejects ready and finished', async () => {
    const error = new DOMException('ViewTransition opt-in disabled', 'InvalidStateError');
    (document as { startViewTransition?: unknown }).startViewTransition = (update: () => void) => {
      update();
      return { ready: Promise.reject(error), finished: Promise.reject(error) };
    };
    transitionTheme('light', cycle());
    await Promise.resolve();
    await Promise.resolve();
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.classList.contains('theme-transition')).toBe(false);
  });

  it('cleans up when the pseudo-element becomes invalid after ready', async () => {
    document.documentElement.animate = vi.fn(() => {
      throw new DOMException('Transition no longer active', 'InvalidStateError');
    });
    (document as { startViewTransition?: unknown }).startViewTransition = (update: () => void) => {
      update();
      return { ready: Promise.resolve(), finished: Promise.resolve() };
    };
    transitionTheme('dark', cycle());
    await Promise.resolve();
    await Promise.resolve();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.classList.contains('theme-transition')).toBe(false);
  });

  it('switches instantly under reduced motion, even with view transitions', () => {
    reducedMotion(true);
    const start = vi.fn();
    (document as { startViewTransition?: unknown }).startViewTransition = start;
    transitionTheme('light', cycle());
    expect(start).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
