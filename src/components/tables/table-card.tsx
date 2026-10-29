import React from "react";
import { RestaurantTable } from "@/types/table";
import { TableStatusBadge } from "./table-status-badge";
import { formatEGP } from "@/lib/order-workflow";
import {
  Users,
  Clock,
  Receipt,
  Eye,
  Check,
  UserPlus,
  CalendarCheck,
  Sparkles,
  Phone,
  AlertCircle,
} from "lucide-react";

interface TableCardProps {
  table: RestaurantTable;
  onSelectTable: (table: RestaurantTable) => void;
  onOpenSession: (table: RestaurantTable) => void;
  onMarkCleaned: (table: RestaurantTable) => void;
  onOpenOrder: (orderId: string) => void;
}

export const TableCard: React.FC<TableCardProps> = ({
  table,
  onSelectTable,
  onOpenSession,
  onMarkCleaned,
  onOpenOrder,
}) => {
  // Calculate session elapsed time
  const getElapsedMinutes = (startTime?: string): number | null => {
    if (!startTime) return null;
    const diff = Date.now() - new Date(startTime).getTime();
    return Math.max(0, Math.floor(diff / 60000));
  };

  const elapsedMins = getElapsedMinutes(table.sessionStartedAt);
  const isOccupiedLong = elapsedMins !== null && elapsedMins >= 45;

  // Format order status in Arabic
  const getOrderStatusArabic = (status?: string) => {
    switch (status) {
      case "NEW":
        return { label: "طلب جديد", color: "bg-amber-100 text-amber-900 border-amber-200" };
      case "CONFIRMED":
        return { label: "تم التأكيد", color: "bg-blue-100 text-blue-900 border-blue-200" };
      case "PREPARING":
        return { label: "قيد التحضير", color: "bg-purple-100 text-purple-900 border-purple-200" };
      case "READY":
        return { label: "جاهز للتقديم", color: "bg-emerald-100 text-emerald-900 border-emerald-200" };
      case "SERVED":
        return { label: "تم التقديم", color: "bg-stone-100 text-stone-800 border-stone-200" };
      default:
        return { label: "نشط", color: "bg-stone-100 text-stone-800 border-stone-200" };
    }
  };

  const orderStatusConfig = table.currentOrderStatus
    ? getOrderStatusArabic(table.currentOrderStatus)
    : null;

  // Card highlight style based on status
  const getCardBorder = () => {
    switch (table.status) {
      case "AVAILABLE":
      case "ACTIVE":
        return "border-emerald-200/90 hover:border-emerald-400";
      case "OCCUPIED":
        return isOccupiedLong
          ? "border-amber-400 ring-1 ring-amber-400/20"
          : "border-blue-200 hover:border-blue-400";
      case "RESERVED":
        return "border-purple-200 hover:border-purple-400";
      case "CLEANING":
        return "border-amber-300 bg-amber-50/20";
      case "OUT_OF_SERVICE":
      case "INACTIVE":
        return "border-stone-200 bg-stone-50/60 opacity-80";
      default:
        return "border-stone-200";
    }
  };

  return (
    <div
      className={`bg-white rounded-2xl border transition-all shadow-xs hover:shadow-md flex flex-col justify-between overflow-hidden relative group ${getCardBorder()}`}
    >
      {/* Top Banner & Status Header */}
      <div className="p-4 border-b border-stone-100/90">
        <div className="flex items-start justify-between gap-2">
          {/* Table Number & Section */}
          <div>
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-forest-900 text-cream-100 font-black font-mono text-sm flex items-center justify-center shadow-xs">
                {table.tableNumber}
              </span>
              <h3 className="font-extrabold text-stone-900 text-base leading-tight">
                {table.name}
              </h3>
            </div>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-stone-500 font-medium">
              <span className="px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[11px] font-bold">
                {table.sectionNameAr}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-stone-400" />
                <span>{table.capacity} مقاعد</span>
              </span>
            </div>
          </div>

          {/* Status Badge */}
          <TableStatusBadge status={table.status} size="sm" />
        </div>
      </div>

      {/* Card Content Body */}
      <div className="p-4 flex-1 flex flex-col justify-center space-y-3">
        {/* Case 1: OCCUPIED */}
        {table.status === "OCCUPIED" && (
          <div className="space-y-2.5">
            {table.currentOrderNumber ? (
              <div className="bg-stone-50 rounded-xl p-2.5 border border-stone-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-700 flex items-center gap-1">
                    <Receipt className="w-3.5 h-3.5 text-forest-800" />
                    <span>أوردر {table.currentOrderNumber}</span>
                  </span>
                  {orderStatusConfig && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${orderStatusConfig.color}`}
                    >
                      {orderStatusConfig.label}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-stone-200/60">
                  <span className="text-[11px] text-stone-500">إجمالي الحساب:</span>
                  <span className="font-mono font-extrabold text-sm text-forest-950">
                    {table.currentOrderTotal ? formatEGP(table.currentOrderTotal) : "--"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-stone-600 bg-blue-50/60 p-2.5 rounded-xl border border-blue-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600 shrink-0" />
                <span>جلسة مفتوحة ({table.guestCount || table.capacity} ضيوف) • بانتظار الطلب</span>
              </div>
            )}

            {/* Session Time Tracker */}
            {elapsedMins !== null && (
              <div className="flex items-center justify-between text-xs text-stone-500 pt-0.5">
                <span className="flex items-center gap-1.5">
                  <Clock
                    className={`w-3.5 h-3.5 ${
                      isOccupiedLong ? "text-amber-600 animate-pulse" : "text-stone-400"
                    }`}
                  />
                  <span>مدة الجلسة:</span>
                </span>
                <span
                  className={`font-mono font-bold ${
                    isOccupiedLong ? "text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded" : "text-stone-800"
                  }`}
                >
                  {elapsedMins} دقيقة
                </span>
              </div>
            )}
          </div>
        )}

        {/* Case 2: RESERVED */}
        {table.status === "RESERVED" && table.currentReservation && (
          <div className="bg-purple-50/70 rounded-xl p-3 border border-purple-100 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-purple-950 flex items-center gap-1.5">
                <CalendarCheck className="w-3.5 h-3.5 text-purple-700" />
                <span>{table.currentReservation.guestName}</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-200 text-purple-900">
                {table.currentReservation.guestCount} أفراد
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-purple-800 pt-1">
              <span className="flex items-center gap-1 font-mono">
                <Phone className="w-3 h-3 text-purple-600" />
                <span dir="ltr">{table.currentReservation.guestPhone}</span>
              </span>
              <span className="font-bold text-purple-900">
                {new Date(table.currentReservation.reservedTime).toLocaleTimeString("ar-EG", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
        )}

        {/* Case 3: CLEANING */}
        {table.status === "CLEANING" && (
          <div className="bg-amber-50/80 rounded-xl p-3 border border-amber-200/70 text-xs space-y-1.5 text-amber-900">
            <div className="flex items-center gap-1.5 font-bold">
              <Sparkles className="w-4 h-4 text-amber-600 animate-pulse" />
              <span>تحتاج تنظيف وتعقيم</span>
            </div>
            <p className="text-[11px] text-amber-800/90 leading-relaxed">
              {table.notes || "غادر الضيوف الطاولة • يرجى التعقيم وتجهيز المقاعد."}
            </p>
          </div>
        )}

        {/* Case 4: AVAILABLE */}
        {(table.status === "AVAILABLE" || table.status === "ACTIVE") && (
          <div className="py-2 text-center text-xs text-stone-500">
            <p className="font-medium text-emerald-800">جاهزة ومجهزة للترحيب بالضيوف</p>
            <p className="text-[11px] text-stone-400 mt-0.5">يمكن فتح جلسة أو استقبال طلب مباشر</p>
          </div>
        )}

        {/* Case 5: OUT_OF_SERVICE */}
        {(table.status === "OUT_OF_SERVICE" || table.status === "INACTIVE") && (
          <div className="bg-stone-100 rounded-xl p-2.5 border border-stone-200 text-xs text-stone-600 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-stone-800">
              <AlertCircle className="w-4 h-4 text-stone-500" />
              <span>خارج الخدمة مؤقتاً</span>
            </div>
            <p className="text-[11px] text-stone-500">{table.notes || "صيانة دورية"}</p>
          </div>
        )}
      </div>

      {/* Card Action Buttons Footer */}
      <div className="p-3 bg-stone-50/80 border-t border-stone-100 flex items-center gap-2">
        {/* Main Inspect Table Details Button */}
        <button
          type="button"
          onClick={() => onSelectTable(table)}
          className="flex-1 py-2 px-3 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-800 hover:text-stone-900 text-xs font-bold transition-all shadow-2xs flex items-center justify-center gap-1.5 active:scale-98"
        >
          <Eye className="w-3.5 h-3.5 text-stone-500" />
          <span>تفاصيل الطاولة</span>
        </button>

        {/* Contextual Action Button */}
        {(table.status === "AVAILABLE" || table.status === "ACTIVE") && (
          <button
            type="button"
            onClick={() => onOpenSession(table)}
            className="py-2 px-3 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 active:scale-98"
          >
            <UserPlus className="w-3.5 h-3.5 text-cream-200" />
            <span>بدء جلسة</span>
          </button>
        )}

        {table.status === "CLEANING" && (
          <button
            type="button"
            onClick={() => onMarkCleaned(table)}
            className="py-2 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 active:scale-98"
          >
            <Check className="w-3.5 h-3.5 text-cream-200" />
            <span>تم التنظيف</span>
          </button>
        )}

        {table.status === "OCCUPIED" && table.currentOrderId && (
          <button
            type="button"
            onClick={() => onOpenOrder(table.currentOrderId!)}
            className="py-2 px-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1 active:scale-98"
          >
            <Receipt className="w-3.5 h-3.5 text-white" />
            <span>الطلب</span>
          </button>
        )}
      </div>
    </div>
  );
};
