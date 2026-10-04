import { ChevronDown } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

export type FilterSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export type FilterSelectProps = {
  value: string;
  options: FilterSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  title?: string;
};

type MenuPosition = { left: number; top: number; width: number; maxHeight: number; placement: 'above' | 'below' };
const MENU_GAP = 4;
const VIEWPORT_GUTTER = 8;
const DEFAULT_MENU_MAX_HEIGHT = 17 * 16;

/** Shared controlled select for application filtering surfaces. */
export function FilterSelect({ value, options, onChange, ariaLabel, disabled = false, id, className, title }: FilterSelectProps) {
  const generatedId = useId();
  const controlId = id ?? `sl-filter-select-${generatedId.replace(/:/g, '')}`;
  const listboxId = `${controlId}-listbox`;
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const enabledIndexes = useMemo(() => options.flatMap((option, index) => option.disabled ? [] : [index]), [options]);
  const selectedIndex = options.findIndex(option => option.value === value);
  const displayIndex = selectedIndex >= 0 ? selectedIndex : enabledIndexes[0] ?? -1;
  const initialActiveIndex = selectedIndex >= 0 && !options[selectedIndex]?.disabled ? selectedIndex : enabledIndexes[0] ?? -1;
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(initialActiveIndex);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(initialActiveIndex);
  }, [initialActiveIndex, open]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!root.current?.contains(target) && !menu.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useLayoutEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const updatePosition = () => {
      const rect = trigger.current?.getBoundingClientRect();
      if (!rect) return;
      const viewportWidth = document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight;
      const width = Math.min(rect.width, Math.max(0, viewportWidth - (VIEWPORT_GUTTER * 2)));
      const left = Math.min(Math.max(VIEWPORT_GUTTER, rect.left), Math.max(VIEWPORT_GUTTER, viewportWidth - width - VIEWPORT_GUTTER));
      const below = Math.max(0, viewportHeight - rect.bottom - MENU_GAP - VIEWPORT_GUTTER);
      const above = Math.max(0, rect.top - MENU_GAP - VIEWPORT_GUTTER);
      const naturalHeight = Math.min(menu.current?.scrollHeight ?? DEFAULT_MENU_MAX_HEIGHT, DEFAULT_MENU_MAX_HEIGHT);
      const placement = naturalHeight <= below
        ? 'below' as const
        : naturalHeight <= above
          ? 'above' as const
          : below >= above ? 'below' as const : 'above' as const;
      const availableHeight = placement === 'below' ? below : above;
      const maxHeight = Math.min(DEFAULT_MENU_MAX_HEIGHT, availableHeight);
      const renderedHeight = Math.min(naturalHeight, maxHeight);
      setMenuPosition({ left, top: placement === 'below' ? rect.bottom + MENU_GAP : rect.top - MENU_GAP - renderedHeight, width, maxHeight, placement });
    };
    updatePosition();
    const measurementFrame = window.requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(updatePosition);
    if (trigger.current) observer?.observe(trigger.current);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
      window.cancelAnimationFrame(measurementFrame);
      observer?.disconnect();
    };
  }, [open, options.length]);

  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
    trigger.current?.focus();
  };

  const move = (direction: 1 | -1) => {
    if (!enabledIndexes.length) return;
    const currentPosition = enabledIndexes.indexOf(activeIndex);
    const nextPosition = currentPosition < 0
      ? direction === 1 ? 0 : enabledIndexes.length - 1
      : (currentPosition + direction + enabledIndexes.length) % enabledIndexes.length;
    setActiveIndex(enabledIndexes[nextPosition]);
  };

  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.key === 'Escape') {
      if (!open) return;
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) setOpen(true);
      else move(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (open && event.key === 'Home') {
      event.preventDefault();
      if (enabledIndexes.length) setActiveIndex(enabledIndexes[0]);
      return;
    }
    if (open && event.key === 'End') {
      event.preventDefault();
      if (enabledIndexes.length) setActiveIndex(enabledIndexes[enabledIndexes.length - 1]);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (open) choose(activeIndex);
      else setOpen(true);
    }
  };

  const rootClassName = ['sl-filter-select', className].filter(Boolean).join(' ');
  const selected = displayIndex >= 0 ? options[displayIndex] : undefined;
  const portalHost = typeof document === 'undefined' ? null : root.current?.closest<HTMLElement>('.sl-app') ?? document.body;

  const listbox = open && menuPosition && portalHost ? createPortal(
    <div
      id={listboxId}
      ref={menu}
      className="sl-filter-select-menu"
      role="listbox"
      aria-label={`${ariaLabel} options`}
      data-placement={menuPosition.placement}
      style={{ left: menuPosition.left, top: menuPosition.top, width: menuPosition.width, maxHeight: menuPosition.maxHeight }}
      onKeyDown={keyDown}
    >
      {options.map((option, index) => <button
        id={`${controlId}-option-${index}`}
        className="sl-filter-select-option"
        type="button"
        role="option"
        aria-selected={option.value === value}
        aria-disabled={option.disabled || undefined}
        disabled={option.disabled}
        data-active={index === activeIndex}
        title={option.label}
        key={option.value}
        onMouseEnter={() => { if (!option.disabled) setActiveIndex(index); }}
        onClick={() => choose(index)}
      >{option.label}</button>)}
    </div>,
    portalHost,
  ) : null;

  return <div className={rootClassName} ref={root} onKeyDown={keyDown}>
    <button
      id={controlId}
      ref={trigger}
      type="button"
      role="combobox"
      className="sl-filter-select-trigger"
      aria-label={ariaLabel}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={listboxId}
      aria-activedescendant={open && activeIndex >= 0 ? `${controlId}-option-${activeIndex}` : undefined}
      disabled={disabled}
      title={title}
      onClick={() => setOpen(current => !current)}
    >
      <span title={selected?.label}>{selected?.label ?? ''}</span>
      <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
    </button>
    {listbox}
  </div>;
}
