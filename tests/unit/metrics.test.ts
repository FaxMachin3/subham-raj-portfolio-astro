import { describe, expect, it } from 'vitest';
import { metrics, type Metric } from '@/data/metrics';
import { optionalMetric, requireMetric, unbreakable, UnapprovedMetricError } from '@/lib/metrics';

const registry: Record<string, Metric> = {
  public: { value: '1', label: 'public', source: 'production', approved: true, evidence: 'résumé' },
  secret: { value: '2', label: 'secret', source: 'production', approved: false, evidence: 'memory' },
};

describe('metrics guard', () => {
  it('returns approved metrics', () => {
    expect(requireMetric('public' as never, registry).value).toBe('1');
    expect(optionalMetric('public' as never, registry)?.value).toBe('1');
  });

  it('refuses to render an unapproved metric where it is required', () => {
    expect(() => requireMetric('secret' as never, registry)).toThrow(UnapprovedMetricError);
  });

  it('silently omits an unapproved metric where it is optional', () => {
    expect(optionalMetric('secret' as never, registry)).toBeUndefined();
  });

  it('throws on unknown ids', () => {
    expect(() => requireMetric('nope' as never, registry)).toThrow(/Unknown metric/);
  });

  it('documents evidence for every real metric', () => {
    for (const metric of Object.values(metrics)) expect(metric.evidence.length).toBeGreaterThan(5);
  });

  it('binds numbers to their units without touching other spaces', () => {
    expect(unbreakable('15.5 s → 14 ms')).toBe('15.5\u00a0s → 14\u00a0ms');
    expect(unbreakable('30 req/s → ~3 req/min')).toBe('30\u00a0req/s → ~3\u00a0req/min');
    expect(unbreakable('All new UI')).toBe('All new UI');
  });

  it('keeps the unconfirmed migration figure unpublished until it is approved', () => {
    expect(metrics.designSystemMigration.approved).toBe(false);
  });
});
