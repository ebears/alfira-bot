import { WarningIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { overridePlay } from '../../api/api';
import { apiErrorMessage } from '../../utils/api';
import { Backdrop } from '../Backdrop';
import { Button } from '../ui/Button';

export default function OverrideModal({
  onClose,
  onOverride,
}: {
  onClose: () => void;
  onOverride: () => void;
}) {
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!youtubeUrl.trim()) return;
    setSubmitting(true);
    setError('');
    try {
      await overridePlay(youtubeUrl.trim());
      onOverride();
    } catch (err: unknown) {
      setError(apiErrorMessage(err, 'Could not override playback. Is the bot in a voice channel?'));
      setSubmitting(false);
    }
  };

  return (
    <Backdrop onClose={onClose}>
      <div className="p-5 md:p-6 w-full max-w-sm mx-4 modal-clay animate-fade-up">
        <h2 className="font-display text-2xl md:text-3xl text-fg tracking-wider mb-1">Override</h2>
        <p className="font-mono text-xs text-danger mb-4 md:mb-6">
          <WarningIcon size={14} weight="duotone" className="inline mr-1" /> This will stop current
          playback, clear all queues, and play the requested song immediately.
        </p>

        <div className="space-y-4 mb-6">
          <div>
            <p className="font-mono text-xs text-muted mb-2 uppercase tracking-widest">
              YouTube URL
            </p>
            <input
              type="text"
              value={youtubeUrl}
              onChange={(e) => {
                setYoutubeUrl(e.target.value);
                setError('');
              }}
              placeholder="https://youtube.com/watch?v=..."
              className="input w-full"
              disabled={submitting}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && youtubeUrl.trim()) {
                  handleSubmit();
                }
              }}
            />
          </div>
        </div>

        {error && <p className="font-mono text-xs text-danger mb-4">{error}</p>}

        {submitting && (
          <p className="font-mono text-xs text-muted mb-4 flex items-center gap-2">
            <span className="w-3 h-3 border border-accent border-t-transparent rounded-full animate-spin inline-block" />
            Overriding...
          </p>
        )}

        <div className="flex gap-2 justify-end">
          <Button variant="foreground" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="danger"
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !youtubeUrl.trim()}
          >
            {submitting ? 'Overriding...' : 'Override & Play'}
          </Button>
        </div>
      </div>
    </Backdrop>
  );
}
