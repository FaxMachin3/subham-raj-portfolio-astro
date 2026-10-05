// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import updated from './src/data/updated.json' with { type: 'json' };

/** `COVERAGE=1` builds keep inline source maps so browser coverage maps back to src/ (see coverage/). */
const coverage = process.env.COVERAGE === '1';

export default defineConfig({
  site: 'https://subhamraj.dev',
  output: 'static',
  // Clean URLs with no trailing slash (/resume), matching canonical links; Cloudflare Pages serves resume.html there.
  trailingSlash: 'never',
  integrations: [
    react(),
    mdx(),
    sitemap({
      filter: (page) => !page.includes('/og/'),
      serialize: (item) => ({ ...item, lastmod: updated.site }),
    }),
  ],
  build: {
    format: 'file',
    inlineStylesheets: 'auto',
  },
  vite: {
    build: {
      sourcemap: coverage ? 'inline' : false,
      // Minified code maps imprecisely onto source branches; coverage builds stay readable.
      minify: !coverage,
      rollupOptions: {
        onwarn(warning, warn) {
          // Astro's MDX integration emits this internal directive; Rolldown warns about it on every
          // .mdx file. It is upstream noise, filtered so real warnings stay visible.
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && warning.message.includes('astro:head-inject'))
            return;
          warn(warning);
        },
      },
    },
  },
});
