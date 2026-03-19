import { PlayCircleIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { apiErrorMessage } from '../utils/api';
import { Backdrop } from './Backdrop';
import { Button } from './ui/Button';

export default function PlayModal({
  onClose,
  onPlay,
}: {
  onClose: () => void;
  onPlay: (mode: 'sequential' | 'random') => void;
}) {
  const [mode, setMode] = useState<'sequential' | 'random'>('sequential');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePlay = async () => {
    setLoading(true);
    setError('');
    try {
      await onPlay(mode);
      onClose();
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Could not start playback. Is the bot in a voice channel?'));
      setLoading(false);
    }
  };

  return (
    <Backdrop onClose={onClose}>
      <div className="bg-surface rounded-xl p-5 md:p-6 w-full max-w-sm mx-4 modal-clay animate-fade-up">
        <h2 className="font-display text-2xl md:text-3xl text-fg tracking-wider mb-1">
          Play Playlist
        </h2>
        <p className="font-mono text-xs text-muted mb-6">configure playback</p>

        <div className="mb-6">
          <p className="font-mono text-xs text-muted mb-2 uppercase tracking-widest">Order</p>
          <div className="flex gap-2">
            {(['sequential', 'random'] as const).map((m) => (
              <Button
                variant="foreground"
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 text-xs font-mono ${
                  mode === m ? 'bg-accent/10 border-accent/40 text-accent' : ''
                }`}
              >
                {m}
              </Button>
            ))}
          </div>
        </div>

        {error && <p className="font-mono text-xs text-danger mb-4">{error}</p>}

        <div className="flex gap-2 justify-end">
          <Button variant="foreground" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handlePlay} disabled={loading}>
            {loading ? (
              'Starting...'
            ) : (
              <>
                {' '}
                <PlayCircleIcon size={12} weight="duotone" className="inline mr-1" /> Play{' '}
              </>
            )}
          </Button>
        </div>
      </div>
    </Backdrop>
  );
}
