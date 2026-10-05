import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { site } from '@/data/site';

/** A plain-text summary for AI search tools (llmstxt.org), generated from the same data as the pages. */
export const GET: APIRoute = async () => {
  const studies = (await getCollection('work')).sort((a, b) => a.data.order - b.data.order);
  const roles = (await getCollection('experience')).sort((a, b) => b.data.start.localeCompare(a.data.start));
  const url = (path: string) => new URL(path, site.url).href;

  const body = `# ${site.name}

> ${site.description} ${site.availability}. Previously at ${roles.map((r) => r.data.company).join(', ')}.

The homepage is a working demo: visitors can break six parts of the site and watch each fix, with every number measured live in their browser. Production results come from his work at TRM Labs.

## Case studies

${studies.map((s) => `- [${s.data.title}](${url(`/work/${s.id}`)}): ${s.data.summary}`).join('\n')}

## Profile

- [Résumé](${url('/resume')}) ([PDF](${url(site.links.resumePdf)}))
- [LinkedIn](${site.links.linkedin})
- [GitHub](${site.links.github})
- Email: ${site.email}
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
