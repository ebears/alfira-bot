import { useAuth } from '../../context/AuthContext';
import CompressorSection from './CompressorSection';
import EqualizerSection from './EqualizerSection';

export default function ServerTab() {
  const { user } = useAuth();

  return (
    <div className="space-y-2">
      <h3 className="font-mono text-[11px] text-muted uppercase tracking-wider">Audio Settings</h3>
      {user?.isAdmin && <CompressorSection />}
      {user?.isAdmin && <EqualizerSection />}
    </div>
  );
}
