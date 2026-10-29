"use client";

import React, { useState, useEffect, use, useCallback } from "react";
import Link from "next/link";
import { Order, OrderStatus, OrderEvent } from "@/types/order";
import { orderRepository, OrderSubscriptionEvent } from "@/repositories/order-repository";
import {
  formatCurrency,
  formatArabicDateTime,
  formatArabicTimeOnly,
} from "@/lib/formatters";
import {
  getStatusBadgeInfo,
  formatElapsedTimeArabic,
  isOrderCancellable,
  isOrderDelayed,
} from "@/lib/order-workflow";
import { OrderCancelModal } from "@/components/dashboard/order-cancel-modal";
import { OrderReceiptModal } from "@/components/dashboard/order-receipt-modal";
import { TableSessionDrawer } from "@/components/dashboard/table-session-drawer";
import {
  ArrowRight,
  Printer,
  Ban,
  Check,
  History,
  Receipt,
  MessageSquareQuote,
  ClockAlert,
  Loader2,
  RefreshCw,
  AlertCircle,
  Clock,
  Sparkles,
  ChefHat,
  BellRing,
  Utensils,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Layers,
} from "lucide-react";
import { AuthGuard } from "@/components/dashboard/auth-guard";
import { toast } from "sonner";

interface PageProps {
  params: Promise<{
    orderId: string;
  }>;
}

// Standard restaurant lifecycle stages in order
const LIFECYCLE_STAGES: { status: OrderStatus; label: string; icon: React.ReactNode }[] = [
  { status: "NEW", label: "جديد", icon: <Sparkles className="w-4 h-4" /> },
  { status: "CONFIRMED", label: "تم التأكيد", icon: <Check className="w-4 h-4" /> },
  { status: "PREPARING", label: "قيد التحضير", icon: <ChefHat className="w-4 h-4" /> },
  { status: "READY", label: "جاهز للتقديم", icon: <BellRing className="w-4 h-4" /> },
  { status: "SERVED", label: "تم التقديم", icon: <Utensils className="w-4 h-4" /> },
];

export default function OrderDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const orderId = resolvedParams.orderId;

  const [order, setOrder] = useState<Order | null>(null);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  const [isSessionDrawerOpen, setIsSessionDrawerOpen] = useState<boolean>(false);

  const fetchOrderData = useCallback(
    async (isManualRefresh = false) => {
      try {
        if (isManualRefresh) setIsRefreshing(true);
        const [foundOrder, foundEvents] = await Promise.all([
          orderRepository.getOrderById(orderId),
          orderRepository.getOrderEvents(orderId),
        ]);

        if (foundOrder) {
          setOrder(foundOrder);
          // Prefer dedicated events if available, otherwise order.events
          if (foundEvents && foundEvents.length > 0) {
            setEvents(foundEvents);
          } else if (foundOrder.events && foundOrder.events.length > 0) {
            setEvents(foundOrder.events);
          }
        }
      } catch (err) {
        console.error("Failed to fetch order:", err);
        if (isManualRefresh) toast.error("تعذر تحديث بيانات الطلب");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [orderId]
  );

  useEffect(() => {
    fetchOrderData();
  }, [fetchOrderData]);

  // Live WebSocket update subscription
  useEffect(() => {
    const unsubscribe = orderRepository.subscribeToOrders((ev: OrderSubscriptionEvent) => {
      if (ev.order && ev.order.id === orderId) {
        setOrder(ev.order);
        if (ev.order.events && ev.order.events.length > 0) {
          setEvents(ev.order.events);
        }
        toast.info(`تم تحديث حالة الطلب #${ev.order.orderNumber}`, {
          description: `الحالة الحالية: ${getStatusBadgeInfo(ev.order.status).label}`,
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [orderId]);

  // Periodic silent background poll (every 4 seconds) to guarantee real-time sync
  useEffect(() => {
    const timer = setInterval(() => {
      fetchOrderData(false);
    }, 4000);
    return () => clearInterval(timer);
  }, [fetchOrderData]);

  const handleUpdateStatus = async (nextStatus: OrderStatus) => {
    if (!order) return;
    try {
      setIsUpdating(true);
      const updated = await orderRepository.updateOrderStatus(
        order.id,
        nextStatus,
        "الكابتن أحمد (مشرف الصالة)"
      );
      if (updated) {
        setOrder(updated);
        if (updated.events && updated.events.length > 0) {
          setEvents(updated.events);
        }
        toast.success(`تم تحديث حالة الطلب #${updated.orderNumber} بنجاح`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "تعذر تحديث الحالة";
      toast.error(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConfirmCancel = async (id: string, reason: string) => {
    try {
      setIsUpdating(true);
      const updated = await orderRepository.cancelOrder(
        id,
        reason,
        "الكابتن أحمد (مشرف الصالة)"
      );
      if (updated) {
        setOrder(updated);
        if (updated.events && updated.events.length > 0) {
          setEvents(updated.events);
        }
        toast.error(`تم إلغاء الطلب #${updated.orderNumber}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "تعذر إلغاء الطلب";
      toast.error(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4" dir="rtl">
        <RefreshCw className="w-8 h-8 animate-spin text-forest-700 mb-2" />
        <p className="text-sm font-bold text-stone-600">جاري تحميل تفاصيل الطلب وتاريخ الحالات...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4 font-cairo" dir="rtl">
        <div className="bg-white p-8 rounded-3xl border border-stone-200 text-center max-w-md w-full space-y-4 shadow-sm">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-stone-900">الطلب غير موجود</h2>
          <p className="text-xs text-stone-500">
            لم يتم العثور على هذا الطلب في قاعدة بيانات المطعم أو قد تم حذفه.
          </p>
          <Link
            href="/orders"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-forest-900 text-white text-xs font-bold hover:bg-forest-950 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة لشاشة الطلبات الواردة</span>
          </Link>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusBadgeInfo(order.status);
  const isDelayed = isOrderDelayed(order.createdAt, order.status);
  const isCancelled = order.status === "CANCELLED";

  // Identify next action button config
  const getActionConfig = (status: OrderStatus) => {
    switch (status) {
      case "NEW":
        return {
          nextStatus: "CONFIRMED" as OrderStatus,
          label: "تأكيد واستلام الطلب",
          buttonClass: "bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white shadow-sm border border-amber-600/30",
        };
      case "CONFIRMED":
        return {
          nextStatus: "PREPARING" as OrderStatus,
          label: "إرسال للمطبخ وبدء التحضير",
          buttonClass: "bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm border border-blue-700/30",
        };
      case "PREPARING":
        return {
          nextStatus: "READY" as OrderStatus,
          label: "إشعار بأن الوجبة جاهزة للتقديم",
          buttonClass: "bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white shadow-sm border border-purple-700/30",
        };
      case "READY":
        return {
          nextStatus: "SERVED" as OrderStatus,
          label: "تأكيد تقديم الوجبة للعميل",
          buttonClass: "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-sm border border-emerald-700/30",
        };
      default:
        return null;
    }
  };

  const actionConfig = getActionConfig(order.status);
  const totalItemsCount = order.items.reduce((sum, it) => sum + it.quantity, 0);

  // Cancellation details if cancelled
  const cancelEvent = events.find((ev) => ev.status === "CANCELLED");

  // Lifecycle progression index
  const stageOrderMap: Record<OrderStatus, number> = {
    NEW: 0,
    CONFIRMED: 1,
    PREPARING: 2,
    READY: 3,
    SERVED: 4,
    CANCELLED: -1,
  };
  const currentStageIndex = stageOrderMap[order.status] ?? -1;

  return (
    <AuthGuard>
      <div className="min-h-screen bg-stone-100 font-cairo text-stone-900 flex flex-col" dir="rtl">
        {/* Sticky Header */}
        <header className="bg-white border-b border-stone-200 sticky top-0 z-20 shadow-2xs">
          <div className="max-w-5xl mx-auto px-4 py-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link
                href="/orders"
                className="p-2 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-100 transition-colors"
                title="العودة لشاشة الطلبات"
              >
                <ArrowRight className="w-4 h-4" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-mono text-base sm:text-lg font-extrabold text-stone-900" dir="ltr">
                    #{order.orderNumber}
                  </h1>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold border ${statusInfo.badgeClass}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                    <span>{statusInfo.label}</span>
                  </span>
                  {isDelayed && !isCancelled && order.status !== "SERVED" && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                      <ClockAlert className="w-3 h-3 text-rose-600" />
                      <span>متأخر</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-stone-500 mt-0.5 flex-wrap">
                  <span className="font-bold text-stone-700 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-forest-700" />
                    {order.tableName || order.tableNameSnapshot}
                  </span>
                  <span>•</span>
                  {order.sessionId ? (
                    <>
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 font-mono text-[11px] text-stone-700 border border-stone-200"
                        title="معرف جلسة الضيوف"
                      >
                        <Layers className="w-3 h-3 text-stone-500" />
                        <span>جلسة: {order.sessionId.slice(0, 8)}...</span>
                      </span>
                      <span>•</span>
                    </>
                  ) : (
                    <>
                      <span className="text-[11px] text-stone-400">بدون جلسة مخصصة</span>
                      <span>•</span>
                    </>
                  )}
                  <span>تم الإنشاء: {formatArabicDateTime(order.createdAt)}</span>
                  <span>({formatElapsedTimeArabic(order.createdAt)})</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fetchOrderData(true)}
                disabled={isRefreshing}
                className="p-2 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700 text-xs font-bold transition-colors"
                title="تحديث البيانات لحظياً"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-forest-700" : ""}`} />
              </button>

              <button
                type="button"
                onClick={() => setIsSessionDrawerOpen(true)}
                className="px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-950 text-xs font-bold flex items-center gap-1.5 transition-colors"
                title="عرض جميع طلبات جلسة هذه الطاولة"
              >
                <Layers className="w-3.5 h-3.5 text-amber-700" />
                <span className="hidden sm:inline">طلبات الترابيزة</span>
              </button>

              <button
                type="button"
                onClick={() => setIsReceiptModalOpen(true)}
                className="px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-800 text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">طباعة البون</span>
              </button>

              {isOrderCancellable(order.status) && (
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(true)}
                  className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Ban className="w-3.5 h-3.5" />
                  <span>إلغاء الطلب</span>
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Main Tracking Content */}
        <main className="max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6 flex-1">
          {/* Order Lifecycle Progress Bar */}
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200/90 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-forest-700" />
                <h2 className="text-sm font-extrabold text-stone-900">متابعة مراحل الطلب (Order Tracking)</h2>
              </div>
              <div className="text-xs text-stone-500">
                آخر تحديث: <span className="font-mono text-stone-800">{formatArabicTimeOnly(order.updatedAt || order.createdAt)}</span>
              </div>
            </div>

            {isCancelled ? (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-extrabold text-rose-900">تم إلغاء هذا الطلب</h3>
                  <p className="text-xs text-rose-700">
                    سبب الإلغاء: <span className="font-bold">{cancelEvent?.note || "تم الإلغاء بواسطة الإدارة"}</span>
                  </p>
                  <p className="text-[11px] text-rose-600">
                    تم بواسطة: {cancelEvent?.actor || "مشرف الصالة"} • وقت الإلغاء: {cancelEvent ? formatArabicDateTime(cancelEvent.timestamp) : formatArabicDateTime(order.updatedAt)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative pt-2 pb-1">
                {/* Visual Stepper */}
                <div className="grid grid-cols-5 gap-2 relative">
                  {LIFECYCLE_STAGES.map((stage, idx) => {
                    const isCompleted = currentStageIndex > idx;
                    const isCurrent = currentStageIndex === idx;
                    const isPending = currentStageIndex < idx;

                    // Match actual timestamp from backend events
                    const matchingEvent = events.find((e) => e.status === stage.status);

                    return (
                      <div key={stage.status} className="flex flex-col items-center text-center relative group">
                        {/* Step Icon / Circle */}
                        <div
                          className={`w-9 h-9 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center font-bold text-xs sm:text-sm transition-all shadow-xs ${
                            isCompleted
                              ? "bg-forest-900 text-white"
                              : isCurrent
                              ? "bg-amber-500 text-white ring-4 ring-amber-100 animate-pulse"
                              : "bg-stone-100 text-stone-400 border border-stone-200"
                          }`}
                        >
                          {isCompleted ? <CheckCircle2 className="w-5 h-5 text-white" /> : stage.icon}
                        </div>

                        {/* Step Label */}
                        <span
                          className={`mt-2 text-xs font-extrabold ${
                            isCurrent
                              ? "text-amber-800"
                              : isCompleted
                              ? "text-forest-900"
                              : "text-stone-400"
                          }`}
                        >
                          {stage.label}
                        </span>

                        {/* Step Timestamp if reached */}
                        {matchingEvent ? (
                          <span className="text-[10px] text-stone-500 font-mono mt-0.5" dir="ltr">
                            {formatArabicTimeOnly(matchingEvent.timestamp)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-stone-300 mt-0.5">
                            {isPending ? "في الانتظار" : "—"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Contextual Next Step Action Box */}
          {actionConfig && !isCancelled && (
            <div className="bg-white rounded-3xl p-5 border border-stone-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-extrabold text-stone-900">الإجراء التشغيلي التالي:</h3>
                <p className="text-xs text-stone-500">
                  الحالة الحالية هي &quot;{statusInfo.label}&quot;. انقر على الزر للتقدم بالمرحلة التالية.
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleUpdateStatus(actionConfig.nextStatus)}
                disabled={isUpdating}
                className={`py-3 px-6 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.98] ${actionConfig.buttonClass}`}
              >
                {isUpdating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>{actionConfig.label}</span>
              </button>
            </div>
          )}

          {/* Details Grid: Items (Left/Main) and Summary + Audit (Right/Side) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Items & Options Breakdown (2 cols on desktop) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200/90 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <h3 className="text-sm font-extrabold text-stone-900 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-forest-700" />
                    <span>أصناف الطلب ({totalItemsCount})</span>
                  </h3>
                  <span className="text-xs text-stone-400">سعر الوحدة والإضافات مسجلة</span>
                </div>

                <div className="space-y-3">
                  {order.items.map((item, index) => (
                    <div
                      key={item.id || index}
                      className="p-4 rounded-2xl bg-stone-50 border border-stone-200/70 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-baseline gap-2.5">
                          <span className="w-7 h-7 rounded-xl bg-forest-900 text-white font-extrabold text-xs flex items-center justify-center flex-shrink-0">
                            {item.quantity}×
                          </span>
                          <div>
                            <div className="text-sm font-extrabold text-stone-900">
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

                      {/* Selected Options / Addons */}
                      {item.selectedOptions && item.selectedOptions.length > 0 && (
                        <div className="pr-9 space-y-1">
                          <div className="text-[11px] font-bold text-stone-400">الخيارات والإضافات:</div>
                          <div className="flex flex-wrap gap-1.5">
                            {item.selectedOptions.map((opt, i) => (
                              <span
                                key={i}
                                className="text-xs px-2.5 py-0.5 rounded-lg bg-white border border-stone-200 text-stone-700 font-medium inline-flex items-center gap-1"
                              >
                                <span>{opt.optionNameAr}</span>
                                {opt.priceDelta > 0 && (
                                  <span className="text-[10px] text-forest-700 font-bold font-mono">
                                    (+{formatCurrency(opt.priceDelta)})
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Special Instructions Note */}
                      {item.notes && (
                        <div className="pr-9">
                          <div className="flex items-center gap-1.5 p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-medium">
                            <MessageSquareQuote className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                            <span>ملاحظات خاصة: {item.notes}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Financial Summary & Real Backend Audit History */}
            <div className="space-y-4">
              {/* Financial Calculation Box */}
              <div className="bg-white rounded-3xl p-5 border border-stone-200/90 shadow-xs space-y-3">
                <h3 className="text-sm font-extrabold text-stone-900 border-b border-stone-100 pb-2">
                  ملخص الحساب والفاتورة
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-stone-600">
                    <span>المجموع الفرعي:</span>
                    <span className="font-bold text-stone-800">{formatCurrency(order.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-stone-600">
                    <span>الضريبة والخدمة:</span>
                    <span className="text-stone-400">مشمولة في الأسعار</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-stone-200 text-stone-900 font-extrabold text-base">
                    <span>الإجمالي النهائي:</span>
                    <span className="text-lg text-forest-900">{formatCurrency(order.total)}</span>
                  </div>
                </div>

                <div className="text-[11px] text-stone-600 pt-1 text-center bg-stone-50 py-2 rounded-xl border border-stone-200/60">
                  حالة الدفع:{" "}
                  <span className="font-bold text-stone-900">
                    {order.paymentStatus === "PAID"
                      ? "تم الدفع بالكامل لدى الكاشير ✓"
                      : order.paymentStatus === "CANCELLED"
                      ? "ملغي"
                      : "بانتظار السداد لدى الكاشير"}
                  </span>
                </div>
              </div>

              {/* Status History Timeline (Real Backend Events) */}
              <div className="bg-white rounded-3xl p-5 border border-stone-200/90 shadow-xs space-y-3">
                <div className="flex items-center gap-1.5 border-b border-stone-100 pb-2">
                  <History className="w-4 h-4 text-forest-700" />
                  <h3 className="text-sm font-extrabold text-stone-900">سجل الأحداث والتدقيق</h3>
                </div>

                <div className="relative pr-3 space-y-3 before:absolute before:right-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-stone-200">
                  {events && events.length > 0 ? (
                    events.map((ev, i) => {
                      const evBadge = getStatusBadgeInfo(ev.status);
                      return (
                        <div key={ev.id || i} className="relative pr-4">
                          <span
                            className={`absolute -right-3 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white ring-1 ring-stone-300 ${evBadge.dotClass}`}
                          />
                          <div className="bg-stone-50 p-3 rounded-xl border border-stone-200/80 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-extrabold text-stone-900">{evBadge.label}</span>
                              <span className="text-[11px] text-stone-400 font-mono" dir="ltr">
                                {formatArabicTimeOnly(ev.timestamp)}
                              </span>
                            </div>
                            <div className="text-stone-500 text-[11px]">
                              بواسطة: <span className="font-bold text-stone-700">{ev.actor}</span>
                            </div>
                            {ev.note && (
                              <div className="text-stone-700 text-[11px] bg-white p-1.5 rounded-lg border border-stone-200/60 mt-1">
                                {ev.note}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-xs text-stone-400 py-2">لا يوجد سجل تاريخي مسجل</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Modals */}
        <OrderCancelModal
          order={order}
          isOpen={isCancelModalOpen}
          onClose={() => setIsCancelModalOpen(false)}
          onConfirmCancel={handleConfirmCancel}
          isCancelling={isUpdating}
        />

        <OrderReceiptModal
          order={order}
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          restaurantName="مطعم الزيتونة"
          branchName="فرع المعادي - القاهرة"
        />

        {/* Table Session Details Side Drawer */}
        <TableSessionDrawer
          order={order}
          isOpen={isSessionDrawerOpen}
          onClose={() => setIsSessionDrawerOpen(false)}
          onSessionClosed={() => fetchOrderData(true)}
        />
      </div>
    </AuthGuard>
  );
}
