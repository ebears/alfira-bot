import { useAuth } from '../../context/AuthContext';
import styles from './SettingsTabs.module.css';

interface TabItem {
  id: string;
  label: string;
  icon?: React.ComponentType<{ size?: number; weight?: 'duotone' | 'fill' | 'light' | 'regular' | 'bold' }>;
  adminOnly?: boolean;
}

const TABS: TabItem[] = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'server', label: 'Server', adminOnly: true },
  { id: 'tags', label: 'Tags', adminOnly: true },
];

interface SettingsTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function SettingsTabs({ activeTab, onTabChange }: SettingsTabsProps) {
  const { user } = useAuth();

  const visibleTabs = TABS.filter((tab) => !tab.adminOnly || user?.isAdmin);

  return (
    <div className={styles.tabList} role="tablist">
      {visibleTabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            type="button"
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {Icon && <Icon size={16} weight="duotone" />}
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}