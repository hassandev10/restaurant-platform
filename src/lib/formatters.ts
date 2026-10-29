import { OrderStatus } from "@/types/order";

/**
 * Formats a monetary amount into standard Egyptian Pounds representation (ج.م)
 */
export function formatCurrency(amount: number): string {
  // Format with thousands separator if needed, e.g. "250 ج.م"
  const formatted = new Intl.NumberFormat("ar-EG", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(amount);

  return `${formatted} ج.م`;
}

/**
 * Formats ISO date to readable Arabic time and date
 */
export function formatArabicDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("ar-EG", {
      hour: "numeric",
      minute: "numeric",
      hour12: true,
      day: "numeric",
      month: "short",
    }).format(date);
  } catch {
    return isoString;
  }
}

/**
 * Formats ISO date to readable Arabic time only (e.g. "11:45 ص")
 */
export function formatArabicTimeOnly(isoString: string): string {
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat("ar-EG", {
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    }).format(date);
  } catch {
    return isoString;
  }
}

/**
 * Translates internal order status to Arabic human-readable label
 */
export function getOrderStatusLabel(status: OrderStatus): string {
  switch (status) {
    case "NEW":
      return "جديد";
    case "CONFIRMED":
      return "تم التأكيد";
    case "PREPARING":
      return "قيد التحضير";
    case "READY":
      return "جاهز للتقديم";
    case "SERVED":
      return "تم تقديم الطلب";
    case "CANCELLED":
      return "تم الإلغاء";
    default:
      return status;
  }
}

/**
 * Detailed description for customer progress tracking
 */
export function getOrderStatusDescription(status: OrderStatus): string {
  switch (status) {
    case "NEW":
      return "تم استلام طلبك ومراجعته بواسطة المطعم";
    case "CONFIRMED":
      return "تم تأكيد طلبك وإرساله إلى الشيف";
    case "PREPARING":
      return "يقوم الشيف الآن بتحضير وجبتك الطازجة";
    case "READY":
      return "وجبتك جاهزة وسيتم إحضارها إلى طاولتك حالا";
    case "SERVED":
      return "بالهناء والشفاء! نتمنى لك تجربة ممتعة";
    case "CANCELLED":
      return "تم إلغاء هذا الطلب. يرجى مراجعة موظف الخدمة";
    default:
      return "";
  }
}
