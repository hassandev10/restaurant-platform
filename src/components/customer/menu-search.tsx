"use client";

import React from "react";
import { Search, X } from "lucide-react";

interface MenuSearchProps {
  value: string;
  onChange: (val: string) => void;
  resultCount?: number;
}

export const MenuSearch: React.FC<MenuSearchProps> = ({
  value,
  onChange,
  resultCount,
}) => {
  return (
    <div className="relative max-w-3xl mx-auto px-4 my-3">
      <div className="relative flex items-center">
        <Search className="absolute right-3.5 w-4 h-4 text-stone-400 pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="ابحث في أطباق ومشروبات المنيو..."
          className="w-full pr-10 pl-10 py-2.5 rounded-xl bg-white border border-stone-200/90 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-forest-600/30 focus:border-forest-700 shadow-sm transition-all"
          dir="rtl"
        />
        {value.trim() && (
          <button
            onClick={() => onChange("")}
            className="absolute left-3 w-6 h-6 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center transition-colors"
            aria-label="مسح البحث"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {value.trim() && typeof resultCount === "number" && (
        <div className="mt-1.5 px-1 flex items-center justify-between text-xs text-stone-500">
          <span>
            نتائج البحث عن &quot;<strong className="text-stone-700">{value}</strong>&quot;
          </span>
          <span className="font-semibold text-forest-800">{resultCount} صنف</span>
        </div>
      )}
    </div>
  );
};
