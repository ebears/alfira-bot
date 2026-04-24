import { useAuth } from '../../context/AuthContext';

interface TabItem {
  id: string;
  label: string;
  adminOnly?: boolean;
}

const TABS: TabItem[] = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'audio', label: 'Audio', adminOnly: true },
  { id: 'tags', label: 'Tag Editor', adminOnly: true },
];

interface SettingsTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function SettingsTabs({ activeTab, onTabChange }: SettingsTabsProps) {
  const { user } = useAuth();

  const visibleTabs = TABS.filter((tab) => !tab.adminOnly || user?.isAdmin);

  return (
    <div role="tablist" className="flex border-b border-border">
      {visibleTabs.map((tab) => (
        <button
          type="button"
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-2.5 font-body text-sm transition-colors duration-150 cursor-pointer border-b-2 -mb-px ${
            activeTab === tab.id
              ? 'text-accent border-accent'
              : 'text-muted border-transparent hover:text-fg'
          }`}
        >
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
