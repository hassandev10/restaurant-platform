import React from "react";
import { TableStatus } from "@/types/table";
import {
  CheckCircle2,
  Users,
  CalendarCheck,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

interface TableStatusBadgeProps {
  status: TableStatus;
  size?: "sm" | "md" | "lg";
}

export const TableStatusBadge: React.FC<TableStatusBadgeProps> = ({
  status,
  size = "md",
}) => {
  const getBadgeConfig = () => {
    switch (status) {
      case "AVAILABLE":
      case "ACTIVE":
        return {
          label: "متاحة",
          bg: "bg-emerald-50",
          border: "border-emerald-200",
          text: "text-emerald-800",
          dot: "bg-emerald-500",
          icon: CheckCircle2,
        };
      case "OCCUPIED":
        return {
          label: "مشغولة",
          bg: "bg-blue-50",
          border: "border-blue-200",
          text: "text-blue-800",
          dot: "bg-blue-600",
          icon: Users,
        };
      case "RESERVED":
        return {
          label: "محجوزة",
          bg: "bg-purple-50",
          border: "border-purple-200",
          text: "text-purple-800",
          dot: "bg-purple-600",
          icon: CalendarCheck,
        };
      case "CLEANING":
        return {
          label: "تحتاج تنظيف",
          bg: "bg-amber-50",
          border: "border-amber-200",
          text: "text-amber-800",
          dot: "bg-amber-500 animate-pulse",
          icon: Sparkles,
        };
      case "OUT_OF_SERVICE":
      case "INACTIVE":
        return {
          label: "خارج الخدمة",
          bg: "bg-stone-100",
          border: "border-stone-300",
          text: "text-stone-700",
          dot: "bg-stone-400",
          icon: AlertTriangle,
        };
    }
  };

  const config = getBadgeConfig();
  const Icon = config.icon;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[11px] gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
    lg: "px-3 py-1.5 text-sm gap-2",
  }[size];

  const iconSizes = {
    sm: "w-3 h-3",
    md: "w-3.5 h-3.5",
    lg: "w-4 h-4",
  }[size];

  return (
    <span
      className={`inline-flex items-center font-bold rounded-lg border ${config.bg} ${config.border} ${config.text} ${sizeClasses}`}
    >
      <span className={`w-2 h-2 rounded-full ${config.dot}`} />
      <Icon className={iconSizes} />
      <span>{config.label}</span>
    </span>
  );
};
