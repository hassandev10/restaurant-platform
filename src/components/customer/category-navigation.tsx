"use client";

import React, { useRef } from "react";
import { MenuCategory } from "@/types/menu";
import { cn } from "@/lib/utils";

interface CategoryNavigationProps {
  categories: MenuCategory[];
  activeCategoryId: string;
  onSelectCategory: (id: string) => void;
  categoryCounts?: Record<string, number>;
}

export const CategoryNavigation: React.FC<CategoryNavigationProps> = ({
  categories,
  activeCategoryId,
  onSelectCategory,
  categoryCounts,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSelect = (categoryId: string) => {
    onSelectCategory(categoryId);
  };

  return (
    <nav
      className="bg-white/80 backdrop-blur-md border-b border-stone-200/60 sticky top-[73px] sm:top-[81px] z-20 py-2.5 px-4"
      aria-label="أقسام قائمة الطعام"
    >
      <div
        ref={scrollRef}
        className="max-w-3xl mx-auto flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth"
        role="tablist"
      >
        {categories.map((category) => {
          const isActive = activeCategoryId === category.id;
          const count = categoryCounts ? categoryCounts[category.id] : undefined;

          return (
            <button
              key={category.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => handleSelect(category.id)}
              className={cn(
                "flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 whitespace-nowrap",
                isActive
                  ? "bg-forest-800 text-cream-50 shadow-soft scale-[1.02]"
                  : "bg-cream-100/90 text-stone-700 hover:bg-cream-200/90 border border-stone-200/50"
              )}
            >
              <span>{category.nameAr}</span>
              {typeof count === "number" && count > 0 && (
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                    isActive
                      ? "bg-forest-950/60 text-cream-100"
                      : "bg-stone-200/70 text-stone-600"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
