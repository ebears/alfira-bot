import { useAdminView } from '../../context/AdminViewContext';
import { useAuth } from '../../context/AuthContext';
import SettingsToggle from './SettingsToggle';

export default function ServerTab() {
  const { user } = useAuth();
  const { isAdminView, toggleAdminView } = useAdminView();

  return (
    <div className="space-y-2">
      <h3 className="font-mono text-[11px] text-muted uppercase tracking-wider">Server Settings</h3>
      {user?.isAdmin && (
        <div className="space-y-2">
          <SettingsToggle
            label="Admin Mode"
            description="Enable administrative features and controls"
            checked={isAdminView}
            onChange={toggleAdminView}
          />
        </div>
      )}
      <p className="text-sm text-muted">Coming soon.</p>
    </div>
  );
}
