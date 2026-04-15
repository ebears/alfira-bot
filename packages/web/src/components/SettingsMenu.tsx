import { WrenchIcon, XCircleIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { Backdrop } from './Backdrop';
import SettingsContent from './settings/AppearanceTab';
import { Button } from './ui/Button';

interface SettingsMenuProps {
  collapsed?: boolean;
}

export default function SettingsMenu({ collapsed = false }: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Settings button in sidebar */}
      <div className={collapsed ? 'flex justify-center px-2 pb-2' : 'px-3 pb-2'}>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          title={collapsed ? 'Settings' : undefined}
          className={`flex items-center rounded-xl font-body transition-all duration-150 cursor-pointer w-full ${
            collapsed ? 'justify-center px-0 py-2' : 'px-3 py-2'
          } ${isOpen ? 'btn-inherit pressed' : 'btn-inherit'}`}
          style={{ '--btn-surface': 'var(--color-elevated)' } as React.CSSProperties}
        >
          {!collapsed && <span className="mr-auto">Settings</span>}
          <WrenchIcon size={18} weight="duotone" />
        </button>
      </div>

      {/* Settings panel overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <Backdrop onClose={() => setIsOpen(false)}>
            {/* Panel */}
            <div className="relative w-full max-w-md bg-base rounded-t-lg sm:rounded-lg modal-clay animate-fade-up max-h-[85vh] overflow-hidden flex flex-col cursor-default">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                <h2 className="font-display text-2xl text-fg tracking-wide">Settings</h2>
                <Button
                  variant="inherit"
                  size="icon"
                  surface="base"
                  onClick={() => {
                    setIsOpen(false);
                  }}
                >
                  <XCircleIcon size={20} weight="duotone" />
                </Button>
              </div>

              {/* Content */}
              <div className="px-5 py-4 overflow-y-auto flex-1">
                <SettingsContent />
              </div>
            </div>
          </Backdrop>
        </div>
      )}
    </>
  );
}
