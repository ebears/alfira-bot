import { fetchTags } from '@alfira-bot/server/shared/api';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';

interface TagItem {
  canonicalName: string;
  nameLower: string;
  color?: string | null;
}

const TagsContext = createContext<{
  tagColorMap: Record<string, string | null>;
  refreshTags: () => void;
}>({
  tagColorMap: {},
  refreshTags: () => {},
});

export function TagsProvider({ children }: { children: ReactNode }) {
  const [tagColorMap, setTagColorMap] = useState<Record<string, string | null>>({});

  const refreshTags = useCallback(() => {
    fetchTags().then((tags: TagItem[]) => {
      const map: Record<string, string | null> = {};
      for (const tag of tags) {
        map[tag.nameLower] = tag.color ?? null;
      }
      setTagColorMap(map);
    });
  }, []);

  useEffect(() => {
    refreshTags();
  }, [refreshTags]);

  return (
    <TagsContext.Provider value={{ tagColorMap, refreshTags }}>{children}</TagsContext.Provider>
  );
}

export function useTagColors() {
  return useContext(TagsContext);
}
