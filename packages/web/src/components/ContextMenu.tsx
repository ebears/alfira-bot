import { CaretLeftIcon, DotsThreeOutlineVerticalIcon } from '@phosphor-icons/react';
import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// --- Types ---

export interface SubmenuItem {
  id: string;
  label: string;
  disabled?: boolean;
  icon?: ReactNode;
}

export interface SubmenuConfig {
  title: string;
  items: SubmenuItem[];
  onSelect: (id: string) => void;
  emptyMessage?: string;
}

export interface MenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  submenu?: SubmenuConfig;
}

interface ContextMenuProps {
  items: MenuItem[];
  isOpen: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
  align?: 'left' | 'right';
}

// --- Trigger ---

export function ContextMenuTrigger({
  onOpen,
  isOpen,
  ref,
  className,
}: {
  onOpen: () => void;
  isOpen: boolean;
  ref: RefObject<HTMLButtonElement | null>;
  className?: string;
}) {
  return (
    <button
      ref={ref}
      type="button"
      aria-haspopup="true"
      aria-expanded={isOpen}
      title="More actions"
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
      className={`
        flex items-center justify-center
        w-11 h-11 md:w-8 md:h-8
        text-muted hover:text-fg active:bg-elevated
        border border-border hover:border-accent/30 rounded-xl
        transition-colors duration-150
        opacity-100 md:opacity-0 md:group-hover:opacity-100
        ${isOpen ? '!opacity-100' : ''}
        ${className ?? ''}
      `}
    >
      <DotsThreeOutlineVerticalIcon size={18} weight="duotone" className="md:w-4 md:h-4" />
    </button>
  );
}

// --- Menu ---

export function ContextMenu({
  items,
  isOpen,
  onClose,
  triggerRef,
  align = 'right',
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [activeSubmenu, setActiveSubmenu] = useState<SubmenuConfig | null>(null);
  const [submenuParentIndex, setSubmenuParentIndex] = useState(0);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const currentItems = activeSubmenu
    ? activeSubmenu.items.map((item) => ({
        id: item.id,
        label: item.label,
        icon: item.icon,
        disabled: item.disabled,
      }))
    : items;

  // Position calculation
  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const menuWidth = 192; // min-w-48 = 12rem = 192px
      const menuHeight = menuRef.current?.offsetHeight ?? 200;

      let top = rect.bottom + 4;
      let left = align === 'right' ? rect.right - menuWidth : rect.left;

      // Clamp to viewport
      if (top + menuHeight > window.innerHeight - 8) {
        top = rect.top - menuHeight - 4;
      }
      if (left < 8) left = 8;
      if (left + menuWidth > window.innerWidth - 8) {
        left = window.innerWidth - menuWidth - 8;
      }

      setPosition({ top, left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, triggerRef, align]);

  // Reset submenu and focus when opening
  useEffect(() => {
    if (isOpen) {
      setActiveSubmenu(null);
      setFocusedIndex(0);
    }
  }, [isOpen]);

  // Focus first item on open
  useEffect(() => {
    if (isOpen && menuRef.current) {
      const firstItem = menuRef.current.querySelector(
        '[role="menuitem"]:not([disabled])'
      ) as HTMLElement | null;
      firstItem?.focus();
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return;
      }
      onClose();
    };

    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [isOpen, onClose, triggerRef]);

  // Close on Escape (or go back from submenu)
  useEffect(() => {
    if (!isOpen) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (activeSubmenu) {
          setActiveSubmenu(null);
          setFocusedIndex(submenuParentIndex);
        } else {
          onClose();
          triggerRef.current?.focus();
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose, triggerRef, activeSubmenu, submenuParentIndex]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const enabledIndices = currentItems
        .map((item, i) => (!item.disabled ? i : -1))
        .filter((i) => i >= 0);
      if (enabledIndices.length === 0) return;

      const findNextEnabled = (current: number, direction: 1 | -1): number => {
        const pos = enabledIndices.indexOf(current);
        if (pos === -1) return enabledIndices[0];
        const nextPos = (pos + direction + enabledIndices.length) % enabledIndices.length;
        return enabledIndices[nextPos];
      };

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => findNextEnabled(prev, 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => findNextEnabled(prev, -1));
      } else if (e.key === 'Tab') {
        onClose();
        triggerRef.current?.focus();
      }
    },
    [currentItems, onClose, triggerRef]
  );

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Song actions"
      style={{ position: 'fixed', top: position.top, left: position.left }}
      className="z-50 min-w-48"
      onKeyDown={handleKeyDown}
    >
      <div className="bg-elevated border border-border rounded-xl shadow-xl overflow-hidden animate-fade-up">
        {activeSubmenu ? (
          <SubmenuPanel
            config={activeSubmenu}
            onBack={() => {
              setActiveSubmenu(null);
              setFocusedIndex(submenuParentIndex);
            }}
            onSelect={(id) => {
              activeSubmenu.onSelect(id);
              onClose();
            }}
          />
        ) : (
          items.map((item) => (
            <MenuItemButton
              key={item.id}
              item={item}
              onClick={() => {
                if (item.submenu) {
                  setActiveSubmenu(item.submenu);
                  setSubmenuParentIndex(focusedIndex);
                  setFocusedIndex(0);
                } else {
                  item.onClick?.();
                  onClose();
                }
              }}
            />
          ))
        )}
      </div>
    </div>,
    document.body
  );
}

// --- Sub-components ---

function MenuItemButton({
  item,
  onClick,
}: {
  item: {
    id: string;
    label: string;
    icon?: ReactNode;
    danger?: boolean;
    disabled?: boolean;
    submenu?: SubmenuConfig;
  };
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      disabled={item.disabled}
      onClick={onClick}
      className={`
        w-full text-left px-3 py-2.5 text-sm font-mono
        flex items-center gap-2
        transition-colors duration-100
        disabled:opacity-50 disabled:cursor-not-allowed
        ${item.danger ? 'text-danger hover:bg-danger/10' : 'text-fg hover:bg-border/50'}
      `}
    >
      {item.icon && <span className="shrink-0">{item.icon}</span>}
      <span className="truncate">{item.label}</span>
      {item.submenu && <span className="ml-auto text-muted">›</span>}
    </button>
  );
}

function SubmenuPanel({
  config,
  onBack,
  onSelect,
}: {
  config: SubmenuConfig;
  onBack: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="animate-fade-up">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <button
          type="button"
          aria-label="Back to main menu"
          onClick={onBack}
          className="text-muted hover:text-fg p-1 rounded transition-colors"
        >
          <CaretLeftIcon size={14} weight="duotone" />
        </button>
        <span className="font-mono text-xs text-muted truncate">{config.title}</span>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {config.items.length === 0 ? (
          <p className="px-3 py-2 text-xs font-mono text-muted">
            {config.emptyMessage ?? 'no items'}
          </p>
        ) : (
          config.items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={item.disabled}
              onClick={() => onSelect(item.id)}
              className="w-full text-left px-3 py-2.5 text-sm font-mono text-fg hover:bg-border/50 transition-colors duration-100 disabled:opacity-50 flex items-center gap-2"
            >
              {item.icon && <span className="shrink-0">{item.icon}</span>}
              <span className="truncate">{item.label}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
