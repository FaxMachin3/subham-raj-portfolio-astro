import { describe, expect, it } from 'vitest';
import { articleGraph, personNode, profilePageGraph, resumeGraph, SITE_UPDATED } from '@/lib/seo';

const PERSON = { '@id': 'https://subhamraj.dev/#person' };
const byType = (graph: Record<string, unknown>[], type: string) => graph.find((n) => n['@type'] === type);

describe('structured data', () => {
  it('describes one Person, with profiles and skills, and never a misspelled name', () => {
    const person = personNode();
    expect(person).toMatchObject({ ...PERSON, name: 'Subham Raj', givenName: 'Subham', familyName: 'Raj' });
    expect(person.sameAs).toEqual(expect.arrayContaining([expect.stringContaining('linkedin.com')]));
    expect((person.knowsAbout as string[]).length).toBeGreaterThan(5);
    expect(JSON.stringify(person)).not.toMatch(/shubham/i);
  });

  it('marks the homepage up as a ProfilePage about that Person', () => {
    const graph = profilePageGraph();
    expect(byType(graph, 'ProfilePage')).toMatchObject({ mainEntity: PERSON, dateModified: SITE_UPDATED });
    expect(byType(graph, 'WebSite')).toMatchObject({ publisher: PERSON });
  });

  it('marks articles up with dates, author, image and breadcrumbs', () => {
    const graph = articleGraph({
      path: '/work/graph-performance',
      title: 'A title',
      description: 'A description',
      published: new Date('2026-10-04'),
      updated: new Date('2026-10-05'),
      keywords: ['React', 'TypeScript'],
      section: 'Case studies',
      image: '/og/work-graph-performance.png',
    });
    expect(byType(graph, 'TechArticle')).toMatchObject({
      url: 'https://subhamraj.dev/work/graph-performance',
      datePublished: '2026-10-04',
      dateModified: '2026-10-05',
      author: PERSON,
      image: 'https://subhamraj.dev/og/work-graph-performance.png',
      keywords: 'React, TypeScript',
    });
    const crumbs = byType(graph, 'BreadcrumbList') as { itemListElement: { item: string }[] };
    expect(crumbs.itemListElement.map((c) => c.item)).toEqual([
      'https://subhamraj.dev/',
      'https://subhamraj.dev/#work',
      'https://subhamraj.dev/work/graph-performance',
    ]);
  });

  it('marks the résumé up as a ProfilePage with breadcrumbs', () => {
    const graph = resumeGraph();
    expect(byType(graph, 'ProfilePage')).toMatchObject({
      url: 'https://subhamraj.dev/resume',
      mainEntity: PERSON,
    });
    expect(byType(graph, 'BreadcrumbList')).toBeTruthy();
  });
});
