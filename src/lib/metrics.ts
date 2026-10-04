import { metrics, type Metric, type MetricId } from '@/data/metrics';

export class UnapprovedMetricError extends Error {
  constructor(id: string) {
    super(`Metric "${id}" is not approved for publication. Approve it in src/data/metrics.ts or remove it.`);
    this.name = 'UnapprovedMetricError';
  }
}

/** Use where a number is essential. Referencing an unapproved metric fails the build. */
export function requireMetric(id: MetricId, registry: Record<string, Metric> = metrics): Metric {
  const metric = registry[id];
  if (!metric) throw new Error(`Unknown metric "${id}".`);
  if (!metric.approved) throw new UnapprovedMetricError(id);
  return metric;
}

/** Binds numbers to their units ("14 ms", "30 req/s") so a narrow card never breaks between them. */
export function unbreakable(value: string): string {
  return value.replace(/(\d) (?=[a-z%])/gi, '$1\u00a0');
}

/** Use where a number is a nice-to-have. Unapproved metrics are silently omitted. */
export function optionalMetric(id: MetricId, registry: Record<string, Metric> = metrics): Metric | undefined {
  const metric = registry[id];
  return metric?.approved ? metric : undefined;
}
