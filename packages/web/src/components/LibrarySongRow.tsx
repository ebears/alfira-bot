import type { Playlist, Song } from '@alfira-bot/shared';
import { formatDuration } from '@alfira-bot/shared';
import {
  CircleNotchIcon,
  ClockIcon,
  DiscIcon,
  PencilIcon,
  PlayIcon,
  TagIcon,
  UserIcon,
} from '@phosphor-icons/react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useSongEdit } from '../context/SongEditContext';
import { useSongActions } from '../hooks/useSongActions';
import { getTagColorClasses } from '../utils/tagColors';
import { ContextMenu, ContextMenuTrigger } from './ContextMenu';
import SongEditPanel from './SongEditPanel';
import { Button } from './ui/Button';

interface LibrarySongRowProps {
  song: Song;
  isAdmin: boolean;
  playlists: Playlist[];
  isAdminView?: boolean;
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
    isAdminView,
    onDelete,
    onPlay,
    isPlaying,
    onAddToQueue,
  }: LibrarySongRowProps) => {
    const { openSongId, setOpenSongId } = useSongEdit();
    const isOpen = openSongId === song.id;
    const tickerRef = useRef<HTMLDivElement>(null);
    const tickerInnerRef = useRef<HTMLDivElement>(null);
    const [tagsOverflow, setTagsOverflow] = useState(false);
    const checkOverflow = useCallback(() => {
      const container = tickerRef.current;
      const content = tickerInnerRef.current;
      if (!container || !content) return;
      setTagsOverflow(content.scrollWidth > container.clientWidth);
    }, []);
    useEffect(() => {
      checkOverflow();
    }, [checkOverflow]);
    const tags = song.tags ?? [];

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
      <div
        className={`flex flex-col rounded-lg bg-elevated clay-resting transition-all duration-100${isAdminView ? ' hover:clay-raised hover:-translate-y-px active:clay-flat active:translate-y-0' : ''}`}
        data-song-edit-container
      >
        <div
          className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-3"
          onClick={() => isAdmin && setOpenSongId(isOpen ? null : song.id)}
          style={isAdmin ? { cursor: 'pointer' } : undefined}
        >
          <img
            src={song.thumbnailUrl}
            alt={song.nickname || song.title}
            className="w-24 h-14 md:w-20 md:h-12 object-cover rounded border border-border shrink-0"
            loading="lazy"
            decoding="async"
          />
          <div className="flex-1 min-w-0 flex flex-col gap-px">
            <p
              className={`flex items-center gap-1 truncate${song.nickname ? ' font-mono text-sm text-muted' : 'font-medium text-fg'}`}
            >
              {song.nickname && <PencilIcon size={11} weight="fill" className="shrink-0" />}
              <span className="truncate">{song.nickname || song.title}</span>
            </p>
            {song.artist && (
              <p className="flex items-center gap-1 font-mono text-sm text-muted truncate">
                <UserIcon size={11} weight="fill" className="shrink-0" />
                <span className="truncate">{song.artist}</span>
              </p>
            )}
            {song.album && (
              <p className="flex items-center gap-1 font-mono text-sm text-muted truncate">
                <DiscIcon size={11} weight="fill" className="shrink-0" />
                <span className="truncate">{song.album}</span>
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0 mr-2">
            <span className="flex items-center gap-1 font-mono text-xs text-muted">
              {formatDuration(song.duration)}
              <ClockIcon size={11} weight="fill" className="shrink-0" />
            </span>
            {tags.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted">
                <div className="overflow-hidden py-0" ref={tickerRef}>
                  <div
                    className="flex gap-1"
                    ref={tickerInnerRef}
                    style={
                      tagsOverflow
                        ? {
                            width: 'max-content',
                            animation: 'ticker-scroll 15s linear infinite',
                          }
                        : undefined
                    }
                  >
                    {tags.map((tag) => {
                      const colors = getTagColorClasses(tag);
                      return (
                        <span
                          key={`a-${tag}`}
                          className={`inline-flex items-center px-1.5 py-0 rounded text-[11px] font-medium whitespace-nowrap ${colors.bg} ${colors.text}`}
                        >
                          {tag}
                        </span>
                      );
                    })}
                    {tagsOverflow &&
                      tags.map((tag) => {
                        const colors = getTagColorClasses(tag);
                        return (
                          <span
                            key={`b-${tag}`}
                            className={`inline-flex items-center px-1.5 py-0 rounded text-[11px] font-medium whitespace-nowrap ${colors.bg} ${colors.text}`}
                          >
                            {tag}
                          </span>
                        );
                      })}
                    <TagIcon size={11} weight="fill" className="shrink-0" />
                  </div>
                </div>
              </div>
            )}
          </div>
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
