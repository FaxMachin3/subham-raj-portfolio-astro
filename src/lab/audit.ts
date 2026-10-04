import { contrastRatio, effectiveBackground, parseCssColor } from './contrast';

export interface AuditReport {
  /** Elements a user is expected to interact with (marked `data-interactive`). */
  interactive: number;
  /** How many of those a keyboard user can reach. */
  reachable: number;
  /** Interactive elements with no accessible name. */
  unlabeled: number;
  /** Contrast of the region's body text (marked `data-audit-text`). */
  contrast: number;
}

const hasAccessibleName = (el: Element) =>
  /[\p{L}\p{N}]/u.test(el.getAttribute('aria-label') ?? '') || /[\p{L}\p{N}]/u.test(el.textContent ?? '');

/**
 * Audits a demo region the way a keyboard and screen-reader user experiences it. A table with a
 * roving tabindex (one cell at tabindex=0) is one Tab stop whose arrow keys reach every cell.
 */
export function auditRegion(root: HTMLElement): AuditReport {
  const interactive = [...root.querySelectorAll<HTMLElement>('[data-interactive]')];
  const cells = interactive.filter((el) => el.tagName === 'TD');
  const controls = interactive.filter((el) => el.tagName !== 'TD');
  const tableIsRoving = cells.some((el) => el.tabIndex === 0);
  const reachable = controls.filter((el) => el.tabIndex >= 0).length + (tableIsRoving ? cells.length : 0);

  const text = root.querySelector<HTMLElement>('[data-audit-text]');
  const fg = text ? parseCssColor(getComputedStyle(text).color) : null;
  const contrast = text && fg ? contrastRatio(fg, effectiveBackground(text)) : 0;

  return {
    interactive: interactive.length,
    reachable,
    unlabeled: interactive.filter((el) => !hasAccessibleName(el)).length,
    contrast,
  };
}
