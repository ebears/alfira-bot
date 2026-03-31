import type { Playlist, Song } from '@alfira-bot/shared';
import { formatDuration } from '@alfira-bot/shared';
import { CircleNotchIcon, PlayIcon } from '@phosphor-icons/react';
import type React from 'react';
import { useSongActions } from '../hooks/useSongActions';
import { ContextMenu, ContextMenuTrigger } from './ContextMenu';
import { Button } from './ui/Button';

interface SongCardProps {
  song: Song;
  isAdmin: boolean;
  playlists: Playlist[];
  style?: React.CSSProperties;
  onDelete: (id: string) => void;
  onPlay: (id: string) => void;
  isPlaying: boolean;
  onAddToQueue: (id: string) => void;
}

export const SongCard = ({
  song,
  isAdmin,
  playlists,
  style,
  onDelete,
  onPlay,
  isPlaying,
  onAddToQueue,
}: SongCardProps) => {
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
    <div
      className="group animate-fade-up opacity-0 flex flex-col bg-elevated rounded-xl clay-resting hover:clay-raised transition-all duration-100"
      style={style}
    >
      {/* Thumbnail with play overlay */}
      <div className="relative aspect-video bg-elevated overflow-hidden rounded-xl clay-flat m-3 mb-0">
        <img
          src={song.thumbnailUrl}
          alt={song.nickname || song.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />

        {/* Duration badge — bottom right */}
        <span className="absolute bottom-2 right-2 z-20 font-mono text-[10px] text-white/80 bg-black/50 px-1.5 py-0.5 rounded">
          {formatDuration(song.duration)}
        </span>

        {menuOpen && (
          <ContextMenu
            items={menuItems}
            isOpen={menuOpen}
            onClose={() => setMenuOpen(false)}
            triggerRef={triggerRef}
          />
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-body font-semibold text-sm text-fg leading-tight line-clamp-2 min-w-0">
            {song.nickname || song.title}
          </p>
          <div className="flex items-center gap-1 shrink-0 ml-auto">
            <Button
              variant="primary"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                handlePlay();
              }}
              disabled={isPlaying}
              className="shrink-0 disabled:cursor-default"
              title="Play from this song"
            >
              {isPlaying ? (
                <CircleNotchIcon size={18} weight="bold" className="animate-spin" />
              ) : (
                <PlayIcon size={18} weight="duotone" />
              )}
            </Button>
            <ContextMenuTrigger
              ref={triggerRef}
              onOpen={() => setMenuOpen(true)}
              isOpen={menuOpen}
            />
          </div>
        </div>
        {song.nickname && (
          <p className="text-[11px] text-faint truncate opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {song.title}
          </p>
        )}
      </div>
    </div>
  );
};

SongCard.displayName = 'SongCard';

export default SongCard;
