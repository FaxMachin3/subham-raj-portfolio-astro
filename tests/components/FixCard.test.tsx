// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import FixCard from '@/components/islands/FixCard';
import { $results, $runActive, $statuses, $targets } from '@/stores/fixes';

function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: reduce && query.includes('reduce'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

const renderCard = (id: 'plot' | 'bundle' = 'plot') =>
  render(
    <FixCard
      id={id}
      number="01"
      area="performance"
      title="A test card"
      description="desc"
      measureLabel={{ before: 'measured', after: 'measured' }}
    >
      <div>demo</div>
    </FixCard>,
  );

beforeEach(() => {
  mockReducedMotion(false);
  $statuses.setKey('plot', 'healthy');
  $statuses.setKey('bundle', 'healthy');
  $results.setKey('plot', {});
  $targets.setKey('plot', null);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('FixCard', () => {
  it('shows the healthy state and empty measurements', () => {
    renderCard();
    expect(screen.getByTestId('status').textContent).toBe('Healthy');
    expect(screen.getAllByText('not measured yet')).toHaveLength(2);
  });

  it('requests a break and reflects the in-progress state', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Break' }));
    expect($targets.get().plot?.target).toBe('broken');
    expect(screen.getByTestId('status').textContent).toBe('Breaking…');
    expect(screen.getByRole('button', { name: 'Fix' })).toHaveProperty('disabled', true);
  });

  it('locks its own Break and Fix while a whole-site run is in progress', () => {
    renderCard();
    act(() => $runActive.set(true));
    expect(screen.getByRole('button', { name: 'Break' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Fix' })).toHaveProperty('disabled', true);
    act(() => $runActive.set(false));
    expect(screen.getByRole('button', { name: 'Fix' })).toHaveProperty('disabled', false);
  });

  it('renders measurements, and "n/a" when the browser cannot measure', () => {
    $results.setKey('plot', {
      before: { value: 900, unit: 'ms', display: '900 ms', detail: '20,000 elements', supported: true },
      after: { value: 0, unit: 'ms', display: '0', detail: 'unsupported here', supported: false },
    });
    renderCard();
    expect(screen.getAllByTestId('metric-before')[0]!.textContent).toBe('900 ms');
    expect(screen.getAllByTestId('metric-after')[0]!.textContent).toBe('n/a');
  });

  it('blocks motion-heavy breaks for reduced-motion users, but never the fix', () => {
    mockReducedMotion(true);
    renderCard('plot');
    expect(screen.getByRole('button', { name: 'Break' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Fix' })).toHaveProperty('disabled', false);
  });

  it('still allows non-motion breaks for reduced-motion users', () => {
    mockReducedMotion(true);
    renderCard('bundle');
    expect(screen.getByRole('button', { name: 'Break' })).toHaveProperty('disabled', false);
  });
});
