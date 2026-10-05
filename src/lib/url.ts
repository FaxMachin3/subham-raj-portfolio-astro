/** Public URL for a built page: `/work/x.html` → `/work/x`, `/index.html` → `/`, no trailing slash. */
export function cleanPath(pathname: string): string {
  const path = pathname
    .replace(/\.html$/, '')
    .replace(/\/index$/, '/')
    .replace(/(.)\/$/, '$1');
  return path === '' ? '/' : path;
}
