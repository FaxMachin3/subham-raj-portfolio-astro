import { useEffect, useRef } from 'react';
import { useReducedMotion } from '@/lib/useReducedMotion';

const DURATION_MS = 700;

/**
 * Renders `text` and, when it changes, counts its leading number up from zero ("1.62 s", "18/18
 * reachable"). The final text is what React renders, so screen readers and no-JS see the real value;
 * the animation only rewrites the same text node in between.
 */
export default function CountUp({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const node = ref.current?.firstChild;
    const match = text.match(/^(\d+(?:\.(\d+))?)(.*)$/s);
    if (!node || !match || reducedMotion) return;
    const target = Number(match[1]);
    const decimals = match[2]?.length ?? 0;
    const suffix = match[3]!;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - (1 - t) ** 3;
      node.nodeValue = `${(target * eased).toFixed(decimals)}${suffix}`;
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      node.nodeValue = text;
    };
  }, [text, reducedMotion]);

  return <span ref={ref}>{text}</span>;
}
