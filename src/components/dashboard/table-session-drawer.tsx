"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Order } from "@/types/order";
import { RestaurantTable } from "@/types/table";
import { orderRepository } from "@/repositories/order-repository";
import { tableRepository } from "@/repositories/table-repository";
import { useAuth } from "@/context/auth-context";
import { formatCurrency, formatArabicTimeOnly } from "@/lib/formatters";
import { getStatusBadgeInfo, formatElapsedTimeArabic } from "@/lib/order-workflow";
import {
  X,
  MapPin,
  Clock,
  Layers,
  Receipt,
  Loader2,
  RefreshCw,
  Eye,
  Info,
  DollarSign,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

interface TableSessionDrawerProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectOrder?: (order: Order) => void;
  onSessionClosed?: () => void;
}

export const TableSessionDrawer: React.FC<TableSessionDrawerProps> = ({
  order,
  isOpen,
  onClose,
  onSelectOrder,
  onSessionClosed,
}) => {
  const { user } = useAuth();
  const [table, setTable] = useState<RestaurantTable | null>(null);
  const [sessionOrders, setSessionOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isClosingSession, setIsClosingSession] = useState<boolean>(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState<boolean>(false);
  const [overrideActive, setOverrideActive] = useState<boolean>(false);
  const [closeNotes, setCloseNotes] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check role authorization for session closure: SUPERVISOR, MANAGER, ADMIN
  const canCloseSession =
    user?.role === "MANAGER" ||
    user?.role === "SUPERVISOR" ||
    (user as unknown as { role?: string })?.role === "ADMIN";

  const isManagerOrAdmin =
    user?.role === "MANAGER" ||
    (user as unknown as { role?: string })?.role === "ADMIN";

  const loadSessionData = useCallback(async () => {
    if (!order) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      // 1. Fetch table details
      const tableData = await tableRepository.getTableById(order.tableId);
      setTable(tableData);

      // 2. Fetch orders belonging to the session
      if (order.sessionId) {
        // True backend session linkage
        const orders = await orderRepository.getOrdersBySession(order.sessionId);
        setSessionOrders(orders.length > 0 ? orders : [order]);
      } else {
        // Session ID not present in order - avoid fabricating fake groupings
        setSessionOrders([order]);
      }
    } catch (err: unknown) {
      console.error("Failed to load session data:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "تعذر جلب تفاصيل جلسة الطاولة"
      );
    } finally {
      setIsLoading(false);
    }
  }, [order]);

  useEffect(() => {
    if (isOpen && order) {
      loadSessionData();
      setShowCloseConfirm(false);
      setOverrideActive(false);
      setCloseNotes("");
    }
  }, [isOpen, order, loadSessionData]);

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

  // Calculate session financial totals
  const totalAmount = sessionOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const paidOrders = sessionOrders.filter((o) => o.paymentStatus === "PAID");
  const paidAmount = paidOrders.reduce((sum, o) => sum + (o.total || 0), 0);
  const pendingAmount = sessionOrders
    .filter((o) => o.paymentStatus !== "PAID" && o.status !== "CANCELLED")
    .reduce((sum, o) => sum + (o.total || 0), 0);

  // Active orders check
  const activeOrders = sessionOrders.filter((o) =>
    ["NEW", "CONFIRMED", "PREPARING", "READY"].includes(o.status)
  );
  const hasActiveOrders = activeOrders.length > 0;

  // Session details from table or order
  const sessionStatus = table?.currentSession?.status || (order.sessionId ? "OPEN" : "UNKNOWN");
  const sessionStartTime = table?.currentSession?.openedAt || order.createdAt;

  const handleCloseSession = async () => {
    if (!table) return;
    const targetSessionId = order.sessionId || table.currentSession?.id;
    if (!targetSessionId) {
      toast.error("لا يمكن إنهاء الجلسة: لا يوجد معرف جلسة صالح لهذه الطاولة");
      return;
    }

    try {
      setIsClosingSession(true);
      setErrorMessage(null);

      await tableRepository.closeTableSession(
        table.id,
        targetSessionId,
        overrideActive,
        closeNotes || "تم إنهاء الجلسة من لوحة المتابعة"
      );

      toast.success(`تم إنهاء جلسة ${table.name} بنجاح`);
      setShowCloseConfirm(false);
      onSessionClosed?.();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل إنهاء الجلسة";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsClosingSession(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden font-cairo"
      dir="rtl"
      aria-labelledby="session-drawer-title"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-200"
      />

      <div className="fixed inset-y-0 left-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-screen max-w-lg bg-white shadow-2xl flex flex-col border-r border-stone-200 animate-in slide-in-from-left duration-200">
          {/* Header */}
          <div className="p-4 sm:p-5 bg-forest-900 text-cream-100 flex items-center justify-between border-b border-forest-800">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-forest-800 flex items-center justify-center text-cream-200 shadow-inner">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h2 id="session-drawer-title" className="text-sm sm:text-base font-extrabold text-white">
                  جلسة طاولة الضيوف والطلبات
                </h2>
                <div className="flex items-center gap-2 text-xs text-cream-300 mt-0.5">
                  <span className="font-bold flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {order.tableName || order.tableNameSnapshot}
                  </span>
                  {table?.sectionNameAr && (
                    <>
                      <span>•</span>
                      <span>{table.sectionNameAr}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-forest-800/80 hover:bg-forest-800 text-cream-200 hover:text-white transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-stone-500 space-y-2">
                <Loader2 className="w-8 h-8 animate-spin text-forest-700" />
                <p className="text-xs font-bold">جاري تحميل بيانات الجلسة والطلبات المرتبطة...</p>
              </div>
            ) : (
              <>
                {/* Session Identification & Metadata Card */}
                <div className="p-4 rounded-2xl bg-cream-50 border border-stone-200/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-600 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-forest-700" />
                      <span>حالة الجلسة الحالية:</span>
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold border ${
                        sessionStatus === "OPEN"
                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                          : sessionStatus === "CLOSED"
                          ? "bg-stone-100 text-stone-700 border-stone-200"
                          : "bg-amber-50 text-amber-800 border-amber-200"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          sessionStatus === "OPEN" ? "bg-emerald-600" : "bg-stone-400"
                        }`}
                      />
                      <span>{sessionStatus === "OPEN" ? "جلسة مفتوحة" : sessionStatus === "CLOSED" ? "جلسة مغلقة" : "غير محددة"}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-cream-200/80">
                    <div>
                      <span className="text-stone-500 block text-[11px]">معرّف الجلسة (Session ID):</span>
                      <span className="font-mono font-bold text-stone-800 text-[11px] truncate block" dir="ltr" title={order.sessionId || "غير مسجل"}>
                        {order.sessionId ? order.sessionId.slice(0, 16) + "..." : "غير مرتبط بجلسة"}
                      </span>
                    </div>

                    <div>
                      <span className="text-stone-500 block text-[11px]">بدء الجلسة:</span>
                      <span className="font-bold text-stone-800 text-[11px]">
                        {sessionStartTime ? formatArabicTimeOnly(sessionStartTime) : "—"} ({formatElapsedTimeArabic(sessionStartTime)})
                      </span>
                    </div>
                  </div>

                  {/* Informative notice if session ID is absent */}
                  {!order.sessionId && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/80 text-[11px] text-amber-900 flex items-start gap-2">
                      <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="leading-relaxed">
                        هذا الطلب مسجل بدون معرف جلسة مباشر (Session ID) من الباك إند. لتجنب خلط الجلسات المتتالية على نفس الطاولة، يتم عرض الطلب المنفرد فقط.
                      </p>
                    </div>
                  )}
                </div>

                {/* Session Financial Summary & Payment Separation */}
                <div className="p-4 rounded-2xl bg-white border border-stone-200/90 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                    <span className="text-xs font-extrabold text-stone-800 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-forest-700" />
                      <span>الملخص المالي للجلسة</span>
                    </span>
                    <span className="text-[11px] font-bold text-stone-500">
                      {sessionOrders.length} {sessionOrders.length === 1 ? "طلب" : "طلبات"}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-stone-600">
                      <span>إجمالي قيمة طلبات الجلسة:</span>
                      <span className="font-extrabold text-forest-950 font-mono text-sm">
                        {formatCurrency(totalAmount)}
                      </span>
                    </div>

                    <div className="flex justify-between text-stone-600">
                      <span>المسدد لدى الكاشير:</span>
                      <span className="font-bold text-emerald-700 font-mono">
                        {formatCurrency(paidAmount)}
                      </span>
                    </div>

                    <div className="flex justify-between text-stone-600">
                      <span>المتبقي بانتظار السداد:</span>
                      <span className="font-bold text-amber-700 font-mono">
                        {formatCurrency(pendingAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Strict Payment Note */}
                  <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70 text-[11px] text-stone-600 leading-relaxed">
                    <strong className="text-stone-800">ملاحظة محاسبية:</strong> يتم تحصيل الحساب لدى الكاشير. حالة تقديم الوجبات (SERVED) منفصلة تماماً عن حالة الدفع الفعلي.
                  </div>
                </div>

                {/* Orders List belonging to this session */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold text-stone-800 flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-forest-700" />
                      <span>قائمة الطلبات المرتبطة بالجلسة ({sessionOrders.length}):</span>
                    </h3>
                  </div>

                  <div className="space-y-2">
                    {sessionOrders.map((o) => {
                      const badge = getStatusBadgeInfo(o.status);
                      const isCurrentOrder = o.id === order.id;
                      const itemCount = o.items.reduce((sum, it) => sum + it.quantity, 0);

                      return (
                        <div
                          key={o.id}
                          className={`p-3.5 rounded-2xl border transition-all ${
                            isCurrentOrder
                              ? "bg-forest-50/40 border-forest-300 ring-1 ring-forest-200"
                              : "bg-white border-stone-200/80 hover:border-stone-300"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded-lg border border-stone-200" dir="ltr">
                                #{o.orderNumber}
                              </span>
                              {isCurrentOrder && (
                                <span className="text-[10px] bg-forest-900 text-white font-bold px-1.5 py-0.2 rounded-md">
                                  الطلب الحالي
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.2 rounded-md text-[11px] font-bold border ${badge.badgeClass}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${badge.dotClass}`} />
                                <span>{badge.label}</span>
                              </span>
                            </div>
                          </div>

                          {/* Items and Time */}
                          <div className="flex items-center justify-between text-xs text-stone-500 mt-2 pt-2 border-t border-stone-100">
                            <div>
                              <span>{itemCount} أصناف</span>
                              <span className="mx-1.5">•</span>
                              <span>{formatArabicTimeOnly(o.createdAt)}</span>
                            </div>

                            <div className="font-extrabold text-stone-900 font-mono">
                              {formatCurrency(o.total)}
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="mt-2.5 pt-2 border-t border-stone-100 flex items-center justify-end gap-2">
                            <Link
                              href={`/orders/${o.id}`}
                              onClick={onClose}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-bold transition-colors"
                            >
                              <Eye className="w-3 h-3 text-stone-600" />
                              <span>متابعة الطلب</span>
                            </Link>

                            {onSelectOrder && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectOrder(o);
                                  onClose();
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-forest-50 hover:bg-forest-100 text-forest-900 text-[11px] font-bold border border-forest-200 transition-colors cursor-pointer"
                              >
                                <span>عرض الفاتورة</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Session Closure Section (Authorized Staff Only) */}
                {canCloseSession && sessionStatus === "OPEN" && (
                  <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4 text-amber-700" />
                        <span>إدارة وإنهاء الجلسة</span>
                      </span>
                      <span className="text-[10px] text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full font-bold">
                        صلاحية: مشرف / مدير
                      </span>
                    </div>

                    <p className="text-[11px] text-amber-900 leading-relaxed">
                      إنهاء الجلسة يغلق دورة الضيوف الحالية على الطاولة في قاعدة البيانات. لا يتم اعتبار الطاولة جاهزة أو نظيفة تلقائياً، حيث تظل في مرحلة التنظيف حتى يتم إتاحتها.
                    </p>

                    {errorMessage && (
                      <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
                        {errorMessage}
                      </div>
                    )}

                    {!showCloseConfirm ? (
                      <button
                        type="button"
                        onClick={() => setShowCloseConfirm(true)}
                        className="w-full py-2.5 px-4 rounded-xl bg-amber-700 hover:bg-amber-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                      >
                        إنهاء وإغلاق الجلسة
                      </button>
                    ) : (
                      <div className="p-3 bg-white rounded-xl border border-amber-300 space-y-2.5 animate-in fade-in">
                        <p className="text-xs font-bold text-stone-800">
                          هل أنت متأكد من إنهاء جلسة {table?.name || order.tableName}؟
                        </p>

                        {hasActiveOrders && (
                          <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px] space-y-1">
                            <p className="font-bold">
                              تحذير: يوجد {activeOrders.length} طلبات قيد التحضير أو التقديم!
                            </p>
                            <p>
                              وفقاً لضوابط النظام، يجب تقديم جميع الطلبات أو إلغاؤها أولاً قبل إغلاق الجلسة.
                            </p>
                            {isManagerOrAdmin && (
                              <label className="flex items-center gap-2 pt-1 font-bold text-rose-950 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={overrideActive}
                                  onChange={(e) => setOverrideActive(e.target.checked)}
                                  className="rounded text-rose-600 focus:ring-rose-500"
                                />
                                <span>تجاوز استثنائي مصرح (بصفتك مدير)</span>
                              </label>
                            )}
                          </div>
                        )}

                        <input
                          type="text"
                          value={closeNotes}
                          onChange={(e) => setCloseNotes(e.target.value)}
                          placeholder="ملاحظات إغلاق الجلسة (اختياري)..."
                          className="w-full text-xs p-2 rounded-lg border border-stone-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setShowCloseConfirm(false)}
                            className="px-3 py-1.5 rounded-lg border border-stone-200 text-stone-600 text-xs font-bold hover:bg-stone-50 cursor-pointer"
                          >
                            إلغاء
                          </button>

                          <button
                            type="button"
                            onClick={handleCloseSession}
                            disabled={isClosingSession || (hasActiveOrders && !overrideActive)}
                            className="px-4 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                          >
                            {isClosingSession && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            <span>تأكيد الإغلاق</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between">
            <button
              type="button"
              onClick={loadSessionData}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-100 text-stone-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-forest-700" : ""}`} />
              <span>تحديث الجلسة</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-forest-900 hover:bg-forest-950 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
