import type { Song } from '@alfira-bot/shared';
import type { SongUpdateData } from '@alfira-bot/shared/api';
import { updateSong } from '@alfira-bot/shared/api';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getTagColorClasses } from '../utils/tagColors';

interface SongEditPanelProps {
  song: Song;
  isOpen: boolean;
  onClose: () => void;
}

export default function SongEditPanel({ song, isOpen, onClose }: SongEditPanelProps) {
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);

  useLayoutEffect(() => {
    if (isOpen) {
      closingRef.current = false;
      setClosing(false);
    } else if (!closingRef.current) {
      closingRef.current = true;
      setClosing(true);
      setTimeout(() => {
        closingRef.current = false;
        setClosing(false);
      }, 300);
    }
  }, [isOpen]);

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
  const [volumeOffset, setVolumeOffset] = useState(
    songExtended.volumeOffset != null ? String(songExtended.volumeOffset) : ''
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Refs for save logic so we don't recreate handlers on every render
  const songIdRef = useRef(song.id);
  songIdRef.current = song.id;
  const fieldsRef = useRef(() => ({ nickname, artist, album, artwork, tags, volumeOffset }));
  fieldsRef.current = () => ({ nickname, artist, album, artwork, tags, volumeOffset });
  const originalNicknameRef = useRef<string | null>(songExtended.nickname ?? null);
  originalNicknameRef.current = songExtended.nickname ?? null;
  const originalArtistRef = useRef<string | null>(songExtended.artist ?? null);
  originalArtistRef.current = songExtended.artist ?? null;
  const originalAlbumRef = useRef<string | null>(songExtended.album ?? null);
  originalAlbumRef.current = songExtended.album ?? null;
  const originalArtworkRef = useRef<string | null>(songExtended.artwork ?? null);
  originalArtworkRef.current = songExtended.artwork ?? null;
  const originalTagsRef = useRef<string[]>(songExtended.tags ?? []);
  originalTagsRef.current = songExtended.tags ?? [];
  const originalVolumeOffsetRef = useRef<number | null>(songExtended.volumeOffset ?? null);
  originalVolumeOffsetRef.current = songExtended.volumeOffset ?? null;
  const savingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (isOpen) {
      savingRef.current = false;
      inputRef.current?.focus();
    }
  }, [isOpen]);

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

  const doSave = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    try {
      const {
        nickname: nk,
        artist: ar,
        album: al,
        artwork: aw,
        tags: t,
        volumeOffset: vo,
      } = fieldsRef.current();
      const parsedOffset = vo.trim() === '' ? null : parseInt(vo.trim(), 10);
      const data: SongUpdateData = {
        nickname: nk.trim() || null,
        artist: ar.trim() || null,
        album: al.trim() || null,
        artwork: aw.trim() || null,
        tags: t,
        volumeOffset: Number.isNaN(parsedOffset) ? null : parsedOffset,
      };
      await updateSong(songIdRef.current, data);
      onCloseRef.current();
    } finally {
      savingRef.current = false;
    }
  }, []);

  // Save when `isOpen` goes to false (e.g. user clicks the parent row to close)
  useEffect(() => {
    if (!isOpen && !savingRef.current) {
      const {
        nickname: nk,
        artist: ar,
        album: al,
        artwork: aw,
        tags: t,
        volumeOffset: vo,
      } = fieldsRef.current();
      const parsedOffset = vo.trim() === '' ? null : parseInt(vo.trim(), 10);
      if (
        nk !== (originalNicknameRef.current ?? '') ||
        ar !== (originalArtistRef.current ?? '') ||
        al !== (originalAlbumRef.current ?? '') ||
        aw !== (originalArtworkRef.current ?? '') ||
        JSON.stringify(t) !== JSON.stringify(originalTagsRef.current) ||
        parsedOffset !== originalVolumeOffsetRef.current
      ) {
        void doSave();
      }
    }
  }, [isOpen, doSave]);

  if (!isOpen && !closing) return null;

  return (
    <div
      className="expand-panel-content"
      data-closing={closing ? 'true' : undefined}
      style={closing ? { pointerEvents: 'none' } : undefined}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 md:px-4 pt-4 pb-4 border-t border-border">
        <div className="flex flex-col gap-3">
          <Field
            id="panel-nickname"
            label="Nickname"
            value={nickname}
            onChange={setNickname}
            inputRef={inputRef}
            placeholder="Display name"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void doSave();
            }}
          />
          <Field
            id="panel-artist"
            label="Artist"
            value={artist}
            onChange={setArtist}
            placeholder="Artist name"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void doSave();
            }}
          />
          <Field
            id="panel-album"
            label="Album"
            value={album}
            onChange={setAlbum}
            placeholder="Album name"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void doSave();
            }}
          />
          <Field
            id="panel-artwork"
            label="Artwork URL"
            value={artwork}
            onChange={setArtwork}
            placeholder="https://example.com/artwork.jpg"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void doSave();
            }}
          />

          {/* Tags */}
          <div>
            <label
              htmlFor="panel-tag-input"
              className="block font-mono text-[10px] text-muted uppercase mb-1"
            >
              Tags
            </label>
            <div
              className="input text-sm flex flex-wrap gap-1.5 items-center min-h-9.5 cursor-text"
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
                id="panel-tag-input"
                ref={tagInputRef}
                className="flex-1 min-w-20 bg-transparent outline-none text-sm text-fg placeholder:text-faint"
                placeholder={tags.length === 0 ? 'Custom grouping (enter to confirm)' : ''}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
              />
            </div>
          </div>

          <VolumeSlider
            value={volumeOffset}
            onChange={setVolumeOffset}
            min={-30}
            max={30}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void doSave();
            }}
          />
        </div>
      </div>
    </div>
  );
}

function VolumeSlider({
  value,
  onChange,
  min,
  max,
  onKeyDown,
}: {
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const numeric = value.trim() === '' ? 0 : Math.min(max, Math.max(min, parseInt(value, 10) || 0));
  const pct = `${((numeric - min) / (max - min)) * 100}%`;

  return (
    <div>
      <span className="block font-mono text-[10px] text-muted uppercase mb-1">Volume Offset</span>
      <div className="flex items-center gap-3">
        <input
          id="panel-volume-offset"
          className="input text-sm w-16 text-center"
          type="text"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (v === '' || /^-?\d*$/.test(v)) onChange(v);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (value.trim() === '') onChange('0');
          }}
        />
        <span className="text-xs text-muted font-mono w-8 text-left">dB</span>
        <input
          type="range"
          min={min}
          max={max}
          value={numeric}
          onChange={(e) => onChange(e.target.value)}
          className="volume-range-input"
          style={
            {
              ['--volume-pct' as string]: pct,
            } as React.CSSProperties
          }
        />
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
  onKeyDown,
  type,
  min,
  max,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  type?: 'text' | 'number';
  min?: number;
  max?: number;
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
        type={type}
        min={type === 'number' ? min : undefined}
        max={type === 'number' ? max : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
      />
    </div>
  );
}
