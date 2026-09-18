import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X, Check } from 'lucide-react';

export interface SearchableOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  disabled?: boolean;
}

export interface SearchableSelectProps {
  id?: string;
  options: (SearchableOption | string)[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  menuWidth?: number | 'match-trigger';
  clearable?: boolean;
  onClear?: () => void;
  emptyText?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  id,
  options,
  value,
  onChange,
  placeholder = 'เลือก...',
  searchPlaceholder = 'พิมพ์ค้นหา...',
  disabled = false,
  required = false,
  className = '',
  menuWidth = 'match-trigger',
  clearable = false,
  onClear,
  emptyText = 'ไม่พบข้อมูลที่ตรงกับการค้นหา',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Normalize options to SearchableOption format
  const normalizedOptions: SearchableOption[] = useMemo(() => {
    return options.map((opt) => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt };
      }
      return opt;
    });
  }, [options]);

  // Current selected option label
  const selectedOption = useMemo(() => {
    return normalizedOptions.find((opt) => opt.value === value) || null;
  }, [normalizedOptions, value]);

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) {
      return normalizedOptions;
    }
    const q = searchQuery.toLowerCase().trim();
    return normalizedOptions.filter((opt) => {
      const labelMatch = opt.label.toLowerCase().includes(q);
      const sublabelMatch = opt.sublabel ? opt.sublabel.toLowerCase().includes(q) : false;
      const valueMatch = opt.value.toLowerCase().includes(q);
      return labelMatch || sublabelMatch || valueMatch;
    });
  }, [normalizedOptions, searchQuery]);

  // Calculate and update position of dropdown menu in viewport
  const updateMenuPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const width =
      menuWidth === 'match-trigger'
        ? Math.max(rect.width, 220)
        : typeof menuWidth === 'number'
        ? menuWidth
        : Math.max(rect.width, 240);

    // Horizontal positioning with edge clamping
    let left = rect.left;
    if (left + width > viewportWidth - 12) {
      left = Math.max(8, viewportWidth - width - 12);
    }

    const spaceBelow = viewportHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;

    const shouldOpenUpwards = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(160, Math.min(320, shouldOpenUpwards ? spaceAbove - 20 : spaceBelow - 20));

    if (shouldOpenUpwards) {
      setMenuStyle({
        position: 'fixed',
        bottom: `${viewportHeight - rect.top + 6}px`,
        left: `${left}px`,
        width: `${width}px`,
        maxHeight: `${maxHeight}px`,
        zIndex: 999999, // Ensure at the very forefront, never obscured by any element
      });
    } else {
      setMenuStyle({
        position: 'fixed',
        top: `${rect.bottom + 6}px`,
        left: `${left}px`,
        width: `${width}px`,
        maxHeight: `${maxHeight}px`,
        zIndex: 999999, // Ensure at the very forefront, never obscured by any element
      });
    }
  }, [menuWidth]);

  // Update position when opened or resized/scrolled
  useEffect(() => {
    if (isOpen) {
      updateMenuPosition();
      setSearchQuery('');
      setHighlightedIndex(-1);

      // Focus search input on open
      const timer = setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 30);

      const handleScroll = () => {
        updateMenuPosition();
      };

      const handleResize = () => {
        updateMenuPosition();
      };

      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isOpen, updateMenuPosition]);

  // Outside click handler
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isOpen]);

  const handleSelectOption = (optValue: string) => {
    onChange(optValue);
    setIsOpen(false);
    setSearchQuery('');
    triggerRef.current?.focus();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClear) {
      onClear();
    } else {
      onChange('');
    }
    setIsOpen(false);
  };

  // Keyboard navigation inside dropdown
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev < filteredOptions.length - 1 ? prev + 1 : 0;
        scrollIndexIntoView(next);
        return next;
      });
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => {
        const next = prev > 0 ? prev - 1 : filteredOptions.length - 1;
        scrollIndexIntoView(next);
        return next;
      });
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        const selected = filteredOptions[highlightedIndex];
        if (!selected.disabled) {
          handleSelectOption(selected.value);
        }
      } else if (filteredOptions.length === 1 && !filteredOptions[0].disabled) {
        handleSelectOption(filteredOptions[0].value);
      }
    }
  };

  const scrollIndexIntoView = (index: number) => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll('[data-option-item]');
    if (items[index]) {
      (items[index] as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className="bg-amber-200 text-amber-950 font-bold px-0.5 rounded-xs">
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </>
    );
  };

  return (
    <div className="relative inline-block w-full text-left" id={id ? `${id}-container` : undefined}>
      {/* Trigger Button */}
      <button
        type="button"
        ref={triggerRef}
        id={id}
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev);
          }
        }}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-800 text-sm shadow-2xs hover:border-indigo-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-left disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed ${
          isOpen ? 'ring-2 ring-indigo-500 border-indigo-500' : ''
        } ${className}`}
      >
        <div className="truncate flex-1">
          {selectedOption ? (
            <span className="font-medium text-slate-800 flex items-center gap-1.5 truncate">
              <span className="truncate">{selectedOption.label}</span>
              {selectedOption.badge && (
                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold shrink-0">
                  {selectedOption.badge}
                </span>
              )}
            </span>
          ) : value ? (
            <span className="font-medium text-slate-800 truncate">{value}</span>
          ) : (
            <span className="text-slate-400 font-normal truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {clearable && value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              className="p-0.5 hover:text-red-500 rounded hover:bg-slate-100 transition-colors"
              title="ล้างค่าที่เลือก"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-500 transition-transform duration-150 ${
              isOpen ? 'rotate-180 text-indigo-600' : ''
            }`}
          />
        </div>
      </button>

      {/* PORTAL DROPDOWN MENU (Mounted directly to body with highest z-index) */}
      {isOpen &&
        createPortal(
          <div
            ref={menuRef}
            style={menuStyle}
            className="flex flex-col bg-white border border-slate-300 rounded-xl shadow-2xl ring-1 ring-black/10 overflow-hidden animate-in fade-in zoom-in-95 duration-100 font-sans"
            onKeyDown={handleKeyDown}
          >
            {/* Search Input Bar (Sticky Top) */}
            <div className="p-2 border-b border-slate-200 bg-slate-50/90 backdrop-blur-xs flex items-center gap-2">
              <Search className="w-4 h-4 text-indigo-500 shrink-0 ml-1" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHighlightedIndex(0);
                }}
                placeholder={searchPlaceholder}
                className="flex-1 bg-transparent border-none text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-0 px-1 py-1 font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Results Count & Subtitle */}
            <div className="px-3 py-1 bg-slate-50 text-[10px] text-slate-500 border-b border-slate-100 flex items-center justify-between font-mono">
              <span>ผลลัพธ์ {filteredOptions.length} รายการ</span>
              {searchQuery && (
                <span className="truncate max-w-[120px] text-slate-400">ค้น: "{searchQuery}"</span>
              )}
            </div>

            {/* Options List */}
            <div
              ref={listRef}
              role="listbox"
              className="overflow-y-auto flex-1 divide-y divide-slate-100 text-xs sm:text-sm max-h-[220px]"
            >
              {filteredOptions.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-xs">
                  <p>{emptyText}</p>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="mt-1.5 text-indigo-600 hover:underline font-semibold"
                    >
                      ล้างคำค้นหา
                    </button>
                  )}
                </div>
              ) : (
                filteredOptions.map((opt, idx) => {
                  const isSelected = opt.value === value;
                  const isHighlighted = idx === highlightedIndex;

                  return (
                    <div
                      key={`${opt.value}-${idx}`}
                      data-option-item
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        if (!opt.disabled) {
                          handleSelectOption(opt.value);
                        }
                      }}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`px-3 py-2 cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                        opt.disabled
                          ? 'opacity-40 cursor-not-allowed bg-slate-50'
                          : isSelected
                          ? 'bg-indigo-50 text-indigo-900 font-semibold'
                          : isHighlighted
                          ? 'bg-slate-100 text-slate-900'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <div className="truncate flex-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="truncate">
                            {highlightMatch(opt.label, searchQuery)}
                          </span>
                          {opt.badge && (
                            <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded font-semibold shrink-0">
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        {opt.sublabel && (
                          <div className="text-[11px] text-slate-400 truncate">
                            {highlightMatch(opt.sublabel, searchQuery)}
                          </div>
                        )}
                      </div>

                      {isSelected && (
                        <Check className="w-4 h-4 text-indigo-600 shrink-0" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
