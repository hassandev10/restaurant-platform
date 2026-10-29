"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Order, OrderStatus } from "@/types/order";
import { orderRepository } from "@/repositories/order-repository";
import { getOrderStatusLabel } from "@/lib/formatters";
import { ChefHat, BellRing, Clock, ChevronLeft, X, Utensils } from "lucide-react";
import { cn } from "@/lib/utils";

interface ActiveOrderBannerProps {
  restaurantSlug: string;
  tableToken?: string;
}

interface StoredOrderInfo {
  orderId: string;
  orderNumber: string;
  orderType?: "DINE_IN" | "TAKEAWAY";
  restaurantSlug: string;
  tableToken?: string;
  status: OrderStatus;
  updatedAt?: string;
}

export const ActiveOrderBanner: React.FC<ActiveOrderBannerProps> = ({
  restaurantSlug,
  tableToken,
}) => {
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [storedTableToken, setStoredTableToken] = useState<string | undefined>(tableToken);

  // Check localStorage and fetch active order
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const stored = localStorage.getItem("smart_restaurant_active_order_v1");
      if (stored) {
        const info: StoredOrderInfo = JSON.parse(stored);
        if (info.tableToken) {
          setStoredTableToken(info.tableToken);
        }
        if (info.orderId) {
          orderRepository.getOrderById(info.orderId).then((ord) => {
            if (ord) {
              setActiveOrder(ord);
            }
          });
        }
      }
    } catch {
      // Ignore
    }
  }, [restaurantSlug, tableToken]);

  // Subscribe to real-time events & polling heartbeat
  useEffect(() => {
    if (!activeOrder?.id) return;

    const unsub = orderRepository.subscribeToOrders((event) => {
      if (event && event.order && event.order.id === activeOrder.id) {
        setActiveOrder(event.order);
      }
    });

    const poll = setInterval(async () => {
      try {
        const latest = await orderRepository.getOrderById(activeOrder.id);
        if (latest && latest.status !== activeOrder.status) {
          setActiveOrder(latest);
        }
      } catch {
        // Ignore
      }
    }, 3000);

    return () => {
      unsub();
      clearInterval(poll);
    };
  }, [activeOrder?.id, activeOrder?.status]);

  if (!activeOrder || isDismissed) return null;

  // Don't show if cancelled
  if (activeOrder.status === "CANCELLED") return null;

  const isServed = activeOrder.status === "SERVED";
  const isPreparing = activeOrder.status === "PREPARING";
  const isReady = activeOrder.status === "READY";
  const isConfirmed = activeOrder.status === "CONFIRMED";

  const effectiveToken = tableToken || storedTableToken;
  const trackingUrl = effectiveToken
    ? `/r/${restaurantSlug}/t/${effectiveToken}/order/${activeOrder.id}`
    : `/r/${restaurantSlug}/takeaway/order/${activeOrder.id}`;

  return (
    <div className="w-full bg-forest-950 text-white border-b border-forest-800/80 shadow-md relative z-30 transition-all duration-300">
      <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 text-xs sm:text-sm">
        {/* Left: Status Icon and Text */}
        <Link
          href={trackingUrl}
          className="flex items-center gap-2.5 flex-1 min-w-0 group hover:opacity-95 transition-opacity"
        >
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border",
              isPreparing && "bg-amber-500/20 border-amber-400/50 text-amber-300 animate-pulse",
              isReady && "bg-emerald-500/20 border-emerald-400/50 text-emerald-300 animate-bounce",
              isServed && "bg-teal-500/20 border-teal-400/50 text-teal-300",
              isConfirmed && "bg-blue-500/20 border-blue-400/50 text-blue-300",
              !isPreparing && !isReady && !isServed && !isConfirmed && "bg-white/10 border-white/20 text-cream-200"
            )}
          >
            {isPreparing ? (
              <ChefHat className="w-4 h-4" />
            ) : isReady ? (
              <BellRing className="w-4 h-4" />
            ) : isServed ? (
              <Utensils className="w-4 h-4" />
            ) : (
              <Clock className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-bold truncate">
              <span>طلبك ({activeOrder.orderNumber}):</span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-md text-[11px] font-extrabold",
                  isPreparing && "bg-amber-400 text-amber-950",
                  isReady && "bg-emerald-400 text-emerald-950 animate-pulse",
                  isServed && "bg-teal-400 text-teal-950",
                  !isPreparing && !isReady && !isServed && "bg-white/20 text-white"
                )}
              >
                {getOrderStatusLabel(activeOrder.status)}
              </span>
            </div>
            <p className="text-[11px] text-cream-300 truncate">
              {isPreparing && "الشيف يقوم بإعداد طعامك الآن على نار هادئة"}
              {isReady && "طعامك ساخن وجاهز في الطريق لطاولتك!"}
              {isServed && "تم التقديم بالهناء والشفاء • شرفتنا!"}
              {!isPreparing && !isReady && !isServed && "تم استلام الطلب وتأكيده بالمطبخ"}
            </p>
          </div>
        </Link>

        {/* Right: Action link & dismiss */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href={trackingUrl}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/10 transition-colors"
          >
            <span>التفاصيل</span>
            <ChevronLeft className="w-3.5 h-3.5" />
          </Link>

          {isServed && (
            <button
              onClick={() => setIsDismissed(true)}
              className="p-1 rounded-md text-stone-400 hover:text-white transition-colors"
              title="إخفاء التنبيه"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
