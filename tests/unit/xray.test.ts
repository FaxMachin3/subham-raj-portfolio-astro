// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FIX_IDS } from '@/fixes/types';
import { abortableWait, createContext } from '@/xray/runtime';
import { SCENES } from '@/xray/scenes';
import { INCOMING, scanComparisons } from '@/xray/scenes/plot';
import { $xray, finishXray, playXray } from '@/xray/store';

afterEach(() => {
  vi.useRealTimers();
  for (const id of FIX_IDS) $xray.setKey(id, null);
});

describe('x-ray store', () => {
  it('shows an x-ray and resolves when it finishes', async () => {
    const done = playXray('plot', 'broken', { quick: false, signal: new AbortController().signal });
    const request = $xray.get().plot!;
    expect(request).toMatchObject({ phase: 'broken', quick: false });
    finishXray('plot', request.nonce);
    await expect(done).resolves.toBeUndefined();
    expect($xray.get().plot).toBeNull();
  });

  it('resolves and clears when aborted', async () => {
    const controller = new AbortController();
    const done = playXray('jank', 'fixed', { quick: true, signal: controller.signal });
    controller.abort();
    await expect(done).resolves.toBeUndefined();
    expect($xray.get().jank).toBeNull();
  });

  it('never holds a fix up for longer than the safety timeout', async () => {
    vi.useFakeTimers();
    const done = playXray('bundle', 'broken', { quick: false, signal: new AbortController().signal });
    vi.advanceTimersByTime(12_000);
    await expect(done).resolves.toBeUndefined();
  });

  it('ignores a stale finish from an earlier run', () => {
    const signal = new AbortController().signal;
    void playXray('i18n', 'broken', { quick: false, signal });
    const first = $xray.get().i18n!.nonce;
    void playXray('i18n', 'fixed', { quick: false, signal });
    finishXray('i18n', first);
    expect($xray.get().i18n).toMatchObject({ phase: 'fixed' });
  });

  it('skips quick x-rays under reduced motion', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    await playXray('a11y', 'fixed', { quick: true, signal: new AbortController().signal });
    expect($xray.get().a11y).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe('x-ray runtime', () => {
  it('rejects waits with an AbortError when cancelled', async () => {
    const controller = new AbortController();
    const wait = abortableWait(1000, controller.signal);
    controller.abort();
    await expect(wait).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('scales waits by speed and skips them when instant', async () => {
    vi.useFakeTimers();
    const base = {
      root: document.createElement('div'),
      phase: 'broken' as const,
      signal: new AbortController().signal,
      caption() {},
      counter() {},
    };
    let resolved = false;
    void createContext({ ...base, instant: false, speed: 0.5 })
      .wait(1000)
      .then(() => (resolved = true));
    await vi.advanceTimersByTimeAsync(499);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(resolved).toBe(true);
    await expect(createContext({ ...base, instant: true, speed: 1 }).wait(10_000)).resolves.toBeUndefined();
  });
});

describe('x-ray scenes', () => {
  it('counts the comparisons a scan inside a loop makes', () => {
    expect(scanComparisons(['a', 'b', 'c'])).toBe(3); // 0 + 1 + 2
    expect(scanComparisons(['a', 'b', 'a'])).toBe(2); // 0 + 1, then a matches first
    expect(scanComparisons(INCOMING)).toBeGreaterThan(INCOMING.length * 2);
  });

  const final: Record<string, Record<'broken' | 'fixed', RegExp>> = {
    plot: { broken: /comparisons for 10 elements/, fixed: /10 lookups instead of \d+ comparisons/ },
    jank: { broken: /11 dropped frames/, fixed: /Every frame painted/ },
    bundle: { broken: /514 KB/, fixed: /74 KB before the page works/ },
    network: { broken: /requests in seconds/, fixed: /6 requests, and no layout shift/ },
    a11y: { broken: /0 of 18/, fixed: /Every control reachable/ },
    i18n: { broken: /raw key/, fixed: /Fixed before shipping/ },
  };

  for (const id of FIX_IDS) {
    for (const phase of ['broken', 'fixed'] as const) {
      it(`${id} (${phase}) renders straight to its final frame when instant`, async () => {
        const root = document.createElement('div');
        document.body.append(root);
        const captions: string[] = [];
        const counters: string[] = [];
        await SCENES[id].play(
          createContext({
            root,
            phase,
            instant: true,
            speed: 1,
            signal: new AbortController().signal,
            caption: (text) => captions.push(text),
            counter: (label, value) => counters.push(`${label}: ${value}`),
          }),
        );
        expect(captions.at(-1)).toMatch(final[id]![phase]);
        expect(counters.length).toBeGreaterThan(0);
        expect(root.children.length).toBeGreaterThan(0);
        expect(SCENES[id].label[phase].length).toBeGreaterThan(5);
        root.remove();
      });
    }
  }
});

describe('x-ray edge cases', () => {
  it('rejects at once when already aborted, even in instant mode', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(abortableWait(10, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    const ctx = createContext({
      root: document.createElement('div'),
      phase: 'broken',
      instant: true,
      speed: 1,
      signal: controller.signal,
      caption() {},
      counter() {},
    });
    await expect(ctx.wait(10)).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('does not show an x-ray for an already-cancelled run', async () => {
    const controller = new AbortController();
    controller.abort();
    await playXray('plot', 'broken', { quick: false, signal: controller.signal });
    expect($xray.get().plot).toBeNull();
  });

  it('animates network requests as dots when not instant', async () => {
    const root = document.createElement('div');
    document.body.append(root);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
    const counters: string[] = [];
    const play = SCENES.network.play(
      createContext({
        root,
        phase: 'fixed',
        instant: false,
        speed: 0.02,
        signal: new AbortController().signal,
        caption() {},
        counter: (_label, value) => counters.push(value),
      }),
    );
    await vi.waitFor(() => expect(root.querySelector('.xr-dot')).not.toBeNull());
    await play;
    await vi.waitFor(() => expect(root.querySelector('.xr-dot')).toBeNull(), { timeout: 2000 });
    expect(counters.at(-1)).toBe('6');
    vi.unstubAllGlobals();
    root.remove();
  });
});
