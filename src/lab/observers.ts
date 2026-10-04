const supportedTypes = (): readonly string[] =>
  typeof PerformanceObserver !== 'undefined' ? (PerformanceObserver.supportedEntryTypes ?? []) : [];

/** Safari and Firefox do not report long tasks or layout shifts; the UI says "n/a" there. */
export const support = {
  get longTask() {
    return supportedTypes().includes('longtask');
  },
  get layoutShift() {
    return supportedTypes().includes('layout-shift');
  },
};

interface LayoutShiftEntry extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
  sources?: { node?: Node | null }[];
}

/** Calls back with the duration of each long task (>50 ms on the main thread). */
export function observeLongTasks(onTask: (durationMs: number) => void): () => void {
  if (!support.longTask) return () => {};
  const observer = new PerformanceObserver((list) => list.getEntries().forEach((e) => onTask(e.duration)));
  observer.observe({ type: 'longtask', buffered: false });
  return () => observer.disconnect();
}

/** Calls back with each unexpected layout shift and the nodes that moved. */
export function observeLayoutShifts(onShift: (value: number, nodes: Node[]) => void): () => void {
  if (!support.layoutShift) return () => {};
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as LayoutShiftEntry[]) {
      if (entry.hadRecentInput) continue;
      const nodes = (entry.sources ?? []).flatMap((s) => (s.node ? [s.node] : []));
      onShift(entry.value, nodes);
    }
  });
  observer.observe({ type: 'layout-shift', buffered: false });
  return () => observer.disconnect();
}
