"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Order, OrderStatus } from "@/types/order";
import {
  formatCurrency,
  formatArabicTimeOnly,
} from "@/lib/formatters";
import {
  getStatusBadgeInfo,
  formatElapsedTimeArabic,
  isOrderDelayed,
  isOrderCancellable,
} from "@/lib/order-workflow";
import {
  Clock,
  ClockAlert,
  MapPin,
  Check,
  ChefHat,
  BellRing,
  Utensils,
  Ban,
  Loader2,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  MessageSquareQuote,
  Eye,
  History,
  ExternalLink,
  AlertTriangle,
  Layers,
} from "lucide-react";

interface OrderCardProps {
  order: Order;
  isSelected?: boolean;
  onSelect: (order: Order) => void;
  onUpdateStatus: (orderId: string, nextStatus: OrderStatus) => Promise<void>;
  onRequestCancel: (order: Order) => void;
  onOpenSession?: (order: Order) => void;
  isUpdating?: boolean;
}

const LIFECYCLE_STAGES: { status: OrderStatus; label: string }[] = [
  { status: "NEW", label: "جديد" },
  { status: "CONFIRMED", label: "تأكيد" },
  { status: "PREPARING", label: "تحضير" },
  { status: "READY", label: "جاهز" },
  { status: "SERVED", label: "تقديم" },
];

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  isSelected = false,
  onSelect,
  onUpdateStatus,
  onRequestCancel,
  onOpenSession,
  isUpdating = false,
}) => {
  const [isActionPending, setIsActionPending] = useState(false);
  const [isTrackExpanded, setIsTrackExpanded] = useState(false);

  const statusInfo = getStatusBadgeInfo(order.status);
  const isDelayed = isOrderDelayed(order.createdAt, order.status);
  const isNew = order.status === "NEW";
  const isCancelled = order.status === "CANCELLED";

  // Calculate current stage index in standard lifecycle
  const stageIndexMap: Record<OrderStatus, number> = {
    NEW: 0,
    CONFIRMED: 1,
    PREPARING: 2,
    READY: 3,
    SERVED: 4,
    CANCELLED: -1,
  };
  const currentStageIndex = stageIndexMap[order.status] ?? 0;

  // Cancellation event if present
  const cancelEvent = (order.events || []).find((ev) => ev.status === "CANCELLED");

  // Explicit action button configuration with statically analyzable Tailwind classes
  const getActionConfig = (status: OrderStatus) => {
    switch (status) {
      case "NEW":
        return {
          nextStatus: "CONFIRMED" as OrderStatus,
          label: "تأكيد واستلام الطلب",
          buttonClass: "bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white shadow-sm border border-amber-600/30",
          icon: <Check className="w-4 h-4 text-white flex-shrink-0" />,
        };
      case "CONFIRMED":
        return {
          nextStatus: "PREPARING" as OrderStatus,
          label: "إرسال للمطبخ وبدء التحضير",
          buttonClass: "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm border border-blue-700/30",
          icon: <ChefHat className="w-4 h-4 text-white flex-shrink-0" />,
        };
      case "PREPARING":
        return {
          nextStatus: "READY" as OrderStatus,
          label: "إشعار بأن الوجبة جاهزة",
          buttonClass: "bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white shadow-sm border border-purple-700/30",
          icon: <BellRing className="w-4 h-4 text-white flex-shrink-0" />,
        };
      case "READY":
        return {
          nextStatus: "SERVED" as OrderStatus,
          label: "تأكيد تقديم الوجبة للعميل",
          buttonClass: "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-sm border border-emerald-700/30",
          icon: <Utensils className="w-4 h-4 text-white flex-shrink-0" />,
        };
      default:
        return null;
    }
  };

  const actionConfig = getActionConfig(order.status);
  const totalItemsCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

  const handleNextActionClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!actionConfig || isActionPending || isUpdating) return;

    try {
      setIsActionPending(true);
      await onUpdateStatus(order.id, actionConfig.nextStatus);
    } finally {
      setIsActionPending(false);
    }
  };

  const handleCancelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRequestCancel(order);
  };

  const toggleTrackAccordion = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsTrackExpanded((prev) => !prev);
  };

  return (
    <div
      onClick={() => onSelect(order)}
      className={`group relative rounded-2xl border transition-all cursor-pointer select-none bg-white ${
        isSelected
          ? "border-forest-700 ring-2 ring-forest-700/20 shadow-md"
          : isNew
          ? "border-amber-400/90 shadow-soft bg-gradient-to-br from-amber-50/20 via-white to-white"
          : isDelayed
          ? "border-rose-300 shadow-soft bg-rose-50/10"
          : "border-stone-200/90 hover:border-stone-300 hover:shadow-card"
      }`}
    >
      {/* Top Indicator bar for NEW order priority */}
      {isNew && (
        <div className="absolute top-0 right-6 left-6 h-1 rounded-b-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400" />
      )}

      <div className="p-4 sm:p-5 space-y-3.5">
        {/* Card Header: Table, Order Number, Status & Elapsed Time */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {/* Table Badge */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-forest-900 text-cream-100 font-extrabold text-xs sm:text-sm shadow-sm">
              <MapPin className="w-3.5 h-3.5 text-cream-300" />
              <span>{order.tableName || order.tableNameSnapshot}</span>
            </div>

            {/* Order Number */}
            <span className="font-mono text-xs sm:text-sm font-bold text-stone-600 bg-stone-100 px-2 py-0.5 rounded-lg border border-stone-200/60" dir="ltr">
              #{order.orderNumber}
            </span>
          </div>

          {/* Status Badge & Delay Warning */}
          <div className="flex items-center gap-1.5">
            {isDelayed && !isCancelled && order.status !== "SERVED" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                <ClockAlert className="w-3 h-3 text-rose-600" />
                <span>متأخر</span>
              </span>
            )}

            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold border ${statusInfo.badgeClass}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
              <span>{statusInfo.label}</span>
            </span>
          </div>
        </div>

        {/* Time Received & Live Elapsed Time */}
        <div className="flex items-center justify-between text-xs text-stone-500 border-b border-stone-100 pb-2.5">
          <div className="flex items-center gap-1 text-stone-600">
            <Clock className="w-3.5 h-3.5 text-stone-400" />
            <span>وقت الاستلام:</span>
            <span className="font-bold text-stone-800">{formatArabicTimeOnly(order.createdAt)}</span>
          </div>

          <div
            className={`font-semibold text-xs ${
              isDelayed && !isCancelled && order.status !== "SERVED"
                ? "text-rose-700 font-extrabold"
                : "text-stone-600"
            }`}
          >
            {formatElapsedTimeArabic(order.createdAt)}
          </div>
        </div>

        {/* Live Visual Lifecycle Stepper directly on the Card ("من برا") */}
        {isCancelled ? (
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span className="font-bold">تم إلغاء الطلب:</span>
              <span className="truncate max-w-[180px]">{cancelEvent?.note || "بواسطة الإدارة"}</span>
            </div>
            <span className="text-[10px] text-rose-600 font-mono" dir="ltr">
              {cancelEvent ? formatArabicTimeOnly(cancelEvent.timestamp) : ""}
            </span>
          </div>
        ) : (
          <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-extrabold text-stone-500">
              <span className="flex items-center gap-1 text-forest-800">
                <span className="w-1.5 h-1.5 rounded-full bg-forest-600 animate-pulse" />
                <span>مراحل الطلب:</span>
              </span>
              <span className="font-bold text-stone-700">
                {statusInfo.label}
              </span>
            </div>

            {/* 5-Stage Stepper Dots & Labels */}
            <div className="grid grid-cols-5 gap-1 pt-0.5">
              {LIFECYCLE_STAGES.map((stage, idx) => {
                const isCompleted = currentStageIndex > idx;
                const isCurrent = currentStageIndex === idx;

                return (
                  <div key={stage.status} className="flex flex-col items-center text-center">
                    {/* Circle / Dot */}
                    <div
                      className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-bold transition-all ${
                        isCompleted
                          ? "bg-forest-900 text-white shadow-2xs"
                          : isCurrent
                          ? "bg-amber-500 text-white ring-2 ring-amber-200 font-extrabold animate-pulse"
                          : "bg-stone-200/80 text-stone-400"
                      }`}
                    >
                      {isCompleted ? "✓" : idx + 1}
                    </div>
                    {/* Label */}
                    <span
                      className={`text-[10px] mt-1 font-bold ${
                        isCurrent
                          ? "text-amber-800 font-extrabold"
                          : isCompleted
                          ? "text-forest-900"
                          : "text-stone-400"
                      }`}
                    >
                      {stage.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Items Preview with Quantities and Options */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-stone-400 flex items-center justify-between">
            <span>الأصناف ({totalItemsCount}):</span>
            <span className="text-stone-400 text-[10px]">انقر لعرض الفاتورة</span>
          </div>

          <div className="space-y-1.5">
            {order.items.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-2 text-xs bg-stone-50/70 p-2 rounded-xl border border-stone-100"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-extrabold text-forest-900 bg-white px-1.5 py-0.2 rounded border border-stone-200 text-xs">
                      {item.quantity}×
                    </span>
                    <span className="font-bold text-stone-800 truncate">
                      {item.productNameSnapshot}
                    </span>
                  </div>

                  {/* Selected Options Snippet */}
                  {item.selectedOptions && item.selectedOptions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.selectedOptions.map((opt, i) => (
                        <span
                          key={i}
                          className="text-[10px] bg-white text-stone-600 px-1.5 py-0.2 rounded border border-stone-200"
                        >
                          {opt.optionNameAr}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Special Instruction Note */}
                  {item.notes && (
                    <div className="flex items-center gap-1 text-[11px] text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded mt-1 border border-amber-200/60 font-medium">
                      <MessageSquareQuote className="w-3 h-3 text-amber-600 flex-shrink-0" />
                      <span className="truncate">{item.notes}</span>
                    </div>
                  )}
                </div>

                <span className="font-bold text-stone-800 text-xs flex-shrink-0">
                  {formatCurrency(item.lineTotal)}
                </span>
              </div>
            ))}

            {/* If more than 3 items */}
            {order.items.length > 3 && (
              <div className="text-center py-1 text-[11px] font-bold text-forest-800 bg-forest-50/60 rounded-lg border border-forest-100">
                + {order.items.length - 3} أصناف أخرى داخل التفاصيل
              </div>
            )}
          </div>
        </div>

        {/* Financial Summary: Total in EGP */}
        <div className="flex items-center justify-between pt-2 border-t border-stone-100">
          <span className="text-xs font-bold text-stone-600">إجمالي الحساب:</span>
          <span className="text-base sm:text-lg font-extrabold text-forest-950 font-cairo">
            {formatCurrency(order.total)}
          </span>
        </div>

        {/* Prominent Actions Row: "متابعة الطلب" + "طلبات الترابيزة" */}
        <div className="flex items-center gap-2 pt-0.5">
          <Link
            href={`/orders/${order.id}`}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 py-2.5 px-3 rounded-xl border border-forest-200 bg-forest-50 hover:bg-forest-100 active:bg-forest-200 text-forest-950 text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-2xs"
            title="متابعة الطلب ومسار الحالات الكامل"
          >
            <Eye className="w-3.5 h-3.5 text-forest-700 flex-shrink-0" />
            <span>متابعة الطلب</span>
          </Link>

          {onOpenSession && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenSession(order);
              }}
              className="py-2.5 px-3 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              title="عرض طلبات جلسة هذه الطاولة"
            >
              <Layers className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />
              <span>طلبات الترابيزة</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleTrackAccordion}
            className={`p-2.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
              isTrackExpanded
                ? "bg-stone-200 border-stone-300 text-stone-800"
                : "border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-600"
            }`}
            title={isTrackExpanded ? "إخفاء السجل السريع" : "سجل الحالات السريع"}
          >
            {isTrackExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        <div className="space-y-2">

          {/* Expanded Inline Tracking Timeline directly in the Card */}
          {isTrackExpanded && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="p-3 rounded-2xl bg-stone-50 border border-stone-200 text-xs space-y-2.5 animate-in fade-in duration-200"
            >
              <div className="flex items-center justify-between border-b border-stone-200/70 pb-1.5">
                <span className="font-extrabold text-stone-800 flex items-center gap-1">
                  <History className="w-3.5 h-3.5 text-forest-700" />
                  <span>تاريخ وتتبع الحالات المسجلة:</span>
                </span>

                <Link
                  href={`/orders/${order.id}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-forest-800 hover:text-forest-950 hover:underline"
                  title="فتح في صفحة مستقلة"
                >
                  <span>شاشة كاملة</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              {/* Event Timeline Entries */}
              <div className="space-y-2 pr-1">
                {order.events && order.events.length > 0 ? (
                  order.events.map((ev, i) => {
                    const badge = getStatusBadgeInfo(ev.status);
                    return (
                      <div
                        key={ev.id || i}
                        className="p-2 rounded-xl bg-white border border-stone-200/80 space-y-1 shadow-2xs text-[11px]"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded font-bold border ${badge.badgeClass}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                            <span>{badge.label}</span>
                          </span>

                          <span className="font-mono text-stone-500 text-[10px]" dir="ltr">
                            {formatArabicTimeOnly(ev.timestamp)}
                          </span>
                        </div>

                        <div className="text-stone-600 text-[11px]">
                          بواسطة: <span className="font-bold text-stone-800">{ev.actor}</span>
                        </div>

                        {ev.note && (
                          <div className="text-stone-700 text-[10px] bg-stone-50 p-1 rounded border border-stone-200/60 font-medium">
                            {ev.note}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-stone-400 text-center py-2 text-[11px]">
                    لا توجد أحداث مسجلة لهذا الطلب
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions Row: Large Touch Button for Next Step + Detail Link */}
        <div className="pt-1 flex items-center gap-2">
          {actionConfig ? (
            <button
              type="button"
              onClick={handleNextActionClick}
              disabled={isActionPending || isUpdating}
              className={`flex-1 py-3 px-3.5 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer ${actionConfig.buttonClass}`}
            >
              {isActionPending || isUpdating ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                actionConfig.icon
              )}
              <span className="font-extrabold text-white text-xs sm:text-sm">
                {actionConfig.label}
              </span>
            </button>
          ) : (
            <div className="flex-1 py-3 px-2 text-center text-xs font-bold text-stone-600 bg-stone-100 rounded-xl border border-stone-200">
              {order.status === "SERVED" ? "تم تسليم الطلب بالكامل ✓" : "الطلب ملغي"}
            </div>
          )}

          {/* Details Drawer Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(order);
            }}
            className="p-3 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 transition-colors cursor-pointer"
            title="عرض تفاصيل الفاتورة في الدرج الجانبي"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Cancel Button if eligible */}
          {isOrderCancellable(order.status) && (
            <button
              type="button"
              onClick={handleCancelClick}
              className="p-3 rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100 text-rose-700 transition-colors cursor-pointer"
              title="إلغاء الطلب"
            >
              <Ban className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
