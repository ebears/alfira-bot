import type { Playlist } from '@alfira-bot/shared';
import { CaretRightIcon, GhostIcon, PlaylistIcon, PlusCircleIcon } from '@phosphor-icons/react';
import type React from 'react';

interface PlaylistRowProps {
  playlist: Playlist;
  style?: React.CSSProperties;
  onClick: () => void;
  onAddToQueue: (e: React.MouseEvent) => void;
}

export const PlaylistRow = ({ playlist, style, onClick, onAddToQueue }: PlaylistRowProps) => {
  const count = playlist._count?.songs ?? 0;
  return (
    <div
      className="flex items-center gap-3 md:gap-4 px-4 md:px-5 py-3.5 md:py-4 cursor-pointer group animate-fade-up opacity-0 bg-elevated rounded-xl clay-resting hover:clay-raised active:clay-flat transition-all duration-100"
      style={style}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
    >
      {/* Icon */}
      <div className="w-11 h-11 md:w-10 md:h-10 rounded-xl bg-accent/10 border border-accent/20 shrink-0 flex items-center justify-center">
        <PlaylistIcon size={18} weight="duotone" className="text-accent md:w-4 md:h-4" />
      </div>
      {/* Add to queue button */}
      <button
        type="button"
        onClick={onAddToQueue}
        className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-fg/5"
        title="Add to queue"
      >
        <PlusCircleIcon size={20} weight="duotone" />
      </button>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-body font-semibold text-fg group-hover:text-accent transition-colors duration-150">
            {playlist.name}
          </p>
          {playlist.isPrivate && (
            <span className="text-muted" title="Private playlist">
              <GhostIcon size={14} weight="duotone" />
            </span>
          )}
        </div>
        <p className="font-mono text-xs text-muted mt-0.5">
          {count} {count === 1 ? 'song' : 'songs'}
        </p>
      </div>
      {/* Arrow */}
      <CaretRightIcon
        size={18}
        weight="duotone"
        className="text-faint group-hover:text-muted transition-colors duration-150 md:w-4 md:h-4"
      />
    </div>
  );
};

PlaylistRow.displayName = 'PlaylistRow';

export default PlaylistRow;
