import type { PlaylistDetail, Song } from '@alfira-bot/shared';
import { formatDuration } from '@alfira-bot/shared';
import { useVirtualizer } from '@tanstack/react-virtual';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addSongToPlaylist, getSongsPage } from '../api/api';
import { Backdrop } from './Backdrop';
import { Button } from './ui/Button';

export default function AddSongsModal({
  playlist,
  onClose,
  onAdded,
}: {
  playlist: PlaylistDetail;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [allSongs, setAllSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set(playlist.songs.map((ps) => ps.songId)));
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    getSongsPage(1, 500).then((result) => {
      setAllSongs(result.items);
      setLoading(false);
    });
  }, []);

  // Debounce search input
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedSearch(search), 200);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [search]);

  const searchLower = debouncedSearch.toLowerCase();
  const filtered = useMemo(
    () =>
      allSongs.filter(
        (s) =>
          s.title.toLowerCase().includes(searchLower) ||
          s.nickname?.toLowerCase().includes(searchLower)
      ),
    [allSongs, searchLower]
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 60,
    overscan: 5,
  });

  const handleAdd = useCallback(
    async (song: Song) => {
      setAdding((prev) => new Set([...prev, song.id]));
      try {
        await addSongToPlaylist(playlist.id, song.id);
        setAdded((prev) => new Set([...prev, song.id]));
      } catch {
        /* already added — mark as added */
        setAdded((prev) => new Set([...prev, song.id]));
      } finally {
        setAdding((prev) => {
          const n = new Set(prev);
          n.delete(song.id);
          return n;
        });
      }
    },
    [playlist.id]
  );

  const hasAddedNew = added.size > playlist.songs.length;

  return (
    <Backdrop onClose={onClose}>
      <div
        className="bg-surface border border-border rounded-xl w-full max-w-lg modal-clay
        flex flex-col max-h-[80vh] animate-fade-up"
      >
        <div className="p-4 md:p-5 border-b border-border">
          <h2 className="font-display text-2xl md:text-3xl text-fg tracking-wider">Add Songs</h2>
          <p className="font-mono text-xs text-muted mt-0.5">to "{playlist.name}"</p>
          <input
            className="input mt-3 md:mt-4"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 md:p-6 space-y-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={`skeleton-${n}`} className="flex items-center gap-3">
                  <div className="skeleton w-12 h-8 md:w-10 md:h-7 rounded" />
                  <div className="skeleton h-3 flex-1" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-4 md:p-6 font-mono text-xs text-muted text-center">no songs found</p>
          ) : (
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                position: 'relative',
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const song = filtered[virtualRow.index];
                if (song == null) return null;
                const isAdded = added.has(song.id);
                const isAdding = adding.has(song.id);
                return (
                  <div
                    key={song.id}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <SongRow song={song} isAdded={isAdded} isAdding={isAdding} onAdd={handleAdd} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border flex justify-end">
          <Button variant="primary" onClick={hasAddedNew ? onAdded : onClose}>
            {hasAddedNew ? 'Done' : 'Close'}
          </Button>
        </div>
      </div>
    </Backdrop>
  );
}

const SongRow = memo(function SongRow({
  song,
  isAdded,
  isAdding,
  onAdd,
}: {
  song: Song;
  isAdded: boolean;
  isAdding: boolean;
  onAdd: (song: Song) => void;
}) {
  return (
    <div className="flex items-center gap-2 md:gap-3 px-4 md:px-5 py-3 hover:bg-elevated active:bg-elevated/80 transition-colors duration-100">
      <img
        src={song.thumbnailUrl}
        alt={song.nickname || song.title}
        className="w-12 h-8 md:w-10 md:h-7 object-cover rounded border border-border shrink-0"
        loading="lazy"
        decoding="async"
      />
      <span className="flex-1 font-body text-sm text-fg truncate">
        {song.nickname || song.title}
      </span>
      <span className="font-mono text-xs text-muted hidden sm:block">
        {formatDuration(song.duration)}
      </span>
      <Button
        variant="foreground"
        disabled={isAdded || isAdding}
        onClick={() => onAdd(song)}
        className={`font-mono text-xs px-3 py-2 md:py-1 min-h-11 md:min-h-0 ${
          isAdded ? 'border-accent/30 text-accent bg-accent/5 cursor-default' : ''
        }`}
      >
        {isAdding ? '...' : isAdded ? '✓' : 'add'}
      </Button>
    </div>
  );
});
