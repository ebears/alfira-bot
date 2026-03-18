import type { QueuedSong } from '@alfira-bot/shared';
import { formatDuration } from '@alfira-bot/shared';
import {
  BombIcon,
  DotsThreeOutlineVerticalIcon,
  GuitarIcon,
  LightningIcon,
  ListIcon,
  PlayCircleIcon,
  PlayIcon,
  PlusCircleIcon,
  XIcon,
} from '@phosphor-icons/react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ConfirmModal from '../components/ConfirmModal';
import { ContextMenu, type MenuItem } from '../components/ContextMenu';
import LoadPlaylistModal from '../components/queue/LoadPlaylistModal';
import OverrideModal from '../components/queue/OverrideModal';
import QuickAddModal from '../components/queue/QuickAddModal';
import { useAdminView } from '../context/AdminViewContext';
import { usePlayer } from '../context/PlayerContext';
import { Button } from './ui/Button';

export default function QueuePanel({ onClose }: { onClose: () => void }) {
  const { state, loading, elapsed, refetch, clear } = usePlayer();
  const { isAdminView } = useAdminView();
  const [showLoadPlaylist, setShowLoadPlaylist] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showOverride, setShowOverride] = useState(false);
  const [clearBusy, setClearBusy] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const { currentSong, queue, priorityQueue, isPlaying } = state;
  const progress = currentSong ? Math.min((elapsed / currentSong.duration) * 100, 100) : 0;
  const isQueueEmpty = queue.length === 0 && priorityQueue.length === 0 && !currentSong;

  const delayThenRefetch = async () => {
    await new Promise((r) => setTimeout(r, 600));
    await refetch();
  };

  const handleClear = useCallback(async () => {
    setClearBusy(true);
    try {
      await clear();
    } finally {
      setClearBusy(false);
    }
  }, [clear]);

  const menuItems: MenuItem[] = useMemo(() => {
    const items: MenuItem[] = [
      {
        id: 'quick-add',
        label: 'Quick Add',
        icon: <PlusCircleIcon size={14} weight="duotone" />,
        onClick: () => setShowQuickAdd(true),
      },
    ];
    if (isAdminView) {
      items.push({
        id: 'override',
        label: 'Override',
        icon: <PlayIcon size={14} weight="duotone" />,
        danger: true,
        onClick: () => setShowOverride(true),
      });
      items.push({
        id: 'clear-queue',
        label: 'Clear Queue',
        icon: <BombIcon size={14} weight="duotone" />,
        danger: true,
        disabled: clearBusy || isQueueEmpty,
        onClick: () => setClearConfirm(true),
      });
    }
    return items;
  }, [isAdminView, clearBusy, isQueueEmpty]);

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <PanelHeader onClose={onClose} />
        <div className="flex-1 p-4 space-y-3">
          <div className="skeleton h-5 w-48 rounded" />
          <div className="skeleton h-12 w-full rounded" />
          <div className="skeleton h-12 w-full rounded" />
          <div className="skeleton h-12 w-full rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <PanelHeader onClose={onClose} />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Now Playing card */}
        {currentSong ? (
          <NowPlayingCard
            song={currentSong}
            isPlaying={isPlaying}
            elapsed={elapsed}
            progress={progress}
          />
        ) : (
          <IdleCard />
        )}

        {/* Actions */}
        <section className="flex items-center justify-between">
          <Button
            variant="primary"
            type="button"
            onClick={() => setShowLoadPlaylist(true)}
            className="flex items-center gap-2"
          >
            <ListIcon size={16} weight="duotone" />
            <span>Load Playlist</span>
          </Button>
          <Button
            ref={triggerRef}
            variant="secondary"
            size="icon"
            type="button"
            aria-haspopup="true"
            aria-expanded={menuOpen}
            title="More actions"
            onClick={() => setMenuOpen(true)}
          >
            <DotsThreeOutlineVerticalIcon size={16} weight="duotone" />
          </Button>
        </section>

        {/* Up Next (Priority Queue) */}
        {priorityQueue.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-lg text-fg tracking-wider">
                <LightningIcon size={16} weight="duotone" className="inline mr-1" />
                Up Next
                <span className="ml-2 font-mono text-xs text-accent normal-case tracking-normal">
                  {priorityQueue.length}
                </span>
              </h2>
            </div>
            <div className="space-y-1 border-l-2 border-accent/40 pl-3">
              {priorityQueue.map((song, i) => (
                <QueueSongItem key={`priority-${song.id}-${i}`} song={song} index={i} accent />
              ))}
            </div>
          </section>
        )}

        {/* Queue */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display text-lg text-fg tracking-wider">
              Queue
              {queue.length > 0 && (
                <span className="ml-2 font-mono text-xs text-muted normal-case tracking-normal">
                  {queue.length}
                </span>
              )}
            </h2>
          </div>
          {queue.length === 0 ? (
            <div className="py-6 text-center border border-dashed border-border rounded-xl">
              <p className="font-mono text-[11px] text-faint">queue is empty</p>
              {priorityQueue.length === 0 && (
                <button
                  type="button"
                  onClick={() => setShowLoadPlaylist(true)}
                  className="mt-2 font-mono text-[11px] text-accent hover:underline"
                >
                  load a playlist to get started
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {queue.map((song, i) => (
                <QueueSongItem key={`${song.id}-${i}`} song={song} index={i} />
              ))}
            </div>
          )}
        </section>
      </div>

      {menuOpen && (
        <ContextMenu
          items={menuItems}
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
          triggerRef={triggerRef}
          align="right"
        />
      )}

      {/* Modals rendered via portal to escape slideout stacking context */}
      {showLoadPlaylist &&
        createPortal(
          <LoadPlaylistModal
            onClose={() => setShowLoadPlaylist(false)}
            onLoaded={async () => {
              setShowLoadPlaylist(false);
              await delayThenRefetch();
            }}
          />,
          document.body
        )}
      {showQuickAdd &&
        createPortal(
          <QuickAddModal
            onClose={() => setShowQuickAdd(false)}
            onAdded={async () => {
              setShowQuickAdd(false);
              await delayThenRefetch();
            }}
          />,
          document.body
        )}
      {showOverride &&
        createPortal(
          <OverrideModal
            onClose={() => setShowOverride(false)}
            onOverride={async () => {
              setShowOverride(false);
              await delayThenRefetch();
            }}
          />,
          document.body
        )}
      {clearConfirm &&
        createPortal(
          <ConfirmModal
            title="Clear Queue"
            message="All songs in the queue will be removed. This cannot be undone."
            confirmLabel="Clear"
            onConfirm={async () => {
              setClearConfirm(false);
              await handleClear();
            }}
            onCancel={() => setClearConfirm(false)}
          />,
          document.body
        )}
    </div>
  );
}

function QueueSongItem({
  song,
  index,
  accent,
}: {
  song: QueuedSong;
  index: number;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-2 py-2 rounded-lg clay-resting hover:clay-raised hover:bg-elevated transition-all duration-100">
      <span
        className={`font-mono text-[10px] w-4 text-right shrink-0 ${accent ? 'text-accent' : 'text-faint'}`}
      >
        {index + 1}
      </span>
      <img
        src={song.thumbnailUrl}
        alt={song.nickname || song.title}
        className="w-10 h-7 object-cover rounded border border-border shrink-0"
        loading="lazy"
      />
      <div className="flex-1 min-w-0">
        <p className="font-body text-xs font-medium text-fg truncate">
          {song.nickname || song.title}
        </p>
        <p className="font-mono text-[9px] text-muted hidden sm:block">req. {song.requestedBy}</p>
      </div>
      <span className="font-mono text-[10px] text-muted shrink-0">
        {formatDuration(song.duration)}
      </span>
    </div>
  );
}

function PanelHeader({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
      <h1 className="font-display text-xl text-fg tracking-wider">Queue</h1>
      <Button variant="foreground" size="icon" type="button" onClick={onClose} title="Close queue">
        <XIcon size={18} weight="bold" />
      </Button>
    </div>
  );
}

function NowPlayingCard({
  song,
  isPlaying,
  elapsed,
  progress,
}: {
  song: QueuedSong;
  isPlaying: boolean;
  elapsed: number;
  progress: number;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="flex gap-3 p-3">
        <div className="relative shrink-0">
          <img
            src={song.thumbnailUrl}
            alt={song.nickname || song.title}
            className="w-20 h-20 rounded-xl border border-border object-cover"
          />
          {isPlaying && (
            <div className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full bg-accent flex items-center justify-center">
              <PlayCircleIcon size={10} weight="duotone" className="text-white" />
            </div>
          )}
        </div>
        <div className="flex-1 flex flex-col justify-center min-w-0">
          <a
            href={song.youtubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-body font-bold text-sm text-fg hover:text-accent transition-colors duration-150 line-clamp-2"
          >
            {song.nickname || song.title}
          </a>
          <p className="font-mono text-[10px] text-muted mt-0.5">requested by {song.requestedBy}</p>
          <div className="mt-2">
            <div className="relative h-1.5 w-full bg-elevated rounded-full overflow-hidden">
              <div
                className="absolute inset-y-0 left-0 bg-accent rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="font-mono text-[9px] text-muted">{formatDuration(elapsed)}</span>
              <span className="font-mono text-[9px] text-muted">
                {formatDuration(song.duration)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function IdleCard() {
  return (
    <div className="card flex items-center justify-center py-8 border-dashed">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full bg-elevated border border-border flex items-center justify-center mx-auto mb-3">
          <GuitarIcon size={20} weight="duotone" className="text-faint" />
        </div>
        <p className="font-display text-xl text-faint tracking-wider mb-1">Nothing Playing</p>
        <p className="font-mono text-[10px] text-faint">
          use /join in Discord, then load a playlist
        </p>
      </div>
    </div>
  );
}
