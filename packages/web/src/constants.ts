import { CassetteTapeIcon, MusicNoteIcon, VinylRecordIcon } from '@phosphor-icons/react';

export const NAV_ITEMS = [
  { to: '/songs', label: 'Songs', icon: MusicNoteIcon },
  { to: '/playlists', label: 'Playlists', icon: CassetteTapeIcon },
  { to: '/queue', label: 'Queue', icon: VinylRecordIcon },
];
