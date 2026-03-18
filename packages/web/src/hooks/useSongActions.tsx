import type { Playlist, Song } from '@alfira-bot/shared';
import {
  ArrowSquareOutIcon,
  BombIcon,
  CassetteTapeIcon,
  PencilSimpleIcon,
  UserIcon,
  VinylRecordIcon,
} from '@phosphor-icons/react';
import { useRef, useState } from 'react';
import { addSongToPlaylist } from '../api/api';
import type { MenuItem } from '../components/ContextMenu';
import { useNicknameEditor } from './useNicknameEditor';

interface UseSongActionsOptions {
  song: Song;
  isAdmin: boolean;
  playlists: Playlist[];
  onAddToQueue: () => void;
  onDelete: () => void;
}

export function useSongActions({
  song,
  isAdmin,
  playlists,
  onAddToQueue,
  onDelete,
}: UseSongActionsOptions) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [addedTo, setAddedTo] = useState<Set<string>>(new Set());
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { editValue, setEditValue, savingNickname, cancelEdit, saveNickname } = useNicknameEditor(
    song.id,
    song.nickname
  );

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
    {
      id: 'user-info',
      label: '',
      icon: <UserIcon size={14} weight="duotone" />,
      info: {
        label: song.addedByDisplayName || song.addedBy || '',
        icon: <UserIcon size={14} weight="duotone" />,
      },
    },
    ...(isAdmin
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
