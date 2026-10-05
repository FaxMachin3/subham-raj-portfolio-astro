import { describe, expect, it } from 'vitest';
import { cleanPath } from '@/lib/url';

describe('cleanPath', () => {
  it.each([
    ['/', '/'],
    ['/index.html', '/'],
    ['/resume.html', '/resume'],
    ['/resume/', '/resume'],
    ['/work/graph-performance.html', '/work/graph-performance'],
    ['/work/graph-performance', '/work/graph-performance'],
  ])('%s → %s', (input, output) => expect(cleanPath(input)).toBe(output));
});

describe('cleanPath edge cases', () => {
  it('treats an empty path as the root', () => expect(cleanPath('')).toBe('/'));
});
