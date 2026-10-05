import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';

/**
 * Vitest globalSetup. Vitest loads Astro in dev mode, which reads collections from `.astro/data-store.json`,
 * but `astro sync` writes the store to the cache directory. Without this, a fresh checkout sees empty
 * collections. Runs in a child process because Astro's sync forces NODE_ENV=production.
 */
export default function globalSetup() {
  execFileSync('npx', ['astro', 'sync'], { stdio: 'ignore' });
  mkdirSync('.astro', { recursive: true });
  copyFileSync('node_modules/.astro/data-store.json', '.astro/data-store.json');
}
