// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import CountUp from '@/components/islands/CountUp';

afterEach(cleanup);

describe('CountUp', () => {
  it('renders the final text immediately, then settles on it after counting', async () => {
    render(<CountUp text="18/18 reachable" />);
    expect(screen.getByText(/reachable/).textContent).toBe('18/18 reachable');
    await waitFor(() => expect(screen.getByText(/reachable/).textContent).toBe('18/18 reachable'), {
      timeout: 1500,
    });
  });

  it('keeps decimals while counting', async () => {
    render(<CountUp text="1.62 s" />);
    await waitFor(() => expect(screen.getByText(/ s$/).textContent).toMatch(/^\d+\.\d{2} s$/));
  });

  it('leaves non-numeric text alone', () => {
    render(<CountUp text="n/a" />);
    expect(screen.getByText('n/a')).toBeTruthy();
  });
});

describe('CountUp updates', () => {
  it('restarts from the new value when the text changes mid-count', async () => {
    const { rerender } = render(<CountUp text="514 KB" />);
    rerender(<CountUp text="74 KB" />);
    await waitFor(() => expect(screen.getByText(/KB$/).textContent).toBe('74 KB'), { timeout: 1500 });
  });
});
