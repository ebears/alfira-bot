import type { Playlist, Song } from '@alfira-bot/shared';
import { formatDuration } from '@alfira-bot/shared';
import { CircleNotchIcon, PlayIcon } from '@phosphor-icons/react';
import { memo, useCallback } from 'react';
import { useSongEdit } from '../context/SongEditContext';
import { useSongActions } from '../hooks/useSongActions';
import { ContextMenu, ContextMenuTrigger } from './ContextMenu';
import SongEditPanel from './SongEditPanel';
import { Button } from './ui/Button';

interface LibrarySongRowProps {
  song: Song;
  isAdmin: boolean;
  playlists: Playlist[];
  onDelete: (id: string) => void;
  onPlay: (id: string) => void;
  isPlaying: boolean;
  onAddToQueue: (id: string) => void;
}

export const LibrarySongRow = memo(
  ({
    song,
    isAdmin,
    playlists,
    onDelete,
    onPlay,
    isPlaying,
    onAddToQueue,
  }: LibrarySongRowProps) => {
    const { openSongId, setOpenSongId } = useSongEdit();
    const isOpen = openSongId === song.id;
    const handleDelete = useCallback(() => onDelete(song.id), [onDelete, song.id]);
    const handlePlay = useCallback(() => onPlay(song.id), [onPlay, song.id]);
    const handleAddToQueue = useCallback(() => onAddToQueue(song.id), [onAddToQueue, song.id]);

    const { menuOpen, setMenuOpen, triggerRef, menuItems } = useSongActions({
      song,
      isAdmin,
      playlists,
      onAddToQueue: handleAddToQueue,
      onDelete: handleDelete,
    });

    return (
      <div className="flex flex-col rounded-lg bg-elevated clay-resting" data-song-edit-container>
        <div
          className="flex items-center gap-2 md:gap-4 px-3 md:px-4 py-3"
          onClick={() => isAdmin && setOpenSongId(isOpen ? null : song.id)}
          style={isAdmin ? { cursor: 'pointer' } : undefined}
        >
          <img
            src={song.thumbnailUrl}
            alt={song.nickname || song.title}
            className="w-20 h-12 md:w-16 md:h-10 object-cover rounded border border-border shrink-0"
            loading="lazy"
            decoding="async"
          />
          <div className="flex-1 min-w-0">
            <p className="font-body text-sm font-medium text-fg truncate">
              {song.nickname || song.title}
            </p>
            {song.nickname && (
              <p className="font-mono text-[10px] text-muted truncate">{song.title}</p>
            )}
          </div>
          <span className="font-mono text-xs text-muted shrink-0">
            {formatDuration(song.duration)}
          </span>
          <Button
            variant="primary"
            size="icon"
            onClick={handlePlay}
            disabled={isPlaying}
            className="p-2.5 md:p-1 disabled:opacity-50 disabled:cursor-default"
            title="Play from this song"
          >
            {isPlaying ? (
              <CircleNotchIcon size={18} weight="bold" className="animate-spin" />
            ) : (
              <PlayIcon size={18} weight="duotone" />
            )}
          </Button>
          <ContextMenuTrigger ref={triggerRef} onOpen={() => setMenuOpen(true)} isOpen={menuOpen} />
          {menuOpen && (
            <ContextMenu
              items={menuItems}
              isOpen={menuOpen}
              onClose={() => setMenuOpen(false)}
              triggerRef={triggerRef}
            />
          )}
        </div>

        {/* Inline edit panel */}
        <div className={`expand-panel ${isOpen ? 'expanded' : ''}`}>
          <SongEditPanel song={song} isOpen={isOpen} onClose={() => setOpenSongId(null)} />
        </div>
      </div>
    );
  }
);

LibrarySongRow.displayName = 'LibrarySongRow';

export default LibrarySongRow;
