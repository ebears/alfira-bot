import { useNotification } from './useNotification';
import { addToPriorityQueue } from '../api/api';
import { apiErrorMessage } from '../utils/api';

export function useAddToQueue() {
  const { notification, notify } = useNotification();

  const handleAddToQueue = async (songId: string) => {
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

  return { handleAddToQueue, notification };
}
