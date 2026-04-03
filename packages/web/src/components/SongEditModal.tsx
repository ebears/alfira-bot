import type { Song } from '@alfira-bot/shared';
import { updateSong } from '@alfira-bot/shared/api';
import { ArrowCounterClockwiseIcon, Check, FloppyDisk, PencilSimple } from '@phosphor-icons/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getTagColorClasses } from '../utils/tagColors';

interface SongEditModalProps {
  song: Song;
  onClose: () => void;
  onSave: () => void;
}

export default function SongEditModal({ song, onClose, onSave }: SongEditModalProps) {
  const songExtended = song as Song & {
    artist?: string | null;
    album?: string | null;
    artwork?: string | null;
    tags?: string[];
  };
  const [nickname, setNickname] = useState(song.nickname ?? '');
  const [artist, setArtist] = useState(songExtended.artist ?? '');
  const [album, setAlbum] = useState(songExtended.album ?? '');
  const [artwork, setArtwork] = useState(songExtended.artwork ?? '');
  const [tags, setTags] = useState<string[]>(songExtended.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, saving]);

  const hasChanges =
    nickname !== (song.nickname ?? '') ||
    artist !== (songExtended.artist ?? '') ||
    album !== (songExtended.album ?? '') ||
    artwork !== (songExtended.artwork ?? '') ||
    JSON.stringify(tags) !== JSON.stringify(songExtended.tags ?? []);

  const addTag = useCallback(() => {
    const trimmed = tagInput.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    setTags((prev) => [...prev, trimmed]);
    setTagInput('');
  }, [tagInput, tags]);

  const removeTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTag();
      }
      if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
        removeTag(tags[tags.length - 1]);
      }
    },
    [addTag, tagInput, tags, removeTag]
  );

  const handleReset = async () => {
    await updateSong(song.id, {
      nickname: null,
      artist: null,
      album: null,
      artwork: null,
      tags: [],
    });
    onSave();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSong(song.id, {
        nickname: nickname.trim() || null,
        artist: artist.trim() || null,
        album: album.trim() || null,
        artwork: artwork.trim() || null,
        tags,
      });
      onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={() => !saving && onClose()} />

      {/* Modal */}
      <div className="relative bg-surface border border-border rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
        <h2 className="font-display text-xl text-fg tracking-wider mb-4 flex items-center gap-2">
          <PencilSimple size={18} weight="duotone" />
          Edit Song
        </h2>

        <div className="flex flex-col gap-3">
          <Field
            id="nickname"
            label="Nickname"
            value={nickname}
            onChange={setNickname}
            inputRef={inputRef}
            placeholder="Display name"
          />
          <Field
            id="artist"
            label="Artist"
            value={artist}
            onChange={setArtist}
            placeholder="Artist name"
          />
          <Field
            id="album"
            label="Album"
            value={album}
            onChange={setAlbum}
            placeholder="Album name"
          />
          <Field
            id="artwork"
            label="Artwork URL"
            value={artwork}
            onChange={setArtwork}
            placeholder="https://example.com/artwork.jpg"
          />

          {/* Tags */}
          <div>
            <label
              htmlFor="tag-input"
              className="block font-mono text-[10px] text-muted uppercase mb-1"
            >
              Tags
            </label>
            <div
              className="input p-2 flex flex-wrap gap-1.5 items-center min-h-9.5 cursor-text"
              onClick={() => tagInputRef.current?.focus()}
            >
              {tags.map((tag) => {
                const c = getTagColorClasses(tag);
                return (
                  <span
                    key={tag}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono ${c.bg} ${c.text} border ${c.border}`}
                  >
                    {tag}
                    <button
                      type="button"
                      className="ml-0.5 opacity-70 hover:opacity-100"
                      onClick={() => removeTag(tag)}
                    >
                      &times;
                    </button>
                  </span>
                );
              })}
              <input
                id="tag-input"
                ref={tagInputRef}
                className="flex-1 min-w-20 bg-transparent outline-none text-sm text-fg placeholder:text-faint"
                placeholder={tags.length === 0 ? 'Custom grouping (enter to confirm)' : ''}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-4">
          <button
            type="button"
            className="btn btn--primary flex-1 h-10 text-xs font-mono flex items-center justify-center gap-1.5"
            onClick={handleSave}
            disabled={saving || !hasChanges}
          >
            <FloppyDisk size={14} weight="duotone" />
            Save
          </button>
          {hasChanges && (
            <button
              type="button"
              className="btn h-10 w-10 text-xs font-mono flex items-center justify-center text-muted hover:text-fg"
              onClick={() => {
                setNickname(song.nickname ?? '');
                setArtist(songExtended.artist ?? '');
                setAlbum(songExtended.album ?? '');
                setArtwork(songExtended.artwork ?? '');
                setTags(songExtended.tags ?? []);
                setTagInput('');
              }}
              disabled={saving}
              title="Reset changes"
            >
              <ArrowCounterClockwiseIcon size={16} weight="duotone" />
            </button>
          )}
          <button
            type="button"
            className="btn h-10 w-10 text-xs font-mono flex items-center justify-center text-muted hover:text-fg"
            onClick={onClose}
            disabled={saving}
            title="Close"
          >
            <Check size={16} weight="duotone" />
          </button>
          <button
            type="button"
            className="btn h-10 w-10 text-xs font-mono flex items-center justify-center text-danger/70 hover:text-danger"
            onClick={handleReset}
            disabled={saving}
            title="Reset all fields to defaults"
          >
            <ArrowCounterClockwiseIcon size={16} weight="duotone" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  placeholder,
  inputRef,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div>
      <label htmlFor={id} className="block font-mono text-[10px] text-muted uppercase mb-1">
        {label}
      </label>
      <input
        id={id}
        ref={inputRef}
        className="input text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}
