import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface MenuItem {
  id: string;
  label: string;
  /** Set for single-choice items (rendered as menuitemradio). */
  checked?: boolean;
  onSelect: () => void;
}

interface MenuProps {
  label: ReactNode;
  /** Accessible name when the visible label is an icon. */
  ariaLabel?: string;
  items: readonly MenuItem[];
  align?: 'start' | 'end';
}

/**
 * WAI-ARIA menu button: Enter, Space or ArrowDown opens and focuses an item, arrows/Home/End move,
 * Escape closes and returns focus to the button, Tab closes and moves on.
 */
export default function Menu({ label, ariaLabel, items, align = 'start' }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    if (open) itemRefs.current[active]?.focus();
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const openAt = (index: number) => {
    setActive(index);
    setOpen(true);
  };

  const close = (returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  };

  const select = (item: MenuItem) => {
    close(true);
    item.onSelect();
  };

  const startIndex = () =>
    Math.max(
      0,
      items.findIndex((item) => item.checked),
    );

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openAt(event.key === 'ArrowUp' ? items.length - 1 : startIndex());
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const last = items.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: active === last ? 0 : active + 1,
      ArrowUp: active === 0 ? last : active - 1,
      Home: 0,
      End: last,
    };
    if (event.key in moves) {
      event.preventDefault();
      setActive(moves[event.key]!);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
    } else if (event.key === 'Tab') {
      close(false);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      select(items[active]!);
    }
  };

  return (
    <div className={`menu menu--${align}`} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="a11y-demo__ctl"
        data-interactive
        id={`${id}-button`}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? `${id}-menu` : undefined}
        onClick={() => (open ? close(false) : openAt(startIndex()))}
        onKeyDown={onButtonKeyDown}
      >
        {label}
      </button>
      {open && (
        <ul
          className="menu__list"
          role="menu"
          id={`${id}-menu`}
          aria-labelledby={`${id}-button`}
          onKeyDown={onMenuKeyDown}
        >
          {items.map((item, index) => (
            <li
              key={item.id}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
              aria-checked={item.checked}
              tabIndex={-1}
              className="menu__item"
              onClick={() => select(item)}
              onPointerMove={() => setActive(index)}
            >
              <span className="menu__check" aria-hidden="true">
                {item.checked ? '✓' : ''}
              </span>
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
