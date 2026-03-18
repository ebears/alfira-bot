import { useCallback, useState } from 'react';
import { updateSongNickname } from '../api/api';

export function useNicknameEditor(songId: string, _initialNickname: string | null | undefined) {
  const [editValue, setEditValue] = useState('');
  const [savingNickname, setSavingNickname] = useState(false);

  const cancelEdit = useCallback(() => {
    setEditValue('');
  }, []);

  const saveNickname = useCallback(async () => {
    setSavingNickname(true);
    try {
      await updateSongNickname(songId, editValue.trim() || null);
    } finally {
      setSavingNickname(false);
    }
  }, [songId, editValue]);

  return { editValue, setEditValue, savingNickname, cancelEdit, saveNickname };
}
