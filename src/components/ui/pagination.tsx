"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PageSize = 10 | 25 | 50 | 100 | "ALL";

const pageSizeOptions: PageSize[] = [10, 25, 50, 100, "ALL"];

export function usePagination<T>(items: readonly T[], initialPageSize: PageSize = 10) {
  const [page, setPageState] = useState(1);
  const [pageSize, setPageSizeState] = useState<PageSize>(initialPageSize);
  const totalItems = items.length;
  const totalPages =
    pageSize === "ALL" ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = pageSize === "ALL" ? 0 : (currentPage - 1) * pageSize;
  const endIndex =
    pageSize === "ALL" ? totalItems : Math.min(startIndex + pageSize, totalItems);

  function setPage(nextPage: number) {
    setPageState(Math.min(Math.max(nextPage, 1), totalPages));
  }

  function setPageSize(nextPageSize: PageSize) {
    setPageSizeState(nextPageSize);
    setPageState(1);
  }

  return {
    items: pageSize === "ALL" ? [...items] : items.slice(startIndex, endIndex),
    page: currentPage,
    pageSize,
    totalItems,
    totalPages,
    startItem: totalItems ? startIndex + 1 : 0,
    endItem: endIndex,
    setPage,
    setPageSize,
  };
}

export function TablePagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  startItem,
  endItem,
  onPageChange,
  onPageSizeChange,
  className,
}: {
  page: number;
  pageSize: PageSize;
  totalItems: number;
  totalPages: number;
  startItem: number;
  endItem: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: PageSize) => void;
  className?: string;
}) {
  if (totalItems <= 10) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 border-t border-[var(--line)] bg-[var(--panel-soft)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
        <span>
          {startItem}-{endItem} of {totalItems}
        </span>
        <label className="flex items-center gap-2">
          <span>Rows per page</span>
          <select
            className="h-8 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-2 text-sm font-semibold text-[var(--foreground)] outline-none transition hover:border-[var(--line-strong)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--focus)]"
            value={String(pageSize)}
            onChange={(event) =>
              onPageSizeChange(
                event.target.value === "ALL"
                  ? "ALL"
                  : (Number(event.target.value) as PageSize),
              )
            }
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>
                {option === "ALL" ? "All" : option}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-1">
        <span className="mr-2 text-sm font-medium text-[var(--muted)]">
          Page {page} of {totalPages}
        </span>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="h-8 w-8"
          aria-label="First page"
          title="First page"
          disabled={page <= 1}
          onClick={() => onPageChange(1)}
        >
          <ChevronsLeft className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="h-8 w-8"
          aria-label="Previous page"
          title="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="h-8 w-8"
          aria-label="Next page"
          title="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="h-8 w-8"
          aria-label="Last page"
          title="Last page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(totalPages)}
        >
          <ChevronsRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
