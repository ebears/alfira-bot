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
import type { RefObject } from 'react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useSongEdit } from '../context/SongEditContext';
import { useSongActions } from '../hooks/useSongActions';
import { getTagColorClasses } from '../utils/tagColors';
import { ContextMenu, ContextMenuTrigger } from './ContextMenu';
import SongEditPanel from './SongEditPanel';
import { Button } from './ui/Button';

interface MetaInfoProps {
  song: Song;
  tickerRef: RefObject<HTMLDivElement | null>;
  tickerInnerRef: RefObject<HTMLDivElement | null>;
  tagsOverflow: boolean;
}

function MetaInfo({ song, tickerRef, tickerInnerRef, tagsOverflow }: MetaInfoProps) {
  const tags = song.tags ?? [];
  return (
    <>
      <span className="flex items-center gap-1 font-mono text-xs text-muted">
        <ClockIcon size={11} weight="fill" className="shrink-0" />
        {formatDuration(song.duration)}
      </span>
      {tags.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted">
          <TagIcon size={11} weight="fill" className="shrink-0" />
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
            </div>
          </div>
        </div>
      )}
    </>
  );
}

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
    const tickerRefMobile = useRef<HTMLDivElement>(null);
    const tickerInnerRefMobile = useRef<HTMLDivElement>(null);
    const [tagsOverflow, setTagsOverflow] = useState(false);
    const checkOverflow = useCallback(() => {
      if (tickerRef.current && tickerInnerRef.current && tickerRef.current.clientWidth > 0) {
        setTagsOverflow(tickerInnerRef.current.scrollWidth > tickerRef.current.clientWidth);
        return;
      }
      if (tickerRefMobile.current && tickerInnerRefMobile.current) {
        setTagsOverflow(
          tickerInnerRefMobile.current.scrollWidth > tickerRefMobile.current.clientWidth
        );
      }
    }, []);
    useEffect(() => {
      checkOverflow();
    }, [checkOverflow]);
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
            className="w-14 h-14 md:w-12 md:h-12 object-cover rounded border border-border shrink-0"
            loading="lazy"
            decoding="async"
          />
          <div className="flex-1 min-w-0 flex flex-col gap-px">
            <p
              className={`flex items-center gap-1 truncate${song.nickname ? ' text-sm' : 'font-medium text-fg'}`}
            >
              {song.nickname && (
                <PencilIcon size={11} weight="fill" className="shrink-0 text-muted" />
              )}
              <span className="truncate">{song.nickname || song.title}</span>
            </p>
            {song.artist && (
              <p className="flex items-center gap-1 text-sm truncate">
                <UserIcon size={11} weight="fill" className="shrink-0 text-muted" />
                <span className="truncate">{song.artist}</span>
              </p>
            )}
            {song.album && (
              <p className="flex items-center gap-1 text-sm truncate">
                <DiscIcon size={11} weight="fill" className="shrink-0 text-muted" />
                <span className="truncate">{song.album}</span>
              </p>
            )}
            {(() => {
              const tags = song.tags ?? [];
              return (
                <>
                  <span className="flex items-center gap-1 text-xs text-muted md:hidden">
                    <ClockIcon size={11} weight="fill" className="shrink-0" />
                    {formatDuration(song.duration)}
                  </span>
                  {tags.length > 0 && (
                    <div className="flex items-center gap-1 text-sm text-muted mt-1 md:hidden">
                      <TagIcon size={11} weight="fill" className="shrink-0" />
                      <div className="overflow-hidden py-0" ref={tickerRefMobile}>
                        <div
                          className="flex gap-1"
                          ref={tickerInnerRefMobile}
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
                        </div>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          <div className="hidden md:flex flex-col items-end gap-1.5 shrink-0 mr-2">
            <MetaInfo
              song={song}
              tickerRef={tickerRef}
              tickerInnerRef={tickerInnerRef}
              tagsOverflow={tagsOverflow}
            />
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
