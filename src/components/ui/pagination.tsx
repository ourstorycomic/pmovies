import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  currentPage,
  totalPages,
  buildUrl,
}: {
  currentPage: number;
  totalPages: number;
  buildUrl: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  const maxPagesToShow = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
  let endPage = startPage + maxPagesToShow - 1;

  if (endPage > totalPages) {
    endPage = totalPages;
    startPage = Math.max(1, endPage - maxPagesToShow + 1);
  }

  const pages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

  return (
    <div className="mt-12 flex items-center justify-center space-x-2">
      {currentPage > 1 ? (
        <Link
          href={buildUrl(currentPage - 1)}
          className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
      ) : (
        <span className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/30 cursor-not-allowed">
          <ChevronLeft className="h-5 w-5" />
        </span>
      )}

      {startPage > 1 && (
        <>
          <Link
            href={buildUrl(1)}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-colors"
          >
            1
          </Link>
          {startPage > 2 && <span className="text-white/50 px-1">...</span>}
        </>
      )}

      {pages.map((page) => (
        <Link
          key={page}
          href={buildUrl(page)}
          className={`flex h-10 w-10 items-center justify-center rounded-md border transition-colors ${
            page === currentPage
              ? "border-cyan-400 bg-cyan-400/20 text-cyan-300 font-bold"
              : "border-white/10 bg-white/5 text-white hover:bg-white/10"
          }`}
        >
          {page}
        </Link>
      ))}

      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && <span className="text-white/50 px-1">...</span>}
          <Link
            href={buildUrl(totalPages)}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-colors"
          >
            {totalPages}
          </Link>
        </>
      )}

      {currentPage < totalPages ? (
        <Link
          href={buildUrl(currentPage + 1)}
          className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </Link>
      ) : (
        <span className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/30 cursor-not-allowed">
          <ChevronRight className="h-5 w-5" />
        </span>
      )}
    </div>
  );
}
