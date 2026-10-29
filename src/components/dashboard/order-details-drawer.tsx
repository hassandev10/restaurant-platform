"use client";

import React, { useEffect } from "react";
import { Order, OrderStatus } from "@/types/order";
import { formatCurrency, formatArabicDateTime, formatArabicTimeOnly } from "@/lib/formatters";
import {
  getStatusBadgeInfo,
  formatElapsedTimeArabic,
  isOrderCancellable,
  isOrderDelayed,
} from "@/lib/order-workflow";
import {
  X,
  MapPin,
  Clock,
  Printer,
  Ban,
  Check,
  ChefHat,
  BellRing,
  Utensils,
  History,
  Receipt,
  MessageSquareQuote,
  ClockAlert,
  Loader2,
  ExternalLink,
  Layers,
} from "lucide-react";
import Link from "next/link";

interface OrderDetailsDrawerProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateStatus: (orderId: string, nextStatus: OrderStatus) => Promise<void>;
  onRequestCancel: (order: Order) => void;
  onPrintReceipt: (order: Order) => void;
  onOpenSession?: (order: Order) => void;
  isUpdating?: boolean;
}

export const OrderDetailsDrawer: React.FC<OrderDetailsDrawerProps> = ({
  order,
  isOpen,
  onClose,
  onUpdateStatus,
  onRequestCancel,
  onPrintReceipt,
  onOpenSession,
  isUpdating = false,
}) => {
  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !order) return null;

  const statusInfo = getStatusBadgeInfo(order.status);
  const isDelayed = isOrderDelayed(order.createdAt, order.status);

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
          label: "إشعار بأن الوجبة جاهزة للتقديم",
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

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 left-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-screen max-w-md md:max-w-lg bg-white shadow-2xl flex flex-col justify-between border-r border-stone-200 animate-in slide-in-from-left duration-200">
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50/80 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-mono text-sm font-extrabold text-stone-800 bg-white px-2 py-0.5 rounded-lg border border-stone-200" dir="ltr">
                  #{order.orderNumber}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold border ${statusInfo.badgeClass}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                  <span>{statusInfo.label}</span>
                </span>
                {isDelayed && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                    <ClockAlert className="w-3 h-3 text-rose-600" />
                    <span>متأخر</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-stone-600 text-xs">
                <div className="flex items-center gap-1 font-bold text-forest-900">
                  <MapPin className="w-3.5 h-3.5 text-forest-700" />
                  <span>{order.tableName || order.tableNameSnapshot}</span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1 text-stone-500">
                  <Clock className="w-3.5 h-3.5 text-stone-400" />
                  <span>{formatArabicDateTime(order.createdAt)}</span>
                  <span className="text-stone-400">({formatElapsedTimeArabic(order.createdAt)})</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Link to dedicated order page */}
              <Link
                href={`/orders/${order.id}`}
                target="_blank"
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors"
                title="فتح في صفحة مستقلة"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Drawer Body - Scrollable */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6">
            {/* Quick Actions Bar inside drawer */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onPrintReceipt(order)}
                className="flex-1 py-2 px-3 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-stone-600" />
                <span>طباعة بون المطبخ</span>
              </button>

              {onOpenSession && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenSession(order);
                  }}
                  className="py-2 px-3 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title="عرض طلبات جلسة هذه الطاولة"
                >
                  <Layers className="w-3.5 h-3.5 text-amber-700" />
                  <span>طلبات الترابيزة</span>
                </button>
              )}

              {isOrderCancellable(order.status) && (
                <button
                  type="button"
                  onClick={() => onRequestCancel(order)}
                  className="py-2 px-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Ban className="w-3.5 h-3.5 text-rose-600" />
                  <span>إلغاء الطلب</span>
                </button>
              )}
            </div>

            {/* Itemized Order Details */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-stone-200 pb-2">
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-forest-700" />
                  <span>أصناف الطلب ({totalItemsCount}):</span>
                </h3>
                <span className="text-xs text-stone-500 font-medium">الأسعار المسجلة وقت الطلب</span>
              </div>

              <div className="space-y-3">
                {order.items.map((item, index) => (
                  <div
                    key={item.id || index}
                    className="p-3.5 rounded-2xl bg-stone-50/80 border border-stone-200/80 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-baseline gap-2">
                        <span className="w-6 h-6 rounded-lg bg-forest-900 text-white font-extrabold text-xs flex items-center justify-center flex-shrink-0">
                          {item.quantity}×
                        </span>
                        <div>
                          <div className="text-sm font-bold text-stone-900">
                            {item.productNameSnapshot}
                          </div>
                          <div className="text-xs text-stone-500 font-mono mt-0.5">
                            سعر الوحدة: {formatCurrency(item.unitPriceSnapshot)}
                          </div>
                        </div>
                      </div>

                      <div className="text-sm font-extrabold text-stone-900 font-cairo flex-shrink-0">
                        {formatCurrency(item.lineTotal)}
                      </div>
                    </div>

                    {/* Selected Options Snapshot */}
                    {item.selectedOptions && item.selectedOptions.length > 0 && (
                      <div className="pr-8 space-y-1">
                        <div className="text-[11px] font-bold text-stone-400">الخيارات المحددة:</div>
                        <div className="flex flex-wrap gap-1.5">
                          {item.selectedOptions.map((opt, i) => (
                            <span
                              key={i}
                              className="text-xs px-2 py-0.5 rounded-md bg-white border border-stone-200 text-stone-700 font-medium inline-flex items-center gap-1"
                            >
                              <span>{opt.optionNameAr}</span>
                              {opt.priceDelta > 0 && (
                                <span className="text-[10px] text-forest-700 font-bold">
                                  (+{formatCurrency(opt.priceDelta)})
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Special Instructions Notes */}
                    {item.notes && (
                      <div className="pr-8">
                        <div className="flex items-center gap-1.5 p-2 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs font-medium">
                          <MessageSquareQuote className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                          <span>ملاحظات خاصة: {item.notes}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Price Calculations */}
            <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200 space-y-2 text-xs sm:text-sm">
              <div className="flex items-center justify-between text-stone-600">
                <span>المجموع الفرعي:</span>
                <span className="font-bold text-stone-800 font-cairo">
                  {formatCurrency(order.subtotal)}
                </span>
              </div>

              <div className="flex items-center justify-between text-stone-600">
                <span>الضريبة والخدمة (شاملة):</span>
                <span className="text-stone-400 text-xs">مشمولة في الأسعار</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-stone-200 text-stone-900 font-extrabold text-base">
                <span>الإجمالي الكلي:</span>
                <span className="text-lg text-forest-900 font-cairo">
                  {formatCurrency(order.total)}
                </span>
              </div>

              <div className="text-[11px] text-stone-500 pt-1 text-center bg-white/70 py-1 rounded-lg border border-stone-200/50">
                حالة الدفع:{" "}
                <span className="font-bold text-stone-800">
                  {order.paymentStatus === "PAID"
                    ? "تم السداد لدى الكاشير"
                    : order.paymentStatus === "CANCELLED"
                    ? "ملغي"
                    : "الدفع عند الكاشير داخل الصالة"}
                </span>
              </div>
            </div>

            {/* Audit Trail / Events Timeline */}
            <div className="space-y-3">
              <div className="flex items-center gap-1.5 border-b border-stone-200 pb-2">
                <History className="w-4 h-4 text-forest-700" />
                <h3 className="text-sm font-bold text-stone-900">سجل وتاريخ تغييرات الطلب</h3>
              </div>

              <div className="relative pr-4 space-y-4 before:absolute before:right-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200">
                {order.events && order.events.length > 0 ? (
                  order.events.map((ev, i) => {
                    const evBadge = getStatusBadgeInfo(ev.status);
                    return (
                      <div key={ev.id || i} className="relative pr-4">
                        <span
                          className={`absolute -right-4 top-1.5 w-3 h-3 rounded-full border-2 border-white ring-1 ring-stone-300 ${evBadge.dotClass}`}
                        />
                        <div className="bg-stone-50 p-2.5 rounded-xl border border-stone-200 text-xs space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-stone-900">{evBadge.label}</span>
                            <span className="text-[11px] text-stone-400 font-mono" dir="ltr">
                              {formatArabicTimeOnly(ev.timestamp)}
                            </span>
                          </div>
                          <div className="text-stone-600 text-[11px]">
                            بواسطة: <span className="font-semibold text-stone-800">{ev.actor}</span>
                          </div>
                          {ev.note && (
                            <div className="text-stone-500 text-[11px] bg-white p-1.5 rounded border border-stone-200/60 mt-1">
                              {ev.note}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-stone-400">لا يوجد سجل تاريخي لهذا الطلب.</div>
                )}
              </div>
            </div>
          </div>

          {/* Drawer Footer - Action Button */}
          <div className="p-4 sm:p-5 border-t border-stone-200 bg-stone-50/80">
            {actionConfig ? (
              <button
                type="button"
                onClick={() => onUpdateStatus(order.id, actionConfig.nextStatus)}
                disabled={isUpdating}
                className={`w-full py-3.5 px-4 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99] cursor-pointer ${actionConfig.buttonClass}`}
              >
                {isUpdating ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  actionConfig.icon
                )}
                <span className="font-extrabold text-white text-sm">{actionConfig.label}</span>
              </button>
            ) : (
              <div className="w-full py-3 text-center text-xs font-bold text-stone-500 bg-white rounded-xl border border-stone-200">
                {order.status === "SERVED"
                  ? "اكتمل هذا الطلب وتم تقديمه للعميل بنجاح"
                  : "هذا الطلب ملغي ولا توجد إجراءات إضافية مطلوبة"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
