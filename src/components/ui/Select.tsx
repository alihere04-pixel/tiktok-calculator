'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface SelectOption {
  value: string;
  label: string;
  /** Optional grouping key rendered as a disabled listbox group header. */
  group?: string;
  description?: string;
}

export interface SelectProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  helperText?: ReactNode;
  hideLabel?: boolean;
  required?: boolean;
  disabled?: boolean;
  searchable?: boolean;
  id?: string;
  className?: string;
}

/**
 * Searchable single-select following the ARIA 1.2 combobox pattern.
 *
 * A native <select> cannot be searchable, and the category list reaches 78
 * entries for US, so filtering is required. Keyboard support: ArrowUp/Down to
 * move the active option, Home/End to jump, Enter to commit, Escape to revert
 * and close, Tab to close without selecting.
 */
export function Select({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select an option',
  error,
  helperText,
  hideLabel = false,
  required,
  disabled,
  searchable = true,
  id,
  className,
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const listboxId = `${selectId}-listbox`;
  const errorId = `${selectId}-error`;
  const helperId = `${selectId}-helper`;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const describedBy = [error ? errorId : null, helperText ? helperId : null].filter(Boolean).join(' ');

  const selected = useMemo(() => options.find((o) => o.value === value) ?? null, [options, value]);

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(trimmed) ||
        (o.group ?? '').toLowerCase().includes(trimmed) ||
        (o.description ?? '').toLowerCase().includes(trimmed)
    );
  }, [options, query]);

  // Group the filtered results while preserving order.
  const groups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, SelectOption[]>();
    for (const option of filtered) {
      const key = option.group ?? '';
      if (!map.has(key)) {
        map.set(key, []);
        order.push(key);
      }
      map.get(key)!.push(option);
    }
    return order.map((key) => ({ key, options: map.get(key)! }));
  }, [filtered]);

  // Flattened view of what is actually rendered, so arrow keys traverse the
  // same sequence the user sees.
  const visibleOptions = useMemo(() => groups.flatMap((g) => g.options), [groups]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActiveIndex(-1);
  }, []);

  const commit = useCallback(
    (option: SelectOption) => {
      onChange(option.value);
      close();
    },
    [onChange, close]
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, close]);

  // Keep the highlighted option scrolled into view during keyboard traversal.
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    document.getElementById(`${selectId}-option-${activeIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex, selectId]);

  const move = (delta: number) => {
    if (visibleOptions.length === 0) return;
    setActiveIndex((prev) => {
      const next = prev + delta;
      if (next < 0) return 0;
      if (next >= visibleOptions.length) return visibleOptions.length - 1;
      return next;
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        setOpen(true);
        setActiveIndex(visibleOptions.length > 0 ? 0 : -1);
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(visibleOptions.length - 1);
        break;
      case 'Enter':
        event.preventDefault();
        if (activeIndex >= 0 && visibleOptions[activeIndex]) {
          commit(visibleOptions[activeIndex]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        close();
        // Combobox convention: dismissing returns focus to the control itself
        // rather than letting it fall to the document body.
        inputRef.current?.focus();
        break;
      case 'Tab':
        close();
        break;
    }
  };

  const activeId = activeIndex >= 0 ? `${selectId}-option-${activeIndex}` : undefined;

  return (
    <div className={cn('w-full', className)} ref={containerRef}>
      <label
        htmlFor={selectId}
        className={cn('mb-1.5 block text-sm font-medium text-zinc-900 dark:text-zinc-100', hideLabel && 'sr-only')}
      >
        {label}
        {required ? (
          <span className="ml-0.5 text-red-600 dark:text-red-400" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      <div className="relative">
        <div className="relative flex items-center">
          <input
            id={selectId}
            ref={inputRef}
            type="text"
            role="combobox"
            autoComplete="off"
            disabled={disabled}
            required={required}
            value={open ? query : (selected?.label ?? '')}
            placeholder={placeholder}
            aria-expanded={open}
            aria-controls={listboxId}
            aria-haspopup="listbox"
            aria-autocomplete={searchable ? 'list' : 'none'}
            aria-activedescendant={activeId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy || undefined}
            onFocus={() => {
              if (!disabled) {
                setOpen(true);
                setActiveIndex(selected ? Math.max(visibleOptions.indexOf(selected), 0) : 0);
              }
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              if (!open) setOpen(true);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
            className={cn(
              'w-full rounded-lg border bg-white py-2 pl-3 pr-9 text-base text-zinc-900 transition-colors',
              'placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-offset-1',
              'disabled:cursor-not-allowed disabled:bg-zinc-50',
              'dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:disabled:bg-zinc-800/50',
              error
                ? 'border-red-500 focus:ring-red-500 dark:border-red-500'
                : 'border-zinc-300 focus:border-zinc-900 focus:ring-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-50 dark:focus:ring-zinc-50'
            )}
          />

          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute right-3 text-zinc-400 transition-transform',
              open && 'rotate-180'
            )}
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </div>

        {open ? (
          <ul
            id={listboxId}
            role="listbox"
            aria-label={label}
            className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          >
            {visibleOptions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">No matches</li>
            ) : (
              groups.map((group) => (
                <li key={group.key || '__ungrouped__'} role="presentation">
                  {group.key ? (
                    <div
                      role="presentation"
                      className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
                    >
                      {group.key}
                    </div>
                  ) : null}
                  <ul role="group" aria-label={group.key || undefined} className="list-none">
                    {group.options.map((option) => {
                      const index = visibleOptions.indexOf(option);
                      const isSelected = option.value === value;
                      const isActive = index === activeIndex;
                      return (
                        <li
                          key={option.value}
                          id={`${selectId}-option-${index}`}
                          role="option"
                          aria-selected={isSelected}
                          onMouseDown={(event) => {
                            // mousedown, not click: the blur that a click causes
                            // would close the list before the click lands.
                            event.preventDefault();
                            commit(option);
                          }}
                          onMouseEnter={() => setActiveIndex(index)}
                          className={cn(
                            'cursor-pointer px-3 py-2 text-sm',
                            isActive ? 'bg-zinc-100 dark:bg-zinc-800' : '',
                            isSelected ? 'font-semibold text-zinc-900 dark:text-zinc-50' : 'text-zinc-700 dark:text-zinc-200'
                          )}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate">{option.label}</span>
                            {isSelected ? (
                              <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path
                                  fillRule="evenodd"
                                  d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.79 6.8-6.79a1 1 0 0 1 1.4 0Z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            ) : null}
                          </span>
                          {option.description ? (
                            <span className="mt-0.5 block truncate text-xs text-zinc-500 dark:text-zinc-400">
                              {option.description}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>

      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {helperText ? (
        <p id={helperId} className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
