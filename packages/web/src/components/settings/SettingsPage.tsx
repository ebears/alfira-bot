import { useState } from 'react';
import AppearanceTab from './AppearanceTab';
import ServerTab from './ServerTab';
import SettingsTabs from './SettingsTabs';
import TagsTab from './TagsTab';

export default function SettingsPage() {
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
      <div className="px-6 pt-6 pb-4 shrink-0">
        <h1 className="font-display text-3xl md:text-4xl text-fg tracking-wider">Settings</h1>
      </div>

      {/* Tabs */}
      <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">{renderTab()}</div>
    </div>
  );
}
