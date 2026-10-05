// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import XRay from '@/components/islands/XRay';
import { SCENES } from '@/xray/scenes';
import { $xray, playXray } from '@/xray/store';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function start(id: 'a11y' | 'plot', phase: 'broken' | 'fixed', quick = false) {
  const done = playXray(id, phase, { quick, signal: new AbortController().signal });
  render(<XRay id={id} request={$xray.get()[id]!} />);
  return done;
}

describe('XRay', () => {
  it('injects its styles once, plays the scene with captions and a counter, then finishes', async () => {
    vi.useFakeTimers();
    const done = start('a11y', 'fixed', true);
    expect(document.querySelectorAll('#xray-styles')).toHaveLength(1);
    expect(screen.getByRole('group', { name: 'X-ray: real semantics' })).toBeTruthy();
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    await done;
    expect(screen.getByTestId('xray-caption').textContent).toBe(
      'Every control reachable and announced by name.',
    );
    expect(screen.getByText('18 / 18')).toBeTruthy();
    expect($xray.get().a11y).toBeNull();
  });

  it('can be skipped', async () => {
    const done = start('plot', 'broken');
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    await expect(done).resolves.toBeUndefined();
  });

  it('is a still frame under reduced motion', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    start('a11y', 'broken');
    expect(screen.getByRole('group').className).toContain('xray--still');
    await vi.waitFor(() => expect(screen.getByTestId('xray-caption').textContent).toMatch(/0 of 18/));
  });

  it('logs a failing scene and still finishes, so the fix is never stuck', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(SCENES.plot, 'play').mockRejectedValue(new Error('scene broke'));
    const done = start('plot', 'fixed');
    await expect(done).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith('[xray:plot]', expect.any(Error));
  });

  it('stops quietly when unmounted mid-play', () => {
    const error = vi.spyOn(console, 'error');
    void start('plot', 'broken');
    cleanup();
    expect(error).not.toHaveBeenCalled();
  });
});
