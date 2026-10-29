import React from "react";
import {
  TableStatus,
  TableSection,
  TableSortOption,
} from "@/types/table";
import {
  Search,
  X,
  ArrowUpDown,
  Layers,
  RotateCcw,
} from "lucide-react";

interface TableFiltersAndSearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedStatus: TableStatus | "ALL";
  onStatusChange: (status: TableStatus | "ALL") => void;
  selectedSection: TableSection | "ALL";
  onSectionChange: (section: TableSection | "ALL") => void;
  sortOption: TableSortOption;
  onSortChange: (sort: TableSortOption) => void;
  onResetFilters: () => void;
  statusCounts: Record<string, number>;
  totalFiltered: number;
}

export const TableFiltersAndSearch: React.FC<TableFiltersAndSearchProps> = ({
  searchQuery,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  selectedSection,
  onSectionChange,
  sortOption,
  onSortChange,
  onResetFilters,
  statusCounts,
  totalFiltered,
}) => {
  const isFiltered =
    searchQuery.trim().length > 0 ||
    selectedStatus !== "ALL" ||
    selectedSection !== "ALL" ||
    sortOption !== "NUMBER_ASC";

  const statusOptions: Array<{ id: TableStatus | "ALL"; label: string }> = [
    { id: "ALL", label: "الكل" },
    { id: "AVAILABLE", label: "متاحة" },
    { id: "OCCUPIED", label: "مشغولة" },
    { id: "RESERVED", label: "محجوزة" },
    { id: "CLEANING", label: "تحتاج تنظيف" },
    { id: "OUT_OF_SERVICE", label: "خارج الخدمة" },
  ];

  const sectionOptions: Array<{ id: TableSection | "ALL"; label: string }> = [
    { id: "ALL", label: "جميع الأقسام والصالات" },
    { id: "MAIN_HALL", label: "الصالة الرئيسية" },
    { id: "TERRACE", label: "التراس الخارجي" },
    { id: "FAMILY", label: "قسم العائلات" },
    { id: "VIP", label: "جناح VIP" },
  ];

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs space-y-3.5">
      {/* Top Row: Search & Filters controls */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-stone-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="بحث برقم الطاولة، اسم الضيف، أو رقم الأوردر..."
            className="w-full pr-10 pl-10 py-2.5 rounded-xl border border-stone-200 bg-stone-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 text-xs sm:text-sm text-stone-900 transition-all placeholder:text-stone-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute inset-y-0 left-0 pl-3 flex items-center text-stone-400 hover:text-stone-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Section and Sort dropdowns */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Section Selector */}
          <div className="relative flex-1 sm:flex-initial">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-stone-500">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <select
              value={selectedSection}
              onChange={(e) => onSectionChange(e.target.value as TableSection | "ALL")}
              className="w-full sm:w-auto pr-9 pl-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50/70 hover:bg-white text-xs font-bold text-stone-700 focus:outline-none focus:ring-2 focus:ring-forest-800/20 cursor-pointer transition-all"
            >
              {sectionOptions.map((sec) => (
                <option key={sec.id} value={sec.id}>
                  {sec.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sort Selector */}
          <div className="relative flex-1 sm:flex-initial">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-stone-500">
              <ArrowUpDown className="w-3.5 h-3.5" />
            </div>
            <select
              value={sortOption}
              onChange={(e) => onSortChange(e.target.value as TableSortOption)}
              className="w-full sm:w-auto pr-9 pl-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50/70 hover:bg-white text-xs font-bold text-stone-700 focus:outline-none focus:ring-2 focus:ring-forest-800/20 cursor-pointer transition-all"
            >
              <option value="NUMBER_ASC">رقم الطاولة (تصاعدي 1-9)</option>
              <option value="NUMBER_DESC">رقم الطاولة (تنازلي 9-1)</option>
              <option value="CAPACITY_DESC">الأكبر سعة أولاً</option>
              <option value="DURATION_DESC">مدة الإشغال (الأطول أولاً)</option>
            </select>
          </div>

          {/* Reset Filters button */}
          {isFiltered && (
            <button
              type="button"
              onClick={onResetFilters}
              title="إعادة تعيين الفلاتر"
              className="p-2.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-600 hover:text-stone-900 transition-colors flex items-center gap-1.5 text-xs font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">إعادة ضبط</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom Row: Status Filter Tabs */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-stone-100 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5 min-w-max py-0.5">
          {statusOptions.map((opt) => {
            const isSelected = selectedStatus === opt.id;
            const count =
              opt.id === "ALL"
                ? Object.values(statusCounts).reduce((a, b) => a + b, 0)
                : statusCounts[opt.id] || 0;

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onStatusChange(opt.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isSelected
                    ? "bg-forest-900 text-white shadow-xs"
                    : "bg-stone-100/80 text-stone-600 hover:bg-stone-200/80 hover:text-stone-900"
                }`}
              >
                <span>{opt.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isSelected
                      ? "bg-forest-800 text-cream-200"
                      : "bg-stone-200 text-stone-700"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="text-[11px] font-medium text-stone-500 whitespace-nowrap pl-1">
          عرض <span className="font-bold font-mono text-stone-800">{totalFiltered}</span> طاولة
        </div>
      </div>
    </div>
  );
};
