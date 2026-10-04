import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { metrics, type MetricId } from './data/metrics';

const metricIds = Object.keys(metrics) as [MetricId, ...MetricId[]];

const work = defineCollection({
  loader: glob({ base: './src/content/work', pattern: '**/*.mdx' }),
  schema: z.object({
    title: z.string(),
    summary: z.string().max(220),
    company: z.string(),
    period: z.string(),
    role: z.string(),
    stack: z.array(z.string()).min(1),
    /** Headline numbers; must exist in src/data/metrics.ts and are checked for approval at render time. */
    metrics: z.array(z.enum(metricIds)).default([]),
    order: z.number().int(),
  }),
});

const experience = defineCollection({
  loader: file('src/data/experience.json'),
  schema: z.object({
    id: z.string(),
    company: z.string(),
    role: z.string(),
    location: z.string(),
    start: z.string().regex(/^\d{4}(-\d{2})?$/),
    end: z.string().regex(/^\d{4}(-\d{2})?$/),
    summary: z.string(),
    highlights: z.array(z.string()).min(1),
  }),
});

export const collections = { work, experience };
