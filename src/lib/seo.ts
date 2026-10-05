import { site, skills } from '@/data/site';
import updated from '@/data/updated.json';

/**
 * Schema.org JSON-LD. Every page emits one @graph that references the same Person by @id, so search
 * engines connect the homepage, case studies and résumé to one entity.
 */
type Node = Record<string, unknown>;

export const SITE_UPDATED = updated.site;
const PERSON_ID = `${site.url}/#person`;
const WEBSITE_ID = `${site.url}/#website`;

export function personNode(): Node {
  return {
    '@type': 'Person',
    '@id': PERSON_ID,
    name: site.name,
    givenName: 'Subham',
    familyName: 'Raj',
    jobTitle: site.role,
    description: site.description,
    url: site.url,
    image: `${site.url}/icon-512.png`,
    email: `mailto:${site.email}`,
    address: { '@type': 'PostalAddress', addressLocality: 'Bengaluru', addressCountry: 'IN' },
    alumniOf: { '@type': 'CollegeOrUniversity', name: 'ITER, SOA University' },
    sameAs: [site.links.linkedin, site.links.github],
    knowsAbout: [
      'Frontend engineering',
      'Web performance',
      'Web accessibility (WCAG)',
      'Design systems',
      'Internationalization',
      ...skills.flatMap((group) => group.items).slice(0, 12),
    ],
  };
}

function websiteNode(): Node {
  return {
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    url: site.url,
    name: site.name,
    inLanguage: 'en',
    publisher: { '@id': PERSON_ID },
  };
}

const breadcrumbs = (items: { name: string; path: string }[]): Node => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: new URL(item.path, site.url).href,
  })),
});

/** Homepage: a ProfilePage whose main entity is the Person (eligible for Google's profile results). */
export function profilePageGraph(): Node[] {
  return [
    {
      '@type': 'ProfilePage',
      '@id': `${site.url}/#profile`,
      url: site.url,
      name: `${site.name} · ${site.role}`,
      dateModified: SITE_UPDATED,
      isPartOf: { '@id': WEBSITE_ID },
      mainEntity: { '@id': PERSON_ID },
    },
    personNode(),
    websiteNode(),
  ];
}

export function articleGraph(article: {
  path: string;
  title: string;
  description: string;
  published: Date;
  updated: Date;
  keywords: readonly string[];
  section: string;
  image: string;
}): Node[] {
  const url = new URL(article.path, site.url).href;
  return [
    {
      '@type': 'TechArticle',
      '@id': `${url}#article`,
      headline: article.title,
      description: article.description,
      url,
      mainEntityOfPage: url,
      image: new URL(article.image, site.url).href,
      datePublished: article.published.toISOString().slice(0, 10),
      dateModified: article.updated.toISOString().slice(0, 10),
      author: { '@id': PERSON_ID },
      publisher: { '@id': PERSON_ID },
      isPartOf: { '@id': WEBSITE_ID },
      keywords: article.keywords.join(', '),
      articleSection: article.section,
      inLanguage: 'en',
    },
    breadcrumbs([
      { name: 'Home', path: '/' },
      { name: article.section, path: '/#work' },
      { name: article.title, path: article.path },
    ]),
    personNode(),
    websiteNode(),
  ];
}

export function resumeGraph(): Node[] {
  return [
    {
      '@type': 'ProfilePage',
      '@id': `${site.url}/resume#page`,
      url: `${site.url}/resume`,
      name: `Résumé · ${site.name}`,
      dateModified: SITE_UPDATED,
      isPartOf: { '@id': WEBSITE_ID },
      mainEntity: { '@id': PERSON_ID },
    },
    breadcrumbs([
      { name: 'Home', path: '/' },
      { name: 'Résumé', path: '/resume' },
    ]),
    personNode(),
    websiteNode(),
  ];
}
