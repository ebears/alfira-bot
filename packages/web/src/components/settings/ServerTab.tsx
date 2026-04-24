import { useAuth } from '../../context/AuthContext';
import CompressorSection from './CompressorSection';
import EqualizerSection from './EqualizerSection';

export default function ServerTab() {
  const { user } = useAuth();

  return (
    <div className="space-y-2">
      {user?.isAdmin && <EqualizerSection />}
      {user?.isAdmin && <CompressorSection />}
    </div>
  );
}
