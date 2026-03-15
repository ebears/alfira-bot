import { useCallback } from 'react';
import { addToPriorityQueue } from '../api/api';
import { apiErrorMessage } from '../utils/api';
import type { NotifyFn } from './useNotification';

export function useAddToQueue(notify: NotifyFn) {
  return useCallback(
    async (songId: string) => {
      try {
        await addToPriorityQueue(songId);
        notify('Added to Up Next', 'success');
      } catch (err: unknown) {
        notify(
          apiErrorMessage(err, 'Could not add to queue. Is the bot in a voice channel?'),
          'error',
          5000
        );
      }
    },
    [notify]
  );
}
