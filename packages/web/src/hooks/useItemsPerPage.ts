import { useEffect, useRef, useState } from 'react';

const DEBOUNCE_MS = 50;

/**
 * Calculates how many items fill exactly 4 rows of the container grid.
 * Matches breakpoints used by the song grid layout in SongsPage.
 */
function calculateCapacity(containerWidth: number): number {
  // contentBox width already excludes padding (contentRect from ResizeObserver)
  // Matches grid CSS: gap-3 md:gap-4 (12px / 16px), minmax(270px, 1fr)
  const isMd = containerWidth >= 768;
  const gap = isMd ? 16 : 12;

  let cols: number;
  if (!isMd) {
    // CSS: grid-cols-1 < 640px, grid-cols-2 >= 640px
    cols = containerWidth >= 640 ? 2 : 1;
  } else {
    // auto-fill: cols = floor((w + gap) / (270 + gap))
    cols = containerWidth >= 270 + gap ? Math.floor((containerWidth + gap) / (270 + gap)) : 1;
  }

  // Mobile (1 col): override to 10 items for a reasonable scroll length
  if (cols === 1) return 10;

  return cols * 4;
}

export function useItemsPerPage(defaultItems = 16) {
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const itemsPerPage = containerWidth === 0 ? defaultItems : calculateCapacity(containerWidth);

  // Measure container on mount and on resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          setContainerWidth(Math.round(entry.contentRect.width));
        }, DEBOUNCE_MS);
      }
    });

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const setContainerRef = (el: HTMLDivElement | null) => {
    containerRef.current = el;
  };

  return { itemsPerPage, setContainerRef };
}
