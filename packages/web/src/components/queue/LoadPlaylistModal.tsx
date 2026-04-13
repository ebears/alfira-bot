import type { Playlist } from '@alfira-bot/server/shared';
import { PlayCircleIcon } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { getPlaylists, startPlayback } from '../../api/api';
import { apiErrorMessage } from '../../utils/api';
import { Backdrop } from '../Backdrop';
import { Button } from '../ui/Button';

export default function LoadPlaylistModal({
  onClose,
  onLoaded,
}: {
  onClose: () => void;
  onLoaded: () => void;
}) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loadingPlaylists, setLoadingPlaylists] = useState(true);
  const [selectedId, setSelectedId] = useState<string | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadPlaylists = useCallback(async () => {
    try {
      const data = await getPlaylists();
      setPlaylists(data);
      if (data.length > 0) setSelectedId(data[0].id);
    } finally {
      setLoadingPlaylists(false);
    }
  }, []);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  const handlePlay = async () => {
    if (!selectedId) return;
    setSubmitting(true);
    setError('');
    try {
      await startPlayback({
        playlistId: selectedId,
        mode: 'sequential',
        loop: 'off',
      });
      onLoaded();
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Could not start playback. Is the bot in a voice channel?'));
      setSubmitting(false);
    }
  };

  return (
    <Backdrop onClose={onClose}>
      <div className="p-5 md:p-6 w-full max-w-sm mx-4 modal-clay animate-fade-up">
        <h2 className="font-display text-2xl md:text-3xl text-fg tracking-wider mb-1">
          Load Playlist
        </h2>
        <p className="font-mono text-xs text-muted mb-4 md:mb-6">choose a playlist to queue</p>

        {loadingPlaylists ? (
          <div className="space-y-2 mb-6">
            <div className="skeleton h-9 w-full rounded" />
          </div>
        ) : playlists.length === 0 ? (
          <p className="font-mono text-xs text-muted mb-6">
            No playlists found. Create one in the Playlists section first.
          </p>
        ) : (
          <div className="mb-6">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="input w-full"
            >
              {playlists.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.name} {pl._count ? ` (${pl._count.songs} songs)` : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="font-mono text-xs text-danger mb-4">{error}</p>}

        <div className="flex gap-2 justify-end">
          <Button
            variant="inherit"
            type="button"
            onClick={onClose}
            disabled={submitting}
            surface="surface"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            type="button"
            onClick={handlePlay}
            disabled={submitting || !selectedId || loadingPlaylists}
          >
            {submitting ? (
              'Starting...'
            ) : (
              <>
                <PlayCircleIcon size={12} weight="duotone" className="inline mr-1" />
                Play
              </>
            )}
          </Button>
        </div>
      </div>
    </Backdrop>
  );
}
