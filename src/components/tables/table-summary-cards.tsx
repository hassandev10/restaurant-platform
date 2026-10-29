import React from "react";
import { TableStats, TableStatus } from "@/types/table";
import {
  Grid,
  CheckCircle2,
  Users,
  CalendarCheck,
  AlertCircle,
} from "lucide-react";

interface TableSummaryCardsProps {
  stats: TableStats;
  selectedStatus?: TableStatus | "ALL";
  onSelectStatus?: (status: TableStatus | "ALL") => void;
}

export const TableSummaryCards: React.FC<TableSummaryCardsProps> = ({
  stats,
  selectedStatus = "ALL",
  onSelectStatus,
}) => {
  const cards = [
    {
      id: "ALL",
      status: "ALL" as const,
      title: "إجمالي الطاولات",
      count: stats.total,
      subText: "سعة الصالة الكاملة",
      icon: Grid,
      color: "forest",
      cardBg: "bg-white",
      borderColor: "border-stone-200",
      activeBorder: "border-forest-800 ring-2 ring-forest-800/10",
      iconBg: "bg-forest-50 text-forest-800",
      countColor: "text-forest-950",
    },
    {
      id: "AVAILABLE",
      status: "AVAILABLE" as const,
      title: "طاولات متاحة",
      count: stats.available,
      subText: "جاهزة لاستقبال الضيوف",
      icon: CheckCircle2,
      color: "emerald",
      cardBg: "bg-white",
      borderColor: "border-emerald-200/80",
      activeBorder: "border-emerald-600 ring-2 ring-emerald-600/15",
      iconBg: "bg-emerald-50 text-emerald-700",
      countColor: "text-emerald-700",
    },
    {
      id: "OCCUPIED",
      status: "OCCUPIED" as const,
      title: "طاولات مشغولة",
      count: stats.occupied,
      subText: "جلسات وطلبات نشطة",
      icon: Users,
      color: "blue",
      cardBg: "bg-white",
      borderColor: "border-blue-200/80",
      activeBorder: "border-blue-600 ring-2 ring-blue-600/15",
      iconBg: "bg-blue-50 text-blue-700",
      countColor: "text-blue-700",
    },
    {
      id: "RESERVED",
      status: "RESERVED" as const,
      title: "طاولات محجوزة",
      count: stats.reserved,
      subText: "حجوزات قادمة اليوم",
      icon: CalendarCheck,
      color: "purple",
      cardBg: "bg-white",
      borderColor: "border-purple-200/80",
      activeBorder: "border-purple-600 ring-2 ring-purple-600/15",
      iconBg: "bg-purple-50 text-purple-700",
      countColor: "text-purple-700",
    },
    {
      id: "CLEANING",
      status: "CLEANING" as const,
      title: "تحتاج انتباه / تنظيف",
      count: stats.attentionRequired,
      subText: `${stats.cleaning} تنظيف • ${Math.max(0, stats.attentionRequired - stats.cleaning)} جلسة طويلة`,
      icon: AlertCircle,
      color: "amber",
      cardBg: "bg-white",
      borderColor: "border-amber-200/80",
      activeBorder: "border-amber-600 ring-2 ring-amber-600/15",
      iconBg: "bg-amber-50 text-amber-700",
      countColor: "text-amber-700",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        const isSelected = selectedStatus === card.status;

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onSelectStatus && onSelectStatus(card.status)}
            className={`text-right p-3.5 rounded-2xl border transition-all shadow-xs relative overflow-hidden group hover:shadow-md ${
              isSelected ? card.activeBorder : card.borderColor
            } ${card.cardBg}`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-xs font-semibold text-stone-600 leading-snug">
                {card.title}
              </span>
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${card.iconBg}`}
              >
                <Icon className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-2 flex items-baseline gap-2">
              <span className={`text-2xl font-black font-mono tracking-tight ${card.countColor}`}>
                {card.count}
              </span>
              <span className="text-[11px] text-stone-500 font-medium">طاولة</span>
            </div>

            <div className="mt-1 text-[11px] text-stone-400 font-medium truncate">
              {card.subText}
            </div>

            {isSelected && (
              <span className="absolute bottom-0 inset-x-0 h-1 bg-current" />
            )}
          </button>
        );
      })}
    </div>
  );
};
