import { useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { $ready, $statuses, $targets, recordMeasurement } from '@/stores/fixes';
import { playXray } from '@/xray/store';
import type { FixId, Measurement } from './types';

export interface FixHandlers {
  /** Re-create the problem and measure it. Must stop promptly when `signal` aborts. */
  break(signal: AbortSignal): Promise<Measurement>;
  /** Apply the fix and measure it. */
  fix(signal: AbortSignal): Promise<Measurement>;
}

/**
 * Connects a fix card to the shared store. The controller only sets a target; each card reconciles
 * towards it, so a card that hydrates late still catches up, and a newer request aborts an older one.
 */
export function useFixLifecycle(id: FixId, handlers: FixHandlers): void {
  const request = useStore($targets, { keys: [id] })[id];
  const handlersRef = useRef(handlers);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    $ready.setKey(id, true);
    return () => $ready.setKey(id, false);
  }, [id]);

  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();
    const breaking = request.target === 'broken';
    $statuses.setKey(id, breaking ? 'breaking' : 'fixing');

    const { signal } = controller;
    // The x-ray explains what is about to happen; the measured run starts only after it, never during.
    playXray(id, request.target, { quick: request.quick, signal })
      .then(() => {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const run = breaking ? handlersRef.current.break : handlersRef.current.fix;
        return run(signal);
      })
      .then((measurement) => {
        if (controller.signal.aborted) return;
        recordMeasurement(id, breaking ? 'before' : 'after', measurement);
        $statuses.setKey(id, request.target);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error(`[fix:${id}]`, error);
        $statuses.setKey(id, 'failed');
      });

    return () => controller.abort();
  }, [id, request]);
}
