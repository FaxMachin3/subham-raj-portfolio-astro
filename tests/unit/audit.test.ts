// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { auditRegion } from '@/lab/audit';

const brokenMarkup = `
  <div style="background: rgb(217, 216, 210)">
    <div data-interactive>Filter</div>
    <div data-interactive>Export</div>
    <div data-interactive>⋯</div>
    <table><tbody>
      <tr><td data-interactive>a</td><td data-interactive>b</td></tr>
      <tr><td data-interactive>c</td><td data-interactive>d</td></tr>
    </tbody></table>
    <p data-audit-text style="color: rgb(163, 162, 155)">Faint text</p>
  </div>`;

const fixedMarkup = `
  <div style="background: rgb(255, 255, 255)">
    <button data-interactive>Filter</button>
    <button data-interactive>Export</button>
    <button data-interactive aria-label="More actions">⋯</button>
    <table><tbody>
      <tr><td data-interactive tabindex="0">a</td><td data-interactive tabindex="-1">b</td></tr>
      <tr><td data-interactive tabindex="-1">c</td><td data-interactive tabindex="-1">d</td></tr>
    </tbody></table>
    <p data-audit-text style="color: rgb(18, 18, 18)">Readable text</p>
  </div>`;

describe('auditRegion', () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = document.createElement('div');
    document.body.replaceChildren(root);
  });

  it('finds nothing keyboard-reachable, an unlabeled icon and poor contrast in the broken panel', () => {
    root.innerHTML = brokenMarkup;
    const report = auditRegion(root);
    expect(report).toMatchObject({ interactive: 7, reachable: 0, unlabeled: 1 });
    expect(report.contrast).toBeLessThan(2);
  });

  it('counts a roving-tabindex table as reaching every cell in the fixed panel', () => {
    root.innerHTML = fixedMarkup;
    const report = auditRegion(root);
    expect(report).toMatchObject({ interactive: 7, reachable: 7, unlabeled: 0 });
    expect(report.contrast).toBeGreaterThan(7);
  });
});
