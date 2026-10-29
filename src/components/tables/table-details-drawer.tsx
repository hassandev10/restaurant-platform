import React, { useState } from "react";
import { RestaurantTable } from "@/types/table";
import { Order } from "@/types/order";
import { TableStatusBadge } from "./table-status-badge";
import { formatEGP } from "@/lib/order-workflow";
import {
  X,
  Users,
  Clock,
  Receipt,
  CalendarCheck,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  UserPlus,
  Loader2,
  Trash2,
} from "lucide-react";

interface TableDetailsDrawerProps {
  table: RestaurantTable | null;
  activeOrder: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenSessionModal: (table: RestaurantTable) => void;
  onOpenReservationModal: (table: RestaurantTable) => void;
  onPromptCloseSession: (table: RestaurantTable) => void;
  onMarkCleaned: (table: RestaurantTable) => Promise<void>;
  onCancelReservation: (table: RestaurantTable) => Promise<void>;
  onToggleOutOfService: (table: RestaurantTable, enable: boolean) => Promise<void>;
  onNavigateToOrder: (orderId: string) => void;
}

export const TableDetailsDrawer: React.FC<TableDetailsDrawerProps> = ({
  table,
  activeOrder,
  isOpen,
  onClose,
  onOpenSessionModal,
  onOpenReservationModal,
  onPromptCloseSession,
  onMarkCleaned,
  onCancelReservation,
  onToggleOutOfService,
  onNavigateToOrder,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen || !table) return null;

  const getElapsedMinutes = (startTime?: string): number | null => {
    if (!startTime) return null;
    const diff = Date.now() - new Date(startTime).getTime();
    return Math.max(0, Math.floor(diff / 60000));
  };

  const elapsedMins = getElapsedMinutes(table.sessionStartedAt);

  const handleAction = async (fn: () => Promise<void>) => {
    try {
      setIsProcessing(true);
      await fn();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 overflow-hidden font-cairo">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 left-0 max-w-full flex pl-0 sm:pl-10">
        <div
          className="w-screen max-w-lg bg-white shadow-2xl flex flex-col border-r border-stone-200 animate-in slide-in-from-left duration-200"
          dir="rtl"
        >
          {/* Header */}
          <div className="p-5 bg-forest-950 text-white flex items-start justify-between border-b border-forest-900">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="w-9 h-9 rounded-xl bg-white/10 text-cream-200 font-mono font-black text-sm flex items-center justify-center">
                  {table.tableNumber}
                </span>
                <div>
                  <h2 className="text-lg font-black">{table.name}</h2>
                  <p className="text-xs text-stone-300">
                    {table.sectionNameAr} {table.floor ? `• ${table.floor}` : ""}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-3">
                <TableStatusBadge status={table.status} size="sm" />
                <span className="text-xs text-cream-200/80 flex items-center gap-1 font-medium">
                  <Users className="w-3.5 h-3.5 text-cream-300" />
                  <span>السعة: {table.capacity} مقاعد</span>
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-white/10 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Drawer Body - Scrollable */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Session Info if Occupied */}
            {table.status === "OCCUPIED" && (
              <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-stone-800 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-forest-800" />
                    <span>بيانات الجلسة الحالية</span>
                  </span>
                  {elapsedMins !== null && (
                    <span className="font-mono font-bold text-forest-900 bg-forest-100/70 px-2 py-0.5 rounded-md">
                      مستمرة منذ {elapsedMins} دقيقة
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs pt-1 border-t border-stone-200/60">
                  <div>
                    <span className="text-stone-500 block text-[11px]">عدد الضيوف:</span>
                    <span className="font-bold text-stone-800">
                      {table.guestCount || table.capacity} أفراد
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500 block text-[11px]">وقت بدء الجلسة:</span>
                    <span className="font-mono font-bold text-stone-800">
                      {table.sessionStartedAt
                        ? new Date(table.sessionStartedAt).toLocaleTimeString("ar-EG", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "--:--"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Active Order Breakdown */}
            {activeOrder ? (
              <div className="bg-white rounded-2xl border border-stone-200 p-4 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-forest-800" />
                    <span className="font-extrabold text-sm text-stone-900">
                      الطلب النشط: {activeOrder.orderNumber}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigateToOrder(activeOrder.id)}
                    className="text-xs font-bold text-forest-800 hover:text-forest-950 flex items-center gap-1 transition-colors"
                  >
                    <span>عرض التفاصيل</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Items List */}
                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {activeOrder.items.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-stone-50 border border-stone-100 text-xs space-y-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-stone-800">
                          {item.quantity} × {item.productNameSnapshot}
                        </span>
                        <span className="font-mono font-bold text-stone-900 shrink-0">
                          {formatEGP(item.lineTotal)}
                        </span>
                      </div>
                      {item.selectedOptions && item.selectedOptions.length > 0 && (
                        <div className="text-[11px] text-stone-500">
                          {item.selectedOptions.map((opt) => opt.optionNameAr).join(" • ")}
                        </div>
                      )}
                      {item.notes && (
                        <div className="text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md inline-block">
                          ملاحظة: {item.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Financial Summary */}
                <div className="pt-2 border-t border-stone-100 space-y-1.5 text-xs">
                  <div className="flex justify-between text-stone-500">
                    <span>المجموع الفرعي:</span>
                    <span className="font-mono">{formatEGP(activeOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-stone-900 font-extrabold text-sm pt-1 border-t border-stone-200">
                    <span>إجمالي الحساب:</span>
                    <span className="font-mono text-forest-950">
                      {formatEGP(activeOrder.total)}
                    </span>
                  </div>
                </div>
              </div>
            ) : table.status === "OCCUPIED" ? (
              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-xs text-blue-900 space-y-1">
                <p className="font-bold">جلسة مفتوحة بدون أوردر مسجل بعد</p>
                <p className="text-[11px] text-blue-800">
                  يمكن للضيوف طلب الأوردر عبر مسح كود الطاولة أو يمكن تسجيل طلب مباشر من الصالة.
                </p>
              </div>
            ) : null}

            {/* Reservation Details */}
            {table.status === "RESERVED" && table.currentReservation && (
              <div className="bg-purple-50 rounded-2xl p-4 border border-purple-200 space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-purple-200/80">
                  <span className="font-extrabold text-sm text-purple-950 flex items-center gap-1.5">
                    <CalendarCheck className="w-4 h-4 text-purple-700" />
                    <span>تفاصيل الحجز المؤكد</span>
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-200 text-purple-900 font-bold text-[11px]">
                    {table.currentReservation.guestCount} أفراد
                  </span>
                </div>

                <div className="space-y-2 text-purple-900">
                  <div className="flex justify-between">
                    <span className="text-purple-700">اسم العميل:</span>
                    <span className="font-bold">{table.currentReservation.guestName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-700">رقم الهاتف:</span>
                    <span className="font-mono font-bold" dir="ltr">
                      {table.currentReservation.guestPhone}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-700">موعد الحضور:</span>
                    <span className="font-bold">
                      {new Date(table.currentReservation.reservedTime).toLocaleString("ar-EG", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                  {table.currentReservation.notes && (
                    <div className="pt-2 border-t border-purple-200 text-[11px]">
                      <span className="font-bold">ملاحظات: </span>
                      <span>{table.currentReservation.notes}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Cleaning Notice */}
            {table.status === "CLEANING" && (
              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 text-xs text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>الطاولة بانتظار التنظيف والتعقيم</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  {table.notes || "يرجى مسح الطاولة وتعقيمها وتجهيز كروت المنيو والمقاعد."}
                </p>
              </div>
            )}

            {/* Out of Service Notice */}
            {(table.status === "OUT_OF_SERVICE" || table.status === "INACTIVE") && (
              <div className="bg-stone-100 rounded-2xl p-4 border border-stone-200 text-xs text-stone-700 space-y-2">
                <div className="flex items-center gap-2 font-bold text-stone-900">
                  <AlertTriangle className="w-4 h-4 text-stone-500" />
                  <span>الطاولة خارج الخدمة</span>
                </div>
                <p className="text-[11px]">{table.notes || "معطلة للصيانة"}</p>
              </div>
            )}
          </div>

          {/* Drawer Actions Footer */}
          <div className="p-4 bg-stone-50 border-t border-stone-200 space-y-2">
            {/* AVAILABLE Actions */}
            {(table.status === "AVAILABLE" || table.status === "ACTIVE") && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onOpenSessionModal(table)}
                  className="py-2.5 px-3 rounded-xl bg-forest-800 hover:bg-forest-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all"
                >
                  <UserPlus className="w-4 h-4 text-cream-200" />
                  <span>بدء جلسة ضيوف</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenReservationModal(table)}
                  className="py-2.5 px-3 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-stone-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                >
                  <CalendarCheck className="w-4 h-4 text-purple-700" />
                  <span>تسجيل حجز</span>
                </button>
              </div>
            )}

            {/* OCCUPIED Actions */}
            {table.status === "OCCUPIED" && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => onPromptCloseSession(table)}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all"
                >
                  <Sparkles className="w-4 h-4 text-amber-200" />
                  <span>إنهاء الجلسة وإتاحة الطاولة للتنظيف</span>
                </button>
              </div>
            )}

            {/* CLEANING Actions */}
            {table.status === "CLEANING" && (
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => handleAction(() => onMarkCleaned(table))}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-all disabled:opacity-50"
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-cream-200" />
                )}
                <span>تم التنظيف والتعقيم (إتاحة الطاولة)</span>
              </button>
            )}

            {/* RESERVED Actions */}
            {table.status === "RESERVED" && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onOpenSessionModal(table)}
                  className="py-2.5 px-3 rounded-xl bg-forest-800 hover:bg-forest-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <UserPlus className="w-4 h-4 text-cream-200" />
                  <span>تأكيد الحضور (فتح جلسة)</span>
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleAction(() => onCancelReservation(table))}
                  className="py-2.5 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>إلغاء الحجز</span>
                </button>
              </div>
            )}

            {/* Secondary maintenance action */}
            <div className="pt-2 border-t border-stone-200/80 flex items-center justify-between text-xs text-stone-500">
              <span>حالة تشغيل الطاولة:</span>
              {table.status === "OUT_OF_SERVICE" || table.status === "INACTIVE" ? (
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleAction(() => onToggleOutOfService(table, false))}
                  className="font-bold text-emerald-800 hover:underline"
                >
                  إعادة الطاولة للخدمة ✓
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isProcessing || table.status === "OCCUPIED"}
                  onClick={() => handleAction(() => onToggleOutOfService(table, true))}
                  className="font-bold text-stone-500 hover:text-stone-800 hover:underline disabled:opacity-40"
                  title={table.status === "OCCUPIED" ? "لا يمكن تعطيل طاولة مشغولة" : ""}
                >
                  تعطيل للصيانة ⚙️
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
