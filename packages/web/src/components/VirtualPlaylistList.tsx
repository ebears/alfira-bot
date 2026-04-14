import type { Playlist } from '@alfira-bot/server/shared';
import { useVirtualizer } from '@tanstack/react-virtual';
import { memo, useRef } from 'react';
import PlaylistRow from './PlaylistRow';

interface VirtualPlaylistListProps {
  items: Playlist[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  onRetry: () => void;
  sentinelRef: (el: HTMLDivElement | null) => void;
  onRowClick: (e: React.MouseEvent) => void;
}

const ROW_ESTIMATE = 68;

function SkeletonList() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 4 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton items are static placeholders
        <div key={`skeleton-${i}`} className="card flex items-center gap-4 px-5 py-4">
          <div className="skeleton w-10 h-10 rounded" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-48" />
            <div className="skeleton h-2.5 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

export const VirtualPlaylistList = memo(function VirtualPlaylistList({
  items,
  isLoading,
  isFetching,
  isError,
  onRetry,
  sentinelRef,
  onRowClick,
}: VirtualPlaylistListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 5,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  if (isLoading) {
    return <SkeletonList />;
  }

  if (items.length === 0) {
    return null;
  }

  const totalSize = rowVirtualizer.getTotalSize();
  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div className="relative">
      <div
        ref={parentRef}
        className="overflow-y-auto"
        style={{ height: 'calc(100vh - 300px)' }}
      >
        <div
          style={{
            height: `${totalSize}px`,
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualRow) => {
            const playlist = items[virtualRow.index];
            if (!playlist) return null;

            return (
              <div
                key={playlist.id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <PlaylistRow
                  playlist={playlist}
                  animationDelay="0ms"
                  onClick={onRowClick}
                  data-playlist-id={playlist.id}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Sentinel + loading/error states at bottom */}
      <div ref={sentinelRef}>
        {isError && (
          <div className="flex justify-center py-4">
            <button
              type="button"
              onClick={onRetry}
              className="font-mono text-xs text-muted hover:text-fg transition-colors underline"
            >
              Failed to load more. Retry
            </button>
          </div>
        )}
        {isFetching && !isError && (
          <div className="flex justify-center py-4 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static loading indicator
              <div key={`loading-dot-${i}`} className="skeleton h-3 w-3 rounded-full animate-pulse" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default VirtualPlaylistList;
