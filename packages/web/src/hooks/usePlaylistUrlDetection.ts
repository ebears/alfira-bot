import { useMemo, useState } from 'react';

export function usePlaylistUrlDetection(url: string) {
  const isPlaylist = useMemo(() => url.includes('list='), [url]);
  const [importFullPlaylist, setImportFullPlaylist] = useState(false);

  return { isPlaylist, importFullPlaylist, setImportFullPlaylist };
}
