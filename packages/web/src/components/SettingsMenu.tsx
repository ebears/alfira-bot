import { GearIcon, XCircleIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import SettingsContent from './SettingsContent';

interface SettingsMenuProps {
  collapsed?: boolean;
  onClose?: () => void;
}

export default function SettingsMenu({ collapsed = false, onClose }: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Settings button in sidebar */}
      <div className={collapsed ? 'flex justify-center px-2 pb-2' : 'px-3 pb-2'}>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          title={collapsed ? 'Settings' : undefined}
          className={
            collapsed
              ? 'w-7 h-7 flex items-center justify-center rounded text-muted hover:text-fg hover:bg-elevated transition-colors duration-150'
              : 'w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-body font-medium text-muted hover:text-fg hover:bg-elevated transition-colors duration-150'
          }
        >
          <GearIcon size={16} weight="duotone" />
          {!collapsed && <span>Settings</span>}
        </button>
      </div>

      {/* Settings panel overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          {/* Backdrop */}
          <button
            type="button"
            className="absolute inset-0 bg-base/80 backdrop-blur-sm cursor-default"
            onClick={() => setIsOpen(false)}
            aria-label="Close settings"
          />

          {/* Panel */}
          <div className="relative w-full max-w-md bg-surface border border-border rounded-t-lg sm:rounded-lg shadow-2xl animate-fade-up max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <h2 className="font-display text-2xl text-fg tracking-wide">Settings</h2>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onClose?.();
                }}
                className="w-11 h-11 flex items-center justify-center rounded-lg text-muted hover:text-fg hover:bg-elevated transition-colors duration-150"
              >
                <XCircleIcon size={20} weight="duotone" />
              </button>
            </div>

            {/* Content */}
            <div className="px-5 py-4 overflow-y-auto flex-1">
              <SettingsContent />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
