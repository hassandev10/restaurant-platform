import { OrderStatus, OrderEvent } from "@/types/order";

/**
 * Standard progression order statuses for restaurant POS workflow
 */
export const ORDER_STATUS_SEQUENCE: OrderStatus[] = [
  "NEW",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "SERVED",
];

/**
 * Normal linear workflow transitions
 */
export const NEXT_STATUS_MAP: Record<OrderStatus, OrderStatus | null> = {
  NEW: "CONFIRMED",
  CONFIRMED: "PREPARING",
  PREPARING: "READY",
  READY: "SERVED",
  SERVED: null,
  CANCELLED: null,
};

/**
 * Config for next permitted action buttons
 */
export interface ActionButtonConfig {
  nextStatus: OrderStatus;
  label: string;
  shortLabel: string;
  badgeClass: string;
  buttonClass: string;
  iconName: "check" | "chef-hat" | "bell-ring" | "utensils" | "ban";
}

export const STATUS_ACTION_CONFIG: Record<
  Exclude<OrderStatus, "SERVED" | "CANCELLED">,
  ActionButtonConfig
> = {
  NEW: {
    nextStatus: "CONFIRMED",
    label: "تأكيد واستلام الطلب",
    shortLabel: "تأكيد الطلب",
    badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
    buttonClass: "bg-amber-600 hover:bg-amber-700 text-white shadow-sm focus:ring-amber-500",
    iconName: "check",
  },
  CONFIRMED: {
    nextStatus: "PREPARING",
    label: "إرسال للمطبخ وبدء التحضير",
    shortLabel: "بدء التحضير",
    badgeClass: "bg-blue-100 text-blue-900 border-blue-300",
    buttonClass: "bg-blue-600 hover:bg-blue-700 text-white shadow-sm focus:ring-blue-500",
    iconName: "chef-hat",
  },
  PREPARING: {
    nextStatus: "READY",
    label: "إشعار بأن الوجبة جاهزة للتقديم",
    shortLabel: "الطلب جاهز",
    badgeClass: "bg-purple-100 text-purple-900 border-purple-300",
    buttonClass: "bg-purple-600 hover:bg-purple-700 text-white shadow-sm focus:ring-purple-500",
    iconName: "bell-ring",
  },
  READY: {
    nextStatus: "SERVED",
    label: "تأكيد تقديم الوجبة للعميل",
    shortLabel: "تم تقديم الطلب",
    badgeClass: "bg-emerald-100 text-emerald-900 border-emerald-300",
    buttonClass: "bg-forest-800 hover:bg-forest-900 text-white shadow-sm focus:ring-forest-600",
    iconName: "utensils",
  },
};

/**
 * Reusable domain validation: check if transition from current to target is allowed
 */
export function canTransitionStatus(
  currentStatus: OrderStatus,
  targetStatus: OrderStatus
): boolean {
  // Direct next linear transition
  if (NEXT_STATUS_MAP[currentStatus] === targetStatus) {
    return true;
  }

  // Cancellation is allowed from active non-completed states
  if (
    targetStatus === "CANCELLED" &&
    (currentStatus === "NEW" || currentStatus === "CONFIRMED" || currentStatus === "PREPARING")
  ) {
    return true;
  }

  return false;
}

/**
 * Checks whether an order is eligible for cancellation
 */
export function isOrderCancellable(status: OrderStatus): boolean {
  return status === "NEW" || status === "CONFIRMED" || status === "PREPARING";
}

/**
 * Get next valid status in sequence
 */
export function getNextValidStatus(status: OrderStatus): OrderStatus | null {
  return NEXT_STATUS_MAP[status] || null;
}

/**
 * Returns human Arabic label and styling for each order status
 */
export function getStatusBadgeInfo(status: OrderStatus): {
  label: string;
  badgeClass: string;
  dotClass: string;
} {
  switch (status) {
    case "NEW":
      return {
        label: "جديد",
        badgeClass: "bg-amber-50 text-amber-800 border-amber-300/80 ring-1 ring-amber-300/40",
        dotClass: "bg-amber-500 animate-pulse",
      };
    case "CONFIRMED":
      return {
        label: "تم التأكيد",
        badgeClass: "bg-blue-50 text-blue-800 border-blue-300/80 ring-1 ring-blue-300/40",
        dotClass: "bg-blue-500",
      };
    case "PREPARING":
      return {
        label: "قيد التحضير",
        badgeClass: "bg-purple-50 text-purple-800 border-purple-300/80 ring-1 ring-purple-300/40",
        dotClass: "bg-purple-500",
      };
    case "READY":
      return {
        label: "جاهز للتقديم",
        badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-300/80 ring-1 ring-emerald-300/40",
        dotClass: "bg-emerald-500",
      };
    case "SERVED":
      return {
        label: "تم التقديم",
        badgeClass: "bg-stone-100 text-stone-700 border-stone-300 ring-1 ring-stone-200",
        dotClass: "bg-stone-400",
      };
    case "CANCELLED":
      return {
        label: "ملغي",
        badgeClass: "bg-rose-50 text-rose-800 border-rose-300 ring-1 ring-rose-200",
        dotClass: "bg-rose-500",
      };
  }
}

/**
 * Create a new event audit entry
 */
export function createOrderEvent(
  status: OrderStatus,
  actor: string = "الكابتن أحمد (مشرف الصالة)",
  note?: string
): OrderEvent {
  return {
    id: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    status,
    actor,
    note,
  };
}

/**
 * Calculate elapsed minutes since an order was created
 */
export function getElapsedMinutes(createdAtIso: string): number {
  const createdTime = new Date(createdAtIso).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - createdTime);
  return Math.floor(diffMs / (1000 * 60));
}

/**
 * Formats elapsed time into Arabic phrasing (e.g., "الآن", "منذ 4 دقائق", "منذ ساعة و10 دقائق")
 */
export function formatElapsedTimeArabic(createdAtIso: string): string {
  const minutes = getElapsedMinutes(createdAtIso);

  if (minutes < 1) return "الآن";
  if (minutes === 1) return "منذ دقيقة واحدة";
  if (minutes === 2) return "منذ دقيقتين";
  if (minutes >= 3 && minutes <= 10) return `منذ ${minutes} دقائق`;
  if (minutes > 10 && minutes < 60) return `منذ ${minutes} دقيقة`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 1) {
    return remainingMinutes > 0
      ? `منذ ساعة و ${remainingMinutes} دقيقة`
      : "منذ ساعة واحدة";
  }

  if (hours === 2) {
    return remainingMinutes > 0
      ? `منذ ساعتين و ${remainingMinutes} دقيقة`
      : "منذ ساعتين";
  }

  return `منذ ${hours} ساعات`;
}

/**
 * Detects if an active order has been delayed longer than acceptable threshold
 * Default threshold: 15 minutes for total waiting time, or 7 minutes if still in NEW state
 */
export function isOrderDelayed(
  createdAtIso: string,
  status: OrderStatus,
  thresholdMinutes: number = 15
): boolean {
  if (status === "SERVED" || status === "CANCELLED") {
    return false;
  }

  const elapsed = getElapsedMinutes(createdAtIso);

  // New orders that haven't been confirmed for > 7 minutes are critically delayed
  if (status === "NEW" && elapsed >= 7) {
    return true;
  }

  return elapsed >= thresholdMinutes;
}

/**
 * Standard Egyptian currency formatting
 */
export function formatEGP(amount: number): string {
  const formatted = new Intl.NumberFormat("ar-EG", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);
  return `${formatted} ج.م`;
}
