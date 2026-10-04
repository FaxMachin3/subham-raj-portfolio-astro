# 0003 · Metrics governance

**Status:** accepted

## Context

The site quotes production numbers from Subham's work at TRM Labs and earlier employers. Publishing a figure
that is wrong, or that the employer has not cleared, would undermine the whole site.

## Decision

Every production number lives in `src/data/metrics.ts` with `approved` and `evidence` fields. Components
cannot hard-code figures; they read them through:

- `requireMetric(id)`, which throws `UnapprovedMetricError` and fails the build if the metric is unapproved;
- `optionalMetric(id)`, which returns `undefined` so the sentence is left out.

Demo readings are kept separate: they are synthetic workloads, labelled as such, measured on the visitor's
device.

## Consequences

- Approving a number is a one-line, reviewable change with its evidence next to it.
- `designSystemMigration` is currently unapproved and does not render.
- Case-study frontmatter lists metric IDs, so a case study cannot cite a number the registry does not know.
