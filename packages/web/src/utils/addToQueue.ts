import { addToPriorityQueue } from '../api/api';
import type { NotifyFn } from '../hooks/useNotification';
import { apiErrorMessage } from './api';

export function createAddToQueueHandler(notify: NotifyFn) {
  return async (songId: string) => {
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
  };
}
