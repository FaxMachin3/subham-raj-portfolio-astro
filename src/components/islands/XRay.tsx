import { useEffect, useRef, useState } from 'react';
import type { FixId } from '@/fixes/types';
import { abortableWait, createContext } from '@/xray/runtime';
import { SCENES } from '@/xray/scenes';
import { finishXray, prefersReducedMotion, type XrayRequest } from '@/xray/store';
// Imported as text and injected when this chunk loads: a plain CSS import would be hoisted into every page. The
// module only ever loads in the browser, once, when FixCard first needs it.
import styles from '@/styles/xray.css?inline';

document.head.append(
  Object.assign(document.createElement('style'), { id: 'xray-styles', textContent: styles }),
);

/** How long the last frame stays up before the real run starts. */
const HOLD_MS = 1100;
/** Under reduced motion the x-ray is a still frame; leave it up long enough to read. */
const STILL_MS = 2200;
const QUICK_SPEED = 0.5;

/**
 * Plays a fix's x-ray over its demo: an animated explanation of the cause (on break) or the mechanism
 * (on fix), drawn on a tiny example. The real, measured run starts only once this has finished.
 */
export default function XRay({ id, request }: { id: FixId; request: XrayRequest }) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [caption, setCaption] = useState('');
  const [counter, setCounter] = useState<{ label: string; value: string } | null>(null);
  const [still] = useState(prefersReducedMotion);
  const scene = SCENES[id];

  useEffect(() => {
    const root = sceneRef.current!;
    const controller = new AbortController();
    const speed = request.quick ? QUICK_SPEED : 1;
    const ctx = createContext({
      root,
      phase: request.phase,
      instant: still,
      speed,
      signal: controller.signal,
      caption: setCaption,
      counter: (label, value) => setCounter({ label, value }),
    });

    void (async () => {
      try {
        await scene.play(ctx);
        await abortableWait(still ? STILL_MS : HOLD_MS * speed, controller.signal);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') console.error(`[xray:${id}]`, error);
      } finally {
        if (!controller.signal.aborted) finishXray(id, request.nonce);
      }
    })();
    return () => controller.abort();
  }, [id, request, scene, still]);

  const label = scene.label[request.phase];
  return (
    <div
      className={`xray xray--${request.phase}${still ? ' xray--still' : ''}`}
      role="group"
      aria-label={`X-ray: ${label}`}
      data-testid="xray"
    >
      <div className="xray__head">
        <span className="xray__label">
          x-ray · <strong>{label}</strong>
        </span>
        <button type="button" className="xray__skip" onClick={() => finishXray(id, request.nonce)}>
          Skip
        </button>
      </div>
      <div className="xray__scene" ref={sceneRef} aria-hidden="true" />
      <div className="xray__foot">
        <p className="xray__caption" aria-live="polite" data-testid="xray-caption">
          {caption}
        </p>
        {counter && (
          <span className="xray__counter">
            <small>{counter.label}</small>
            <strong>{counter.value}</strong>
          </span>
        )}
      </div>
    </div>
  );
}
