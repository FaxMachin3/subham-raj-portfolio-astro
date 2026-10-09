// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import BundleFix from '@/components/islands/fixes/BundleFix';
import * as resources from '@/lab/resources';
import { $results, $statuses, $targets, requestTarget } from '@/stores/fixes';
import { $xray, finishXray } from '@/xray/store';

// Reject the actual dynamic module, so BundleFix's importRoute catch executes. Rejecting
// importCounted instead would bypass the URL discovery and same-origin guard entirely.
vi.mock('@/demos/routes/graph.ts', () => {
  throw new TypeError('offline');
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('handles a rejected route module with no observed resource URL and leaves other routes usable', async () => {
  vi.spyOn(resources, 'resourceEntries').mockReturnValue([]);
  $targets.setKey('bundle', null);
  $statuses.setKey('bundle', 'healthy');
  $results.setKey('bundle', {});
  const stop = $xray.listen((xray) => {
    if (xray.bundle) queueMicrotask(() => finishXray('bundle', xray.bundle!.nonce));
  });
  try {
    render(<BundleFix productionNote="note" />);
    act(() => requestTarget('bundle', 'fixed'));
    await vi.waitFor(() => expect($statuses.get().bundle).toBe('fixed'));
    fireEvent.click(screen.getByRole('button', { name: 'Open graph' }));
    const retry = await screen.findByRole<HTMLButtonElement>('button', { name: 'Retry graph · failed' });
    expect(retry.disabled).toBe(false);
    fireEvent.click(retry);
    await screen.findByRole('button', { name: 'Retry graph · failed' });
    expect(screen.queryByRole('button', { name: /^graph ·/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open search' }));
    const loaded = await screen.findByRole<HTMLButtonElement>('button', { name: 'search · loaded' });
    expect(loaded.disabled).toBe(true);
  } finally {
    stop();
  }
});
