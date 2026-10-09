import { describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';
import { collections } from '@/content.config';
import { renderOgImage } from '@/lib/og';
import { getPosts } from '@/lib/writing';
import { GET as llms } from '@/pages/llms.txt';
import { getStaticPaths, GET as og } from '@/pages/og/[slug].png';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];
const context = (props: Record<string, unknown> = {}) => ({ props }) as unknown as APIContext;

describe('social images', () => {
  it('renders a 1200×630 PNG with and without a headline metric', async () => {
    const withMetric = await renderOgImage({
      eyebrow: 'Case study',
      title: 'Short',
      metric: '15.5 s → 14 ms',
      metricLabel: 'plot',
    });
    const long = await renderOgImage({
      eyebrow: 'Résumé',
      title: 'A much longer title that has to wrap onto a second line of text',
    });
    const unlabeled = await renderOgImage({ eyebrow: 'Case study', title: 'No label', metric: '74 KB' });
    for (const png of [withMetric, long, unlabeled]) {
      expect([...png.slice(0, 4)]).toEqual(PNG_SIGNATURE);
      const view = new DataView(png.buffer, png.byteOffset);
      expect([view.getUint32(16), view.getUint32(20)]).toEqual([1200, 630]);
    }
  });

  it('has one image per page, and serves each as image/png', async () => {
    const paths = await getStaticPaths();
    const slugs = paths.map((p) => p.params.slug);
    expect(slugs).toEqual(expect.arrayContaining(['home', 'resume', 'work-graph-performance']));
    const response = await og(context(paths[0]!.props));
    expect(response.headers.get('Content-Type')).toBe('image/png');
  }, 30_000);
});

describe('writing', () => {
  it('includes drafts in development and leaves them out of builds', async () => {
    const dev = await getPosts();
    expect(dev.length).toBeGreaterThan(0);
    expect(dev[0]!.data.published.getTime()).toBeGreaterThanOrEqual(dev.at(-1)!.data.published.getTime());
    vi.stubEnv('DEV', false);
    expect((await getPosts()).filter((p) => p.data.draft)).toEqual([]);
    vi.unstubAllEnvs();
  });
});

describe('llms.txt', () => {
  it('summarizes the profile and links every case study', async () => {
    const response = await llms(context());
    const text = await response.text();
    expect(response.headers.get('Content-Type')).toContain('text/plain');
    expect(text).toMatch(/^# Subham Raj/);
    expect(text).toContain('https://subhamraj.dev/work/graph-performance');
    expect(text).toContain('Experience at TRM Labs');
  });
});

describe('content schemas', () => {
  const work = collections.work.schema as unknown as { safeParse(v: unknown): { success: boolean } };
  const writing = collections.writing.schema as unknown as {
    safeParse(v: unknown): { success: boolean; data?: { draft: boolean } };
  };
  const experience = collections.experience.schema as unknown as {
    safeParse(v: unknown): { success: boolean };
  };

  it('accepts valid case studies and rejects unknown metrics', () => {
    const study = {
      title: 't',
      summary: 's',
      company: 'c',
      period: 'p',
      role: 'r',
      stack: ['React'],
      order: 1,
      published: '2026-10-04',
      updated: '2026-10-04',
    };
    expect(work.safeParse({ ...study, metrics: ['plotMatching'] }).success).toBe(true);
    expect(work.safeParse({ ...study, metrics: ['madeUp'] }).success).toBe(false);
  });

  it('makes posts drafts by default and enforces description length', () => {
    const post = {
      title: 't',
      description: 'd'.repeat(100),
      published: '2026-10-04',
      updated: '2026-10-04',
      tags: ['a11y'],
    };
    expect(writing.safeParse(post).data?.draft).toBe(true);
    expect(writing.safeParse({ ...post, description: 'too short' }).success).toBe(false);
  });

  it('validates experience dates', () => {
    const role = {
      id: 'x',
      company: 'c',
      role: 'r',
      location: 'l',
      start: '2023-11',
      end: '2026',
      summary: 's',
      highlights: ['h'],
    };
    expect(experience.safeParse(role).success).toBe(true);
    expect(experience.safeParse({ ...role, start: 'Nov 2023' }).success).toBe(false);
  });
});
