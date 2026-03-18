import type { Playlist, Song } from '@alfira-bot/shared';
import {
  ArrowSquareOutIcon,
  BombIcon,
  CassetteTapeIcon,
  PencilSimpleIcon,
  UserIcon,
  VinylRecordIcon,
} from '@phosphor-icons/react';
import { useCallback, useRef, useState } from 'react';
import { addSongToPlaylist, updateSongNickname } from '../api/api';
import type { MenuItem } from '../components/ContextMenu';

interface UseSongActionsOptions {
  song: Song;
  isAdmin: boolean;
  playlists: Playlist[];
  onAddToQueue: () => void;
  onDelete?: () => void;
  onRemove?: () => void;
  removeLabel?: string;
}

export function useSongActions({
  song,
  isAdmin,
  playlists,
  onAddToQueue,
  onDelete,
  onRemove,
  removeLabel,
}: UseSongActionsOptions) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [addedTo, setAddedTo] = useState<Set<string>>(new Set());
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Nickname editor state (inlined from useNicknameEditor)
  const [editValue, setEditValue] = useState('');
  const [savingNickname, setSavingNickname] = useState(false);

  const cancelEdit = useCallback(() => {
    setEditValue('');
  }, []);

  const saveNickname = useCallback(async () => {
    setSavingNickname(true);
    try {
      await updateSongNickname(song.id, editValue.trim() || null);
    } finally {
      setSavingNickname(false);
    }
  }, [song.id, editValue]);

  const handleAddToPlaylist = async (playlistId: string) => {
    try {
      await addSongToPlaylist(playlistId, song.id);
      setAddedTo((prev) => new Set([...prev, playlistId]));
    } catch {
      setAddedTo((prev) => new Set([...prev, playlistId]));
    }
  };

  const menuItems: MenuItem[] = [
    {
      id: 'add-to-queue',
      label: 'Add to Up Next',
      icon: <VinylRecordIcon size={14} weight="duotone" />,
      onClick: onAddToQueue,
    },
    {
      id: 'open-link',
      label: 'Open Link',
      icon: <ArrowSquareOutIcon size={14} weight="duotone" />,
      onClick: () => window.open(song.youtubeUrl, '_blank'),
    },
    // Playlist remove action (when onRemove is provided, skip full admin submenu)
    ...(onRemove
      ? [
          {
            id: 'remove',
            label: removeLabel || 'Remove',
            icon: <BombIcon size={14} weight="duotone" />,
            danger: true,
            onClick: onRemove,
          } as MenuItem,
        ]
      : []),
    // Full admin submenu (when onDelete is provided, library context)
    ...(onDelete && !onRemove
      ? [
          {
            id: 'user-info',
            label: '',
            icon: <UserIcon size={14} weight="duotone" />,
            info: {
              label: song.addedByDisplayName || song.addedBy || '',
              icon: <UserIcon size={14} weight="duotone" />,
            },
          },
        ]
      : []),
    ...(isAdmin && onDelete && !onRemove
      ? [
          {
            id: 'add-to-playlist',
            label: 'Add to playlist',
            icon: <CassetteTapeIcon size={14} weight="duotone" />,
            submenu: {
              title: 'Add to playlist',
              items: playlists.map((pl) => ({
                id: pl.id,
                label: pl.name,
                disabled: addedTo.has(pl.id),
              })),
              onSelect: handleAddToPlaylist,
              emptyMessage: 'no playlists yet',
            },
          } as MenuItem,
          {
            id: 'edit-nickname',
            label: 'Rename',
            icon: <PencilSimpleIcon size={14} weight="duotone" />,
            editSubmenu: {
              title: 'Rename',
              value: editValue,
              onChange: setEditValue,
              onSave: saveNickname,
              onCancel: cancelEdit,
              saving: savingNickname,
              placeholder: 'Nickname (empty to clear)',
            },
          } as MenuItem,
          {
            id: 'delete',
            label: 'Delete song',
            icon: <BombIcon size={14} weight="duotone" />,
            danger: true,
            onClick: onDelete,
          } as MenuItem,
        ]
      : []),
  ];

  return { menuOpen, setMenuOpen, triggerRef, menuItems };
}
