"use client";

import React from "react";
import { OrderStatus } from "@/types/order";

export type FilterTabKey = "ALL_ACTIVE" | OrderStatus;

interface StatusTabItem {
  key: FilterTabKey;
  label: string;
  count: number;
  highlightNew?: boolean;
}

interface OrderStatusTabsProps {
  activeTab: FilterTabKey;
  onChangeTab: (tab: FilterTabKey) => void;
  counts: {
    ALL_ACTIVE: number;
    NEW: number;
    CONFIRMED: number;
    PREPARING: number;
    READY: number;
    SERVED: number;
    CANCELLED: number;
  };
}

export const OrderStatusTabs: React.FC<OrderStatusTabsProps> = ({
  activeTab,
  onChangeTab,
  counts,
}) => {
  const tabs: StatusTabItem[] = [
    { key: "ALL_ACTIVE", label: "كل الطلبات النشطة", count: counts.ALL_ACTIVE },
    { key: "NEW", label: "طلبات جديدة", count: counts.NEW, highlightNew: true },
    { key: "CONFIRMED", label: "تم التأكيد", count: counts.CONFIRMED },
    { key: "PREPARING", label: "قيد التحضير", count: counts.PREPARING },
    { key: "READY", label: "جاهزة للتقديم", count: counts.READY },
    { key: "SERVED", label: "تم تقديمها", count: counts.SERVED },
    { key: "CANCELLED", label: "ملغاة", count: counts.CANCELLED },
  ];

  return (
    <div className="w-full overflow-x-auto no-scrollbar pb-1">
      <div className="flex items-center gap-1.5 p-1 bg-stone-200/70 rounded-2xl min-w-max border border-stone-200">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const isNewAndHasOrders = tab.key === "NEW" && tab.count > 0;

          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onChangeTab(tab.key)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all relative select-none ${
                isActive
                  ? "bg-white text-stone-900 shadow-sm ring-1 ring-stone-900/5 font-extrabold"
                  : "text-stone-600 hover:text-stone-900 hover:bg-stone-100/70"
              }`}
            >
              <span>{tab.label}</span>

              {/* Count badge */}
              <span
                className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold transition-colors ${
                  isNewAndHasOrders
                    ? "bg-amber-500 text-white animate-pulse"
                    : isActive
                    ? "bg-forest-900 text-white"
                    : tab.count > 0
                    ? "bg-stone-300 text-stone-800"
                    : "bg-stone-200 text-stone-500"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
