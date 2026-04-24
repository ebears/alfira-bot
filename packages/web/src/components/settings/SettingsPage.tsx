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
      case 'audio':
        return <ServerTab />;
      case 'tags':
        return <TagsTab />;
      default:
        return <AppearanceTab />;
    }
  };

  return (
    <div className="p-4 md:p-8">
      {/* Page header */}
      <div className="mb-6 md:mb-8">
        <h1 className="font-display text-3xl md:text-4xl text-fg tracking-wider">Settings</h1>
      </div>

      {/* Tabs */}
      <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab content */}
      <div className="mt-6">{renderTab()}</div>
    </div>
  );
}
