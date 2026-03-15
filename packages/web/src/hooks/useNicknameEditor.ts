import { useCallback, useEffect, useRef, useState } from 'react';
import { updateSongNickname } from '../api/api';

export function useNicknameEditor(songId: string, initialNickname: string | null | undefined) {
  const [editingNickname, setEditingNickname] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [savingNickname, setSavingNickname] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingNickname) editInputRef.current?.focus();
  }, [editingNickname]);

  const startEdit = useCallback(() => {
    setEditValue(initialNickname || '');
    setEditingNickname(true);
  }, [initialNickname]);

  const cancelEdit = useCallback(() => {
    setEditingNickname(false);
    setEditValue('');
  }, []);

  const saveNickname = useCallback(async () => {
    setSavingNickname(true);
    try {
      await updateSongNickname(songId, editValue.trim() || null);
      setEditingNickname(false);
    } finally {
      setSavingNickname(false);
    }
  }, [songId, editValue]);

  return {
    editingNickname,
    editValue,
    setEditValue,
    savingNickname,
    editInputRef,
    startEdit,
    cancelEdit,
    saveNickname,
  };
}
