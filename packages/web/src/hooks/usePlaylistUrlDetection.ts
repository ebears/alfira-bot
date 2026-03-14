import { useEffect, useState } from 'react';

export function usePlaylistUrlDetection(url: string) {
  const [isPlaylist, setIsPlaylist] = useState(false);
  const [importFullPlaylist, setImportFullPlaylist] = useState(false);

  useEffect(() => {
    const hasListParam = url.includes('list=');
    setIsPlaylist(hasListParam);
    if (!hasListParam) {
      setImportFullPlaylist(false);
    }
  }, [url]);

  return { isPlaylist, importFullPlaylist, setImportFullPlaylist };
}
