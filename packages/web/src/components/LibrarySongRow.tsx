import type { Playlist, Song } from '@alfira-bot/shared';
import { formatDuration } from '@alfira-bot/shared';
import { CircleNotchIcon, PlayIcon } from '@phosphor-icons/react';
import { useSongActions } from '../hooks/useSongActions';
import { ContextMenu, ContextMenuTrigger } from './ContextMenu';
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

export const LibrarySongRow = ({
  song,
  isAdmin,
  playlists,
  onDelete,
  onPlay,
  isPlaying,
  onAddToQueue,
}: LibrarySongRowProps) => {
  const handleDelete = () => onDelete(song.id);
  const handlePlay = () => onPlay(song.id);
  const handleAddToQueue = () => onAddToQueue(song.id);

  const { menuOpen, setMenuOpen, triggerRef, menuItems } = useSongActions({
    song,
    isAdmin,
    playlists,
    onAddToQueue: handleAddToQueue,
    onDelete: handleDelete,
  });

  return (
    <div className="flex items-center gap-2 md:gap-4 px-3 md:px-4 py-3 rounded-lg group bg-elevated clay-resting hover:clay-raised transition-shadow duration-100">
      <img
        src={song.thumbnailUrl}
        alt={song.nickname || song.title}
        className="w-20 h-12 md:w-16 md:h-10 object-cover rounded border border-border shrink-0"
        loading="lazy"
      />
      <div className="flex-1 min-w-0">
        <p className="font-body text-sm font-medium text-fg truncate">
          {song.nickname || song.title}
        </p>
        {song.nickname && <p className="font-mono text-[10px] text-muted truncate">{song.title}</p>}
      </div>
      <span className="font-mono text-xs text-muted shrink-0">{formatDuration(song.duration)}</span>
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
  );
};

LibrarySongRow.displayName = 'LibrarySongRow';

export default LibrarySongRow;
