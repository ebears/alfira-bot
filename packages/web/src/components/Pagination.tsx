import type { PaginationMeta } from '@alfira-bot/shared';
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';
import { memo } from 'react';
import { Button } from './ui/Button';

interface PaginationProps {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
}

export const Pagination = memo(function Pagination({ pagination, onPageChange }: PaginationProps) {
  const { page, totalPages } = pagination;

  if (totalPages <= 1) return null;

  const handlePrevious = () => {
    if (page > 1) onPageChange(page - 1);
  };

  const handleNext = () => {
    if (page < totalPages) onPageChange(page + 1);
  };

  // Build page numbers with ellipsis for large page counts
  const pages: (number | { type: 'ellipsis'; id: number })[] = [];
  let ellipsisCount = 0;
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push({ type: 'ellipsis', id: ++ellipsisCount });
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push({ type: 'ellipsis', id: ++ellipsisCount });
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-6 md:mt-8">
      <Button
        variant="foreground"
        size="icon"
        onClick={handlePrevious}
        disabled={page === 1}
        title="Previous page"
      >
        <CaretLeftIcon size={16} weight="duotone" />
      </Button>

      {pages.map((p) =>
        typeof p === 'object' ? (
          <span key={`ellipsis-${p.id}`} className="px-2 text-muted font-mono text-xs">
            …
          </span>
        ) : (
          <Button
            key={p}
            variant={p === page ? 'primary' : 'foreground'}
            size="icon"
            onClick={() => onPageChange(p)}
            className={p === page ? '' : 'opacity-60 hover:opacity-100'}
          >
            {p}
          </Button>
        )
      )}

      <Button
        variant="foreground"
        size="icon"
        onClick={handleNext}
        disabled={page === totalPages}
        title="Next page"
      >
        <CaretRightIcon size={16} weight="duotone" />
      </Button>
    </div>
  );
});
