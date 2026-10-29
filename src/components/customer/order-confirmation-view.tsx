"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Order, OrderStatus } from "@/types/order";
import { Restaurant } from "@/types/restaurant";
import { RestaurantTable } from "@/types/table";
import { orderRepository } from "@/repositories/order-repository";
import { OrderStatusTimeline } from "@/components/customer/order-status-timeline";
import { PriceDisplay } from "@/components/shared/price-display";
import { DemoNotice } from "@/components/shared/demo-notice";
import { formatCurrency, formatArabicDateTime, getOrderStatusLabel } from "@/lib/formatters";
import {
  CheckCircle2,
  UtensilsCrossed,
  MapPin,
  Clock,
  Banknote,
  Receipt,
  FileCheck,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";

interface OrderConfirmationViewProps {
  initialOrder: Order | null;
  orderId: string;
  restaurant: Restaurant;
  table?: RestaurantTable | null;
  restaurantSlug: string;
  tableToken?: string;
  orderType?: "DINE_IN" | "TAKEAWAY";
}

export const OrderConfirmationView: React.FC<OrderConfirmationViewProps> = ({
  initialOrder,
  orderId,
  restaurant,
  table,
  restaurantSlug,
  tableToken,
  orderType,
}) => {
  const [order, setOrder] = useState<Order | null>(initialOrder);
  const [isLoading, setIsLoading] = useState(!initialOrder);

  // Load from client-side order repository if not passed from server
  useEffect(() => {
    if (!order) {
      setIsLoading(true);
      orderRepository.getOrderById(orderId).then((found) => {
        setOrder(found);
        setIsLoading(false);
      });
    }
  }, [order, orderId]);

  // Persist active order in localStorage for continuous tracking
  useEffect(() => {
    if (!order) return;
    try {
      localStorage.setItem(
        "smart_restaurant_active_order_v1",
        JSON.stringify({
          orderId: order.id,
          orderNumber: order.orderNumber,
          restaurantSlug,
          tableToken,
          status: order.status,
          updatedAt: new Date().toISOString(),
        })
      );
    } catch {
      // Ignore localStorage errors
    }
  }, [order, restaurantSlug, tableToken]);

  // Subscribe to real-time status updates from staff dashboard (WebSocket + Heartbeat poll)
  useEffect(() => {
    if (!orderId) return;

    // 1. Instant WebSocket push
    const unsubscribe = orderRepository.subscribeToOrders((event) => {
      if (event && event.order && event.order.id === orderId) {
        setOrder((prev) => {
          if (!prev || prev.status !== event.order.status) {
            return event.order;
          }
          return prev;
        });

        if (event.type === "UPDATED") {
          toast.info(`تحديث تلقائي: حالة الطلب أصبحت "${getOrderStatusLabel(event.order.status)}"`);
        } else if (event.type === "CANCELLED") {
          toast.error("تم إلغاء هذا الطلب");
        }
      }
    });

    // 2. Continuous 3-second heartbeat poll to guarantee zero-refresh tracking
    const pollInterval = setInterval(async () => {
      try {
        const latest = await orderRepository.getOrderById(orderId);
        if (latest) {
          setOrder((prev) => {
            if (!prev || prev.status !== latest.status) {
              return latest;
            }
            return prev;
          });
        }
      } catch {
        // Silently ignore background poll errors
      }
    }, 3000);

    return () => {
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, [orderId]);

  // Handle simulating status change for demonstration
  const handleSimulateStatus = async (newStatus: OrderStatus) => {
    if (!order) return;
    if (order.status === newStatus) return; // Ignore transition to same status
    try {
      const updated = await orderRepository.updateOrderStatus(order.id, newStatus);
      if (updated) {
        setOrder(updated);
        toast.info(`تم تحديث حالة الطلب إلى: ${getOrderStatusLabel(newStatus)}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "تعذر تحديث حالة الطلب";
      toast.error(msg);
    }
  };

  const isTakeawayOrder = orderType === "TAKEAWAY" || order?.orderType === "TAKEAWAY" || !tableToken;
  const menuUrl = tableToken
    ? `/r/${restaurantSlug}/t/${tableToken}`
    : `/r/${restaurantSlug}/takeaway`;

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center" dir="rtl">
        <div className="w-10 h-10 border-4 border-forest-800 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm font-semibold text-stone-600">جاري تحميل بيانات الطلب...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center" dir="rtl">
        <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <Receipt className="w-8 h-8" />
        </div>
        <h2 className="text-lg font-bold text-stone-900 mb-1">لم يتم العثور على الطلب</h2>
        <p className="text-sm text-stone-500 mb-6 max-w-sm mx-auto">
          تعذر العثور على طلب بالرقم &quot;{orderId}&quot;. ربما تم مسح بيانات التخزين المؤقت للمتصفح.
        </p>
        <Link
          href={menuUrl}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-forest-800 text-white font-bold text-sm shadow-soft hover:bg-forest-900 transition-colors"
        >
          <UtensilsCrossed className="w-4 h-4" />
          <span>العودة إلى قائمة الطعام</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 sm:py-8 space-y-6 pb-24" dir="rtl">
      {/* Success Celebration Banner */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 mb-1 shadow-soft ring-4 ring-emerald-50">
          <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
        </div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-stone-900">
          تم استلام طلبك بنجاح!
        </h1>
        <p className="text-xs sm:text-sm text-stone-600">
          شكراً لطلبك في <strong>{restaurant.name}</strong> • رقم الطلب:{" "}
          <span className="font-bold text-forest-900 bg-white px-2 py-0.5 rounded-md border border-stone-200 font-mono">
            {order.orderNumber}
          </span>
        </p>
      </div>

      {/* Live Order Timeline */}
      <OrderStatusTimeline
        currentStatus={order.status}
        onSimulateStatusChange={handleSimulateStatus}
      />

      {/* Table & Order Metadata Card */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3.5 rounded-2xl bg-white border border-stone-200/80 shadow-xs flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isTakeawayOrder
                ? "bg-amber-50 text-amber-800"
                : "bg-forest-50 text-forest-800"
            }`}
          >
            {isTakeawayOrder ? <ShoppingBag className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
          </div>
          <div>
            <div className="text-[11px] text-stone-400">
              {isTakeawayOrder ? "نوع الطلب" : "الطاولة المحددة"}
            </div>
            <div className="text-xs sm:text-sm font-bold text-stone-800">
              {isTakeawayOrder
                ? "Take Away • سفري"
                : (order.tableNameSnapshot || table?.name || "طاولة في الصالة")}
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-stone-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-forest-50 text-forest-800 flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-stone-400">وقت تسجيل الطلب</div>
            <div className="text-xs sm:text-sm font-bold text-stone-800">
              {formatArabicDateTime(order.createdAt)}
            </div>
          </div>
        </div>
      </div>

      {/* Itemized Order Receipt Snapshot */}
      <div className="bg-white rounded-2xl border border-stone-200/90 p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-forest-800" />
            <h3 className="text-sm font-bold text-stone-900">تفاصيل الأصناف والكميات</h3>
          </div>
          <span className="text-xs text-stone-500 font-medium">
            {order.items.reduce((s, i) => s + i.quantity, 0)} عناصر
          </span>
        </div>

        {/* Items List */}
        <div className="divide-y divide-stone-100 space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="pt-3 first:pt-0 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="w-6 h-6 rounded-md bg-forest-50 text-forest-800 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {item.quantity}x
                  </span>
                  <h4 className="text-sm font-bold text-stone-900">
                    {item.productNameSnapshot}
                  </h4>
                </div>

                {/* Selected Options */}
                {item.selectedOptions && item.selectedOptions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 pr-8">
                    {item.selectedOptions.map((opt, idx) => (
                      <span
                        key={idx}
                        className="text-[11px] text-stone-600 bg-stone-50 px-2 py-0.5 rounded border border-stone-200"
                      >
                        {opt.optionNameAr}
                        {opt.priceDelta > 0 && ` (+${opt.priceDelta} ج.م)`}
                      </span>
                    ))}
                  </div>
                )}

                {/* Notes */}
                {item.notes && (
                  <p className="text-[11px] text-amber-800 bg-amber-50/70 rounded px-2 py-0.5 mt-1 pr-2 mr-8">
                    ملاحظة: {item.notes}
                  </p>
                )}
              </div>

              {/* Line Price */}
              <div className="text-left font-bold text-sm text-stone-800 whitespace-nowrap pt-0.5">
                {formatCurrency(item.lineTotal)}
              </div>
            </div>
          ))}
        </div>

        {/* Bill Totals Summary */}
        <div className="pt-4 border-t border-stone-200 space-y-2 text-sm text-stone-600">
          <div className="flex items-center justify-between">
            <span>المجموع الفرعي</span>
            <span className="font-semibold text-stone-800">
              {formatCurrency(order.subtotal)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-stone-400">
            <span>الضريبة والخدمة</span>
            <span>شاملة في الأسعار</span>
          </div>
          <div className="pt-2 border-t border-stone-200 flex items-center justify-between">
            <span className="text-base font-bold text-stone-900">الإجمالي النهائي</span>
            <PriceDisplay amount={order.total} size="xl" />
          </div>
        </div>
      </div>

      {/* Payment Instruction Banner */}
      <div className="p-4 rounded-2xl bg-cream-200/80 border border-cream-300 text-stone-800 flex items-start gap-3">
        <Banknote className="w-5 h-5 text-forest-800 flex-shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm space-y-0.5">
          <p className="font-bold text-stone-900">طريقة الدفع والتسوية:</p>
          <p className="text-stone-700">
            الدفع عند الكاشير داخل المطعم. أظهر رقم الطلب <strong>({order.orderNumber})</strong> لمسؤول الحسابات عند المغادرة.
          </p>
        </div>
      </div>

      {/* Demo Notice */}
      <DemoNotice />

      {/* Back to menu action button */}
      <div className="pt-2 text-center">
        <Link
          href={menuUrl}
          className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-forest-800 hover:bg-forest-900 text-white font-bold text-sm shadow-soft transition-all"
        >
          <UtensilsCrossed className="w-4 h-4" />
          <span>الرجوع إلى قائمة الطعام وطلب المزيد</span>
        </Link>
      </div>
    </div>
  );
};
