"use client";

import React from "react";
import { Search, ArrowUpDown, ClockAlert, X } from "lucide-react";

export type OrderSortOption = "OLDEST_FIRST" | "NEWEST_FIRST" | "TABLE_NUMBER" | "TOTAL_DESC";

interface OrderSearchAndSortProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortOption: OrderSortOption;
  onSortChange: (option: OrderSortOption) => void;
  onlyDelayed: boolean;
  onToggleDelayed: (delayed: boolean) => void;
  delayedCount: number;
  totalFilteredCount: number;
}

export const OrderSearchAndSort: React.FC<OrderSearchAndSortProps> = ({
  searchQuery,
  onSearchChange,
  sortOption,
  onSortChange,
  onlyDelayed,
  onToggleDelayed,
  delayedCount,
}) => {
  const hasActiveFilters = searchQuery.trim().length > 0 || onlyDelayed;

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white p-3 rounded-2xl border border-stone-200 shadow-sm">
      {/* Search Input */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="ابحث برقم الطلب (EG-1048) أو اسم الطاولة (طاولة 4)..."
          className="w-full pr-10 pl-9 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-forest-700/20 focus:border-forest-700 transition-all"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-stone-400 hover:text-stone-700"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Delayed Orders Highlight Toggle */}
        <button
          type="button"
          onClick={() => onToggleDelayed(!onlyDelayed)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all select-none active:scale-95 ${
            onlyDelayed
              ? "bg-rose-50 border-rose-300 text-rose-800 ring-2 ring-rose-200"
              : delayedCount > 0
              ? "bg-amber-50/70 border-amber-200 text-amber-900 hover:bg-amber-100"
              : "bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100"
          }`}
        >
          <ClockAlert className={`w-3.5 h-3.5 ${delayedCount > 0 ? "text-amber-600" : "text-stone-400"}`} />
          <span>المتأخرة (&gt; 15 دقيقة)</span>
          {delayedCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-rose-600 text-white">
              {delayedCount}
            </span>
          )}
        </button>

        {/* Sorting Dropdown */}
        <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-1.5 text-xs">
          <ArrowUpDown className="w-3.5 h-3.5 text-stone-500" />
          <span className="text-stone-400 text-[11px] hidden sm:inline">الترتيب:</span>
          <select
            value={sortOption}
            onChange={(e) => onSortChange(e.target.value as OrderSortOption)}
            className="bg-transparent text-stone-800 font-bold focus:outline-none cursor-pointer text-xs"
          >
            <option value="OLDEST_FIRST">الأقدم أولاً (الأولوية للتحضير)</option>
            <option value="NEWEST_FIRST">الأحدث أولاً</option>
            <option value="TABLE_NUMBER">رقم الطاولة</option>
            <option value="TOTAL_DESC">الأعلى قيمة (ج.م)</option>
          </select>
        </div>

        {/* Clear Filters Reset */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              onSearchChange("");
              onToggleDelayed(false);
            }}
            className="p-2 rounded-xl text-stone-500 hover:text-stone-900 hover:bg-stone-100 text-xs font-semibold flex items-center gap-1 transition-colors"
            title="إعادة ضبط الفلاتر"
          >
            <X className="w-3.5 h-3.5" />
            <span className="hidden md:inline">مسح الفلاتر</span>
          </button>
        )}
      </div>
    </div>
  );
};
