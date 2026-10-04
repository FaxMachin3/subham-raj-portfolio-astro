export const FIX_IDS = ['plot', 'jank', 'bundle', 'network', 'a11y', 'i18n'] as const;
export type FixId = (typeof FIX_IDS)[number];

/** Where a fix currently is. `healthy` is the untouched initial state. */
export type FixStatus = 'healthy' | 'breaking' | 'broken' | 'fixing' | 'fixed';

/** What the controller wants a fix to be. Cards reconcile towards this. */
export type FixTarget = 'broken' | 'fixed';

export type MeasurementUnit = 'ms' | 'frames' | 'bytes' | 'requests' | 'audit' | 'missing';

/** A single number measured on the visitor's device. */
export interface Measurement {
  value: number;
  unit: MeasurementUnit;
  /** Human-readable value, e.g. "1.12 s" or "565 KB". */
  display: string;
  /** Short context shown under the value, e.g. "20,000 elements · main thread blocked". */
  detail: string;
  /** False when the browser cannot measure this; the UI shows "n/a" instead of a misleading zero. */
  supported: boolean;
}

export interface FixResult {
  before?: Measurement;
  after?: Measurement;
}
