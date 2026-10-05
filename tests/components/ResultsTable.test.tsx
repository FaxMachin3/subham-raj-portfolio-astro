// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import ResultsTable from '@/components/islands/ResultsTable';
import { $prState, $results } from '@/stores/fixes';

const production = {
  plot: '15.5 s → 14 ms',
  jank: 'Jank removed',
  bundle: '~85% smaller',
  network: 'Fetch on demand',
  a11y: 'Design system for all new UI',
  i18n: 'Typed keys + CI checks',
};

afterEach(() => {
  cleanup();
  $prState.set('none');
});

describe('ResultsTable', () => {
  it('shows production results and placeholders before anything is measured', () => {
    render(<ResultsTable production={production} />);
    const row = screen.getByRole('row', { name: /Plot matching/ });
    expect(within(row).getByText('15.5 s → 14 ms')).toBeTruthy();
    expect(within(row).getAllByText('—')).toHaveLength(2);
    expect(screen.getByTestId('pr-badge').textContent).toBe('Not started');
  });

  it('fills in session measurements and the merged PR state', () => {
    $results.setKey('plot', {
      before: { value: 900, unit: 'ms', display: '900 ms', detail: '', supported: true },
      after: { value: 4, unit: 'ms', display: '4.0 ms', detail: '', supported: true },
    });
    $prState.set('merged');
    render(<ResultsTable production={production} />);
    const row = screen.getByRole('row', { name: /Plot matching/ });
    expect(within(row).getByText('900 ms')).toBeTruthy();
    expect(within(row).getByText('4.0 ms')).toBeTruthy();
    expect(screen.getByTestId('pr-badge').textContent).toBe('Merged');
  });
});

describe('ResultsTable n/a', () => {
  it('says n/a where this browser could not measure', () => {
    $results.setKey('jank', {
      before: { value: 0, unit: 'frames', display: '0 frames', detail: '', supported: false },
    });
    render(<ResultsTable production={production} />);
    const row = screen.getByRole('row', { name: /Sidebar animation/ });
    expect(within(row).getByText('n/a')).toBeTruthy();
    $results.setKey('jank', {});
  });
});
