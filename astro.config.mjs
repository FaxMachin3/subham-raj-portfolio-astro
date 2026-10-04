// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://subhamraj.dev',
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [react(), mdx(), sitemap()],
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    build: {
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
