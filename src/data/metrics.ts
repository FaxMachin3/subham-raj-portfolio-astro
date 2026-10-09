/**
 * Every production number shown on the site lives here.
 *
 * `approved: true` means the figure is already public (it appears on Subham's résumé) or has been
 * cleared with the employer. Unapproved production figures can never render: `requireMetric`
 * fails the build and `optionalMetric` hides them.
 */
export interface Metric {
  value: string;
  label: string;
  source: 'production';
  approved: boolean;
  /** Where the figure comes from, for whoever maintains this file. */
  evidence: string;
}

export const metrics = {
  years: {
    value: '8 years',
    label: 'building frontend products',
    source: 'production',
    approved: true,
    evidence: 'Résumé: Infosys 2018 → TRM Labs 2026',
  },
  plotMatching: {
    value: '15.5 s → 14 ms',
    label: 'graph plot matching on 1,600 elements',
    source: 'production',
    approved: true,
    evidence: 'Résumé, TRM Labs: KeyLines performance push',
  },
  perfPrs: {
    value: '20+',
    label: 'PRs in the graph performance push',
    source: 'production',
    approved: true,
    evidence: 'Résumé, TRM Labs',
  },
  mergedPrs: {
    value: '580+',
    label: 'merged PRs at TRM Labs',
    source: 'production',
    approved: true,
    evidence: 'Résumé, TRM Labs',
  },
  bundleCut: {
    value: '~85%',
    label: 'smaller initial bundle from route-level code splitting',
    source: 'production',
    approved: true,
    evidence: 'Résumé, TRM Labs',
  },
  slowRequest: {
    value: 'p95 25 s',
    label: 'request moved off the entity page’s initial load',
    source: 'production',
    approved: true,
    evidence: 'Résumé, TRM Labs',
  },
  polling: {
    value: '30 req/s → ~3 req/min',
    label: 'status polling at peak',
    source: 'production',
    approved: true,
    evidence: 'Résumé, TRM Labs',
  },
  designSystemAdoption: {
    value: 'All new UI',
    label: 'built on the design system I proposed',
    source: 'production',
    approved: true,
    evidence: 'TRM experience record',
  },
  orionLaunch: {
    value: 'Mar 2026',
    label: 'Orion chat UI launched',
    source: 'production',
    approved: true,
    evidence: 'Résumé, TRM Labs',
  },
} as const satisfies Record<string, Metric>;

export type MetricId = keyof typeof metrics;
