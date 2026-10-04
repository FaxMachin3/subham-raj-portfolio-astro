import { describe, expect, it } from 'vitest';
import { I18N_KEYS } from '@/i18n/keys.gen';
import en from '@/i18n/en.json';

const locales = import.meta.glob<Record<string, string>>('../../src/i18n/*.json', {
  eager: true,
  import: 'default',
});

describe('translations', () => {
  it('generates keys from en.json', () => {
    expect([...I18N_KEYS].sort()).toEqual(Object.keys(en).sort());
  });

  it.each(Object.entries(locales))('%s has every key, no extras and no empty strings', (_, dict) => {
    expect(Object.keys(dict).sort()).toEqual([...I18N_KEYS].sort());
    for (const value of Object.values(dict)) expect(value.trim()).not.toBe('');
  });

  it('ships six languages', () => {
    expect(Object.keys(locales)).toHaveLength(6);
  });
});
