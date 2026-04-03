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

  const inputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Refs for save logic so we don't recreate handlers on every render
  const songIdRef = useRef(song.id);
  songIdRef.current = song.id;
  const fieldsRef = useRef(() => ({ nickname, artist, album, artwork, tags }));
  fieldsRef.current = () => ({ nickname, artist, album, artwork, tags });
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
      const { nickname: nk, artist: ar, album: al, artwork: aw, tags: t } = fieldsRef.current();
      const data: SongUpdateData = {
        nickname: nk.trim() || null,
        artist: ar.trim() || null,
        album: al.trim() || null,
        artwork: aw.trim() || null,
        tags: t,
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
      const { nickname: nk, artist: ar, album: al, artwork: aw, tags: t } = fieldsRef.current();
      if (
        nk !== (originalNicknameRef.current ?? '') ||
        ar !== (originalArtistRef.current ?? '') ||
        al !== (originalAlbumRef.current ?? '') ||
        aw !== (originalArtworkRef.current ?? '') ||
        JSON.stringify(t) !== JSON.stringify(originalTagsRef.current)
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
            id="nickname"
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
            id="artist"
            label="Artist"
            value={artist}
            onChange={setArtist}
            placeholder="Artist name"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void doSave();
            }}
          />
          <Field
            id="album"
            label="Album"
            value={album}
            onChange={setAlbum}
            placeholder="Album name"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void doSave();
            }}
          />
          <Field
            id="artwork"
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
              htmlFor="tag-input"
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
                id="tag-input"
                ref={tagInputRef}
                className="flex-1 min-w-20 bg-transparent outline-none text-sm text-fg placeholder:text-faint"
                placeholder={tags.length === 0 ? 'Custom grouping (press enter to confirm)' : ''}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
              />
            </div>
          </div>
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
  onKeyDown,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
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
        onKeyDown={onKeyDown}
        placeholder={placeholder}
      />
    </div>
  );
}
