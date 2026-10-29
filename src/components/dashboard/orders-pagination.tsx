"use client";

import React from "react";
import { ChevronRight, ChevronLeft, Loader2 } from "lucide-react";

interface OrdersPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
  isLoading?: boolean;
}

export const OrdersPagination: React.FC<OrdersPaginationProps> = ({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  isLoading = false,
}) => {
  if (total === 0) return null;

  const startRange = (page - 1) * pageSize + 1;
  const endRange = Math.min(page * pageSize, total);

  // Generate numbered pages with ellipsis for clean UX
  const getPageNumbers = (): (number | "dots")[] => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | "dots")[] = [1];

    if (page > 3) {
      pages.push("dots");
    }

    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (page < totalPages - 2) {
      pages.push("dots");
    }

    pages.push(totalPages);
    return pages;
  };

  const handlePrev = () => {
    if (page > 1 && !isLoading) {
      onPageChange(page - 1);
    }
  };

  const handleNext = () => {
    if (page < totalPages && !isLoading) {
      onPageChange(page + 1);
    }
  };

  const pageNumbers = getPageNumbers();

  return (
    <div
      className="bg-white rounded-2xl border border-stone-200/90 p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 font-cairo select-none"
      dir="rtl"
    >
      {/* Range and Total Information */}
      <div className="flex items-center gap-3 text-xs sm:text-sm text-stone-600">
        {isLoading ? (
          <div className="flex items-center gap-2 text-forest-700 font-bold">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>جاري تحديث النتائج...</span>
          </div>
        ) : (
          <div>
            <span>عرض </span>
            <span className="font-extrabold text-stone-900 font-mono" dir="ltr">
              {startRange}–{endRange}
            </span>
            <span> من إجمالي </span>
            <span className="font-extrabold text-stone-900 font-mono">
              {total}
            </span>
            <span> طلب</span>
          </div>
        )}
      </div>

      {/* Pagination Controls & Numbered Pages */}
      <div className="flex items-center gap-1.5 flex-wrap justify-center">
        {/* Previous Page Button (In RTL, ChevronRight points backwards/previous) */}
        <button
          type="button"
          onClick={handlePrev}
          disabled={page <= 1 || isLoading}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-50 text-stone-700 active:scale-95 cursor-pointer"
          title="الصفحة السابقة"
        >
          <ChevronRight className="w-4 h-4" />
          <span className="hidden xs:inline">السابق</span>
        </button>

        {/* Numbered Page Buttons */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((p, idx) => {
            if (p === "dots") {
              return (
                <span
                  key={`dots-${idx}`}
                  className="px-2 py-1 text-xs text-stone-400 font-bold select-none"
                >
                  •••
                </span>
              );
            }

            const isCurrent = p === page;
            return (
              <button
                key={p}
                type="button"
                onClick={() => {
                  if (p !== page && !isLoading) {
                    onPageChange(p);
                  }
                }}
                disabled={isLoading}
                className={`min-w-[34px] h-[34px] flex items-center justify-center rounded-xl text-xs font-bold transition-all font-mono ${
                  isCurrent
                    ? "bg-forest-900 text-white shadow-xs font-extrabold"
                    : "border border-stone-200 text-stone-700 hover:bg-stone-50 active:scale-95"
                } disabled:cursor-not-allowed cursor-pointer`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next Page Button (In RTL, ChevronLeft points forward/next) */}
        <button
          type="button"
          onClick={handleNext}
          disabled={page >= totalPages || isLoading}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-stone-200 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-50 text-stone-700 active:scale-95 cursor-pointer"
          title="الصفحة التالية"
        >
          <span className="hidden xs:inline">التالي</span>
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Page Size Selector (12, 24, 48) */}
      <div className="flex items-center gap-2 text-xs font-bold text-stone-600">
        <span>لكل صفحة:</span>
        <div className="flex items-center bg-stone-100 rounded-xl p-0.5 border border-stone-200/80">
          {[12, 24, 48].map((size) => (
            <button
              key={size}
              type="button"
              disabled={isLoading}
              onClick={() => {
                if (size !== pageSize && !isLoading) {
                  onPageSizeChange(size);
                }
              }}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                size === pageSize
                  ? "bg-white text-stone-900 shadow-xs font-extrabold"
                  : "text-stone-500 hover:text-stone-900"
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
