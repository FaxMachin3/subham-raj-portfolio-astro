import type { XrayPhase } from './store';

/** What a scene gets to draw with. Scenes are plain DOM code, independent of any framework. */
export interface SceneContext {
  root: HTMLElement;
  phase: XrayPhase;
  /** True under reduced motion: waits resolve at once, so the scene renders straight to its final frame. */
  instant: boolean;
  /** Waits `ms` scaled by the playback speed. Rejects with an AbortError when the x-ray is cancelled. */
  wait(ms: number): Promise<void>;
  caption(text: string): void;
  counter(label: string, value: string): void;
}

export interface Scene {
  label: Record<XrayPhase, string>;
  play(ctx: SceneContext): Promise<void>;
}

export function abortableWait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

export function createContext(options: {
  root: HTMLElement;
  phase: XrayPhase;
  instant: boolean;
  speed: number;
  signal: AbortSignal;
  caption(text: string): void;
  counter(label: string, value: string): void;
}): SceneContext {
  const { signal, speed, instant } = options;
  return {
    ...options,
    wait: (ms) =>
      instant
        ? signal.aborted
          ? abortableWait(0, signal)
          : Promise.resolve()
        : abortableWait(ms * speed, signal),
  };
}

/** Builds markup from trusted, static templates (scenes never interpolate user input). */
export function render(root: HTMLElement, html: string): void {
  root.innerHTML = html;
}

export const q = <T extends HTMLElement = HTMLElement>(root: ParentNode, selector: string) =>
  root.querySelector(selector) as T;

/** Position of `el` relative to `origin`, for overlays drawn inside a scene. */
export function offset(el: Element, origin: Element) {
  const a = el.getBoundingClientRect();
  const b = origin.getBoundingClientRect();
  return { x: a.left - b.left, y: a.top - b.top, width: a.width, height: a.height };
}
