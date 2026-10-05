// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Menu from '@/components/islands/Menu';

afterEach(cleanup);

function setup() {
  const picks: string[] = [];
  const items = ['One', 'Two', 'Three'].map((label) => ({
    id: label,
    label,
    checked: label === 'Two',
    onSelect: () => picks.push(label),
  }));
  render(
    <div>
      <Menu label="Filter" items={items} />
      <p>outside</p>
    </div>,
  );
  return { picks, button: screen.getByRole('button', { name: 'Filter' }) };
}

const item = (name: string) => screen.getByRole('menuitemradio', { name });

describe('Menu', () => {
  it('opens on click at the checked item and closes on a second click', () => {
    const { button } = setup();
    fireEvent.click(button);
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(item('Two'));
    fireEvent.click(button);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('ArrowUp opens on the last item; arrows wrap; Home and End jump', () => {
    const { button } = setup();
    fireEvent.keyDown(button, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(item('Three'));
    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(item('One'));
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(item('Three'));
    fireEvent.keyDown(menu, { key: 'Home' });
    expect(document.activeElement).toBe(item('One'));
    fireEvent.keyDown(menu, { key: 'End' });
    expect(document.activeElement).toBe(item('Three'));
  });

  it('selects with Enter or Space and returns focus to the button', () => {
    const { button, picks } = setup();
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('menu'), { key: ' ' });
    expect(picks).toEqual(['Two']);
    expect(document.activeElement).toBe(button);
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Enter' });
    expect(picks).toEqual(['Two', 'Two']);
  });

  it('Escape closes and refocuses the button; Tab closes and moves on; other keys do nothing', () => {
    const { button } = setup();
    fireEvent.keyDown(button, { key: 'x' });
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'q' });
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(button);
    fireEvent.keyDown(button, { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Tab' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('works with a pointer: hover moves the active item, click selects, clicking outside closes', () => {
    const { button, picks } = setup();
    fireEvent.click(button);
    fireEvent.pointerMove(item('Three'));
    expect(document.activeElement).toBe(item('Three'));
    fireEvent.click(item('Three'));
    expect(picks).toEqual(['Three']);
    fireEvent.click(button);
    fireEvent.pointerDown(item('One'));
    expect(screen.getByRole('menu')).toBeTruthy();
    fireEvent.pointerDown(screen.getByText('outside'));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('uses menuitem for actions and accepts an icon label', () => {
    const onSelect = vi.fn();
    render(
      <Menu
        label="⋯"
        ariaLabel="More actions"
        align="end"
        items={[{ id: 'copy', label: 'Copy', onSelect }]}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy' }));
    expect(onSelect).toHaveBeenCalled();
  });
});
