import { getCollection } from 'astro:content';

/** Published posts, newest first. Drafts are included only in `astro dev`, never in a build. */
export async function getPosts() {
  const posts = await getCollection('writing', ({ data }) => import.meta.env.DEV || !data.draft);
  return posts.sort((a, b) => b.data.published.getTime() - a.data.published.getTime());
}
