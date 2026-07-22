import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({ currentPage, totalPages, searchParams }: { currentPage: number, totalPages: number, searchParams: URLSearchParams }) {
  if (totalPages <= 1) return null;

  const pages = [];
  const maxPagesToShow = 5;
  
  let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
  let endPage = startPage + maxPagesToShow - 1;

  if (endPage > totalPages) {
    endPage = totalPages;
    startPage = Math.max(1, endPage - maxPagesToShow + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  const createPageUrl = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(page));
    return `?${params.toString()}`;
  };

  return (
    <div className="mt-12 flex justify-center gap-2">
      <Link 
        href={currentPage > 1 ? createPageUrl(currentPage - 1) : "#"}
        className={`flex items-center rounded-md px-3 py-2 ${currentPage > 1 ? "bg-white/10 text-white hover:bg-white/20" : "pointer-events-none bg-white/5 text-slate-500"}`}
      >
        <ChevronLeft size={16} className="mr-1" />
        <span className="hidden sm:inline">Prev</span>
      </Link>

      {startPage > 1 && (
        <>
          <Link href={createPageUrl(1)} className="rounded-md bg-white/10 px-4 py-2 text-white hover:bg-white/20">1</Link>
          {startPage > 2 && <span className="flex items-center px-2 text-slate-500">...</span>}
        </>
      )}

      {pages.map((p) => (
        <Link 
          key={p} 
          href={createPageUrl(p)}
          className={`rounded-md px-4 py-2 ${p === currentPage ? "bg-cyan-400 font-bold text-slate-950" : "bg-white/10 text-white hover:bg-white/20"}`}
        >
          {p}
        </Link>
      ))}

      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && <span className="flex items-center px-2 text-slate-500">...</span>}
          <Link href={createPageUrl(totalPages)} className="rounded-md bg-white/10 px-4 py-2 text-white hover:bg-white/20">{totalPages}</Link>
        </>
      )}

      <Link 
        href={currentPage < totalPages ? createPageUrl(currentPage + 1) : "#"}
        className={`flex items-center rounded-md px-3 py-2 ${currentPage < totalPages ? "bg-white/10 text-white hover:bg-white/20" : "pointer-events-none bg-white/5 text-slate-500"}`}
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight size={16} className="ml-1" />
      </Link>
    </div>
  );
}
