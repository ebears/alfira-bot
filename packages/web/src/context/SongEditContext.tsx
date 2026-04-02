import { createContext, type ReactNode, useContext, useState } from 'react';

const SongEditContext = createContext<{
  openSongId: string | null;
  setOpenSongId: (id: string | null) => void;
}>({ openSongId: null, setOpenSongId: () => {} });

export function SongEditProvider({ children }: { children: ReactNode }) {
  const [openSongId, setOpenSongId] = useState<string | null>(null);
  return <SongEditContext value={{ openSongId, setOpenSongId }}>{children}</SongEditContext>;
}

export function useSongEdit() {
  return useContext(SongEditContext);
}
