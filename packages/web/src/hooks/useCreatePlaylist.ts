import { useActionState } from 'react';
import { createPlaylist } from '../api/api';

async function createPlaylistAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ error: string | null }> {
  const name = formData.get('name') as string;
  if (!name?.trim()) {
    return { error: 'Playlist name is required' };
  }
  try {
    await createPlaylist(name.trim());
    return { error: null };
  } catch {
    return { error: 'Could not create playlist. Try again.' };
  }
}

export function useCreatePlaylist() {
  return useActionState(createPlaylistAction, null);
}
