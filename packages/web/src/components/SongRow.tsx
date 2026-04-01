import type { Song } from '@alfira-bot/shared';
import { formatDuration } from '@alfira-bot/shared';
import { CircleNotchIcon, PlayIcon } from '@phosphor-icons/react';
import { memo } from 'react';
import { useSongActions } from '../hooks/useSongActions';
import { ContextMenu, ContextMenuTrigger } from './ContextMenu';
import { Button } from './ui/Button';

interface SongRowProps {
  song: Song;
  isAdmin: boolean;
  // When provided, the context menu shows "Remove" (playlist detail context)
  onRemove?: () => void;
  removeLabel?: string;
  onPlay: () => void;
  isPlaying?: boolean;
  onAddToQueue: () => void;
}

export const SongRow = memo(
  ({ song, isAdmin, onRemove, removeLabel, onPlay, isPlaying, onAddToQueue }: SongRowProps) => {
    const { menuOpen, setMenuOpen, triggerRef, menuItems } = useSongActions({
      song,
      isAdmin,
      playlists: [],
      onAddToQueue,
      onRemove,
      removeLabel,
    });

    return (
      <div className="flex items-center gap-2 md:gap-4 px-3 md:px-4 py-3 rounded-lg group bg-elevated clay-resting hover:clay-raised transition-all duration-100">
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
          onClick={onPlay}
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
  }
);

SongRow.displayName = 'SongRow';

export default SongRow;
