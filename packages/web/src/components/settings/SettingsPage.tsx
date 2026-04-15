import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { XIcon } from '@phosphor-icons/react';
import { Button } from '../ui/Button';
import AppearanceTab from './AppearanceTab';
import ServerTab from './ServerTab';
import SettingsTabs from './SettingsTabs';
import TagsTab from './TagsTab';

export default function SettingsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('appearance');

  const renderTab = () => {
    switch (activeTab) {
      case 'appearance':
        return <AppearanceTab />;
      case 'server':
        return <ServerTab />;
      case 'tags':
        return <TagsTab />;
      default:
        return <AppearanceTab />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <h1 className="font-display text-3xl text-fg tracking-wide">Settings</h1>
        <Button
          variant="inherit"
          size="icon"
          surface="base"
          onClick={() => navigate(-1)}
          aria-label="Close settings"
        >
          <XIcon size={20} weight="duotone" />
        </Button>
      </div>

      {/* Tabs */}
      <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {renderTab()}
      </div>
    </div>
  );
}
