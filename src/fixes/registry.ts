import type { FixId } from './types';

interface FixMeta {
  /** Short name for progress indicators. */
  label: string;
  /** Conventional-commit style label used in the "PR #581" fix sequence. */
  commit: string;
  /** Fixes that add motion or freeze the page are skipped for reduced-motion users. */
  motion: boolean;
}

export const FIX_META: Record<FixId, FixMeta> = {
  plot: {
    label: 'Graph plotting',
    commit: 'perf(graph): memoize plotted indexes, O(1) lookups',
    motion: true,
  },
  jank: {
    label: 'Sidebar animation',
    commit: 'perf(sidebar): defer work until the transition ends',
    motion: true,
  },
  bundle: {
    label: 'Bundle size',
    commit: 'perf(load): split routes, load on demand',
    motion: false,
  },
  network: {
    label: 'Network requests',
    commit: 'perf(network): fetch on scroll, back off polling',
    motion: true,
  },
  a11y: {
    label: 'Accessibility',
    commit: 'a11y(panel): semantics, labels, focus, contrast',
    motion: false,
  },
  i18n: {
    label: 'Translations',
    commit: 'i18n: typed keys, lazy cached translations',
    motion: false,
  },
};

/**
 * Order used by "Let Subham fix it". Quick, visual wins first; the plot fix last so its
 * dramatic before/after closes the sequence.
 */
export const FIX_ORDER: readonly FixId[] = ['a11y', 'i18n', 'jank', 'bundle', 'network', 'plot'];

/** Order used when breaking: the plot freezes the main thread, so it runs once everything else is broken. */
export const BREAK_ORDER: readonly FixId[] = ['a11y', 'i18n', 'jank', 'bundle', 'network', 'plot'];

/** Which fixes each word of the hero headline stands for: the word breaks and heals with them. */
export const HERO_WORDS = {
  fast: ['plot', 'jank', 'bundle', 'network'],
  accessible: ['a11y'],
  global: ['i18n'],
} as const satisfies Record<string, readonly FixId[]>;
