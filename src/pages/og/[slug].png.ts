import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { renderOgImage, type OgCard } from '@/lib/og';
import { requireMetric } from '@/lib/metrics';
import { getPosts } from '@/lib/writing';

export const getStaticPaths = (async () => {
  const studies = await getCollection('work');
  const posts = await getPosts();
  const cards: { slug: string; card: OgCard }[] = [
    {
      slug: 'home',
      card: {
        eyebrow: 'Senior Frontend Engineer',
        title: 'I make broken interfaces fast, accessible and global.',
        metric: requireMetric('plotMatching').value,
        metricLabel: 'graph plot matching, 1,600 elements',
      },
    },
    { slug: 'resume', card: { eyebrow: 'Résumé', title: 'Subham Raj, Senior Frontend Engineer' } },
    ...studies.map((study) => {
      const headline = study.data.metrics.map((id) => requireMetric(id))[0];
      return {
        slug: `work-${study.id}`,
        card: {
          eyebrow: `Case study · ${study.data.company}`,
          title: study.data.title,
          metric: headline?.value,
          metricLabel: headline?.label,
        },
      };
    }),
    ...posts.map((post) => ({
      slug: `writing-${post.id}`,
      card: { eyebrow: `Writing · ${post.data.tags.join(' · ')}`, title: post.data.title },
    })),
  ];
  return cards.map(({ slug, card }) => ({ params: { slug }, props: { card } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const png = await renderOgImage((props as { card: OgCard }).card);
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
