// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { enhanceMobileNav } from '@/lib/mobile-nav';

describe('phone menu', () => {
  let menu: HTMLDetailsElement;

  beforeEach(() => {
    document.body.innerHTML = `
      <details><summary>Menu</summary><nav><a href="/#work"><span>Work</span></a><p>text</p></nav></details>
      <main>outside</main>`;
    menu = document.querySelector('details')!;
    enhanceMobileNav(menu);
  });

  const press = (key: string) => document.dispatchEvent(new KeyboardEvent('keydown', { key }));
  const pointerDown = (target: Element) => target.dispatchEvent(new Event('pointerdown', { bubbles: true }));

  it('closes when a link is chosen, but not on other clicks inside it', () => {
    menu.open = true;
    menu.querySelector('p')!.click();
    expect(menu.open).toBe(true);
    menu.querySelector('span')!.click();
    expect(menu.open).toBe(false);
  });

  it('closes on Escape and returns focus to "Menu"; other keys, or Escape while closed, do nothing', () => {
    press('Escape');
    expect(document.activeElement).not.toBe(menu.querySelector('summary'));
    menu.open = true;
    press('Enter');
    expect(menu.open).toBe(true);
    press('Escape');
    expect(menu.open).toBe(false);
    expect(document.activeElement).toBe(menu.querySelector('summary'));
  });

  it('closes on a tap outside it, not inside it', () => {
    pointerDown(document.querySelector('main')!);
    menu.open = true;
    pointerDown(menu.querySelector('p')!);
    expect(menu.open).toBe(true);
    pointerDown(document.querySelector('main')!);
    expect(menu.open).toBe(false);
  });
});
