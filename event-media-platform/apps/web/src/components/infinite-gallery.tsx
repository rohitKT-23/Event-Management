'use client';

import * as React from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

export type GalleryPage<T> = { data: T[]; nextPage: number | null };

type InfiniteGalleryProps<T> = {
  queryKey: unknown[];
  fetchPage: (page: number) => Promise<GalleryPage<T>>;
  renderItem: (item: T, index: number) => React.ReactNode;
  /** layout: 'grid' (fixed columns) or 'masonry' (CSS columns) */
  layout?: 'grid' | 'masonry';
  emptyState?: React.ReactNode;
  skeletonCount?: number;
  /** Reports the current flattened item list (useful for lightbox navigation). */
  onItems?: (items: T[]) => void;
};

function Skeletons({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="mb-2 aspect-square animate-pulse rounded-lg bg-muted" />
      ))}
    </>
  );
}

/**
 * Reusable infinite-scroll gallery. Pass a `fetchPage` returning
 * `{ data, nextPage }` and a `renderItem`. Uses an IntersectionObserver
 * sentinel to load more, and shows skeleton placeholders while fetching.
 */
export function InfiniteGallery<T>({
  queryKey,
  fetchPage,
  renderItem,
  layout = 'grid',
  emptyState,
  skeletonCount = 8,
  onItems,
}: InfiniteGalleryProps<T>) {
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam as number),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
  });

  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: '600px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const items = data?.pages.flatMap((p) => p.data) ?? [];

  React.useEffect(() => {
    onItems?.(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const containerClass =
    layout === 'masonry'
      ? 'columns-2 gap-2 sm:columns-3 lg:columns-4 [&>*]:mb-2 [&>*]:break-inside-avoid'
      : 'grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6';

  if (!isLoading && items.length === 0) {
    return <>{emptyState ?? <p className="py-12 text-center text-sm text-muted-foreground">Nothing here yet.</p>}</>;
  }

  return (
    <div>
      <div className={containerClass}>
        {items.map((item, i) => renderItem(item, i))}
        {(isLoading || isFetchingNextPage) && <Skeletons count={skeletonCount} />}
      </div>
      <div ref={sentinelRef} className="h-10" />
    </div>
  );
}
