// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  applyTheme,
  nextThemePreference,
  readThemePreference,
  saveThemePreference,
  THEME_STORAGE_KEY,
} from '@/lib/theme';

const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
};

describe('theme preference', () => {
  it('defaults to system and ignores unknown stored values', () => {
    const storage = memoryStorage();
    expect(readThemePreference(storage)).toBe('system');
    storage.setItem(THEME_STORAGE_KEY, 'sepia');
    expect(readThemePreference(storage)).toBe('system');
  });

  it('stores explicit choices and clears the key for system', () => {
    const storage = memoryStorage();
    saveThemePreference('dark', storage);
    expect(readThemePreference(storage)).toBe('dark');
    saveThemePreference('system', storage);
    expect(storage.data.has(THEME_STORAGE_KEY)).toBe(false);
  });

  it('survives storage that throws', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readThemePreference(blocked)).toBe('system');
    expect(() => saveThemePreference('light', blocked)).not.toThrow();
  });

  it('pins light or dark on <html> and removes the pin for system', () => {
    const root = document.createElement('html');
    applyTheme('dark', root);
    expect(root.dataset.theme).toBe('dark');
    applyTheme('system', root);
    expect(root.dataset.theme).toBeUndefined();
  });

  it('cycles system → light → dark → system', () => {
    expect(nextThemePreference('system')).toBe('light');
    expect(nextThemePreference('light')).toBe('dark');
    expect(nextThemePreference('dark')).toBe('system');
  });
});
