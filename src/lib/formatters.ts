import { OrderStatus, PaymentStatus } from "@/types/order";
import { TableStatus } from "@/types/table";

/**
 * Format currency with Egyptian Pound (EGP / ج.م)
 */
export function formatCurrency(amount: number, currency: string = "EGP"): string {
  const formatted = new Intl.NumberFormat("ar-EG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);

  return `${formatted} ${currency === "EGP" ? "ج.م" : currency}`;
}

/**
 * Format ISO Date string to Arabic readable date & time
 */
export function formatArabicDateTime(dateString: string): string {
  if (!dateString) return "—";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat("ar-EG", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return dateString;
  }
}

export function formatArabicTime(dateString: string): string {
  if (!dateString) return "—";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return new Intl.DateTimeFormat("ar-EG", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return dateString;
  }
}

/**
 * Order Status Arabic Labels and Styles
 */
export interface StatusConfig {
  label: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
}

export function getOrderStatusConfig(status: OrderStatus): StatusConfig {
  switch (status) {
    case "NEW":
      return {
        label: "طلب جديد",
        bgClass: "bg-blue-50",
        textClass: "text-blue-700",
        borderClass: "border-blue-200",
      };
    case "CONFIRMED":
      return {
        label: "مؤكد",
        bgClass: "bg-amber-50",
        textClass: "text-amber-700",
        borderClass: "border-amber-200",
      };
    case "PREPARING":
      return {
        label: "قيد التجهيز",
        bgClass: "bg-orange-50",
        textClass: "text-orange-700",
        borderClass: "border-orange-200",
      };
    case "READY":
      return {
        label: "جاهز للتقديم",
        bgClass: "bg-emerald-50",
        textClass: "text-emerald-700",
        borderClass: "border-emerald-200",
      };
    case "SERVED":
      return {
        label: "تم التقديم",
        bgClass: "bg-forest-50",
        textClass: "text-forest-700",
        borderClass: "border-forest-200",
      };
    case "CANCELLED":
      return {
        label: "ملغي",
        bgClass: "bg-red-50",
        textClass: "text-red-700",
        borderClass: "border-red-200",
      };
    default:
      return {
        label: status,
        bgClass: "bg-stone-50",
        textClass: "text-stone-700",
        borderClass: "border-stone-200",
      };
  }
}

/**
 * Payment Status Arabic Labels
 */
export function getPaymentStatusConfig(status: PaymentStatus): StatusConfig {
  switch (status) {
    case "PAID":
      return {
        label: "تم الدفع",
        bgClass: "bg-emerald-50",
        textClass: "text-emerald-700",
        borderClass: "border-emerald-200",
      };
    case "PENDING_CASHIER":
      return {
        label: "في انتظار الكاشير",
        bgClass: "bg-amber-50",
        textClass: "text-amber-700",
        borderClass: "border-amber-200",
      };
    case "CANCELLED":
      return {
        label: "ملغي",
        bgClass: "bg-red-50",
        textClass: "text-red-700",
        borderClass: "border-red-200",
      };
    default:
      return {
        label: status,
        bgClass: "bg-stone-50",
        textClass: "text-stone-700",
        borderClass: "border-stone-200",
      };
  }
}

/**
 * Table Status Arabic Labels
 */
export function getTableStatusConfig(status: TableStatus): StatusConfig {
  switch (status) {
    case "AVAILABLE":
      return {
        label: "شاغرة ومتاحة",
        bgClass: "bg-emerald-50",
        textClass: "text-emerald-700",
        borderClass: "border-emerald-200",
      };
    case "OCCUPIED":
      return {
        label: "مشغولة بزبائن",
        bgClass: "bg-amber-50",
        textClass: "text-amber-700",
        borderClass: "border-amber-200",
      };
    case "RESERVED":
      return {
        label: "محجوزة مسبقاً",
        bgClass: "bg-blue-50",
        textClass: "text-blue-700",
        borderClass: "border-blue-200",
      };
    case "CLEANING":
      return {
        label: "قيد التنظيف والتعقيم",
        bgClass: "bg-purple-50",
        textClass: "text-purple-700",
        borderClass: "border-purple-200",
      };
    case "OUT_OF_SERVICE":
      return {
        label: "خارج الخدمة",
        bgClass: "bg-stone-100",
        textClass: "text-stone-600",
        borderClass: "border-stone-300",
      };
    default:
      return {
        label: status,
        bgClass: "bg-stone-50",
        textClass: "text-stone-700",
        borderClass: "border-stone-200",
      };
  }
}

/**
 * Inventory Unit Labels in Arabic
 */
export function formatUnit(unit: string): string {
  switch (unit) {
    case "g":
      return "جرام";
    case "kg":
      return "كجم";
    case "ml":
      return "مل";
    case "l":
      return "لتر";
    case "piece":
      return "قطعة";
    case "box":
      return "علبة";
    case "carton":
      return "كرتونة";
    case "sack":
      return "شيكارة / جوال";
    case "bottle":
      return "زجاجة";
    case "can":
      return "كانز / عبوة";
    default:
      return unit;
  }
}

/**
 * Inventory Item Type Configuration
 */
export function getItemTypeConfig(type: string): StatusConfig {
  switch (type) {
    case "RAW_INGREDIENT":
      return {
        label: "مادة خام",
        bgClass: "bg-blue-50",
        textClass: "text-blue-700",
        borderClass: "border-blue-200",
      };
    case "FINISHED_GOOD":
      return {
        label: "منتج نهائي مباع",
        bgClass: "bg-purple-50",
        textClass: "text-purple-700",
        borderClass: "border-purple-200",
      };
    default:
      return {
        label: type,
        bgClass: "bg-stone-50",
        textClass: "text-stone-700",
        borderClass: "border-stone-200",
      };
  }
}

/**
 * Item Category Labels
 */
export function getItemCategoryLabel(category: string): string {
  switch (category) {
    case "MEAT":
      return "لحوم ومصنعاتها";
    case "POULTRY":
      return "دواجن وطيور";
    case "VEGETABLES":
      return "خضروات وفواكه";
    case "DAIRY":
      return "ألبان وأجبان";
    case "DRY_GOODS":
      return "حبوب وبقوليات";
    case "SPICES":
      return "توابل وبهارات";
    case "BEVERAGES":
      return "مشروبات ومعلبات";
    case "BAKERY":
      return "مخبوزات ودقيق";
    case "PACKAGING":
      return "تعبئة وتغليف";
    case "OTHER":
      return "أصناف عامة";
    default:
      return category;
  }
}

/**
 * Inventory Movement Type Configuration
 */
export function getMovementTypeConfig(type: string): StatusConfig {
  switch (type) {
    case "PURCHASE_RECEIPT":
      return {
        label: "توريد مشتريات (+)",
        bgClass: "bg-emerald-50",
        textClass: "text-emerald-700",
        borderClass: "border-emerald-200",
      };
    case "ORDER_CONSUMPTION":
      return {
        label: "استهلاك طلبات (-)",
        bgClass: "bg-blue-50",
        textClass: "text-blue-700",
        borderClass: "border-blue-200",
      };
    case "MANUAL_CONSUMPTION":
      return {
        label: "استهلاك تشغيلي (-)",
        bgClass: "bg-amber-50",
        textClass: "text-amber-700",
        borderClass: "border-amber-200",
      };
    case "WASTE":
      return {
        label: "هدر وتوالف (-)",
        bgClass: "bg-red-50",
        textClass: "text-red-700",
        borderClass: "border-red-200",
      };
    case "ADJUSTMENT":
      return {
        label: "تسوية رصيد (±)",
        bgClass: "bg-indigo-50",
        textClass: "text-indigo-700",
        borderClass: "border-indigo-200",
      };
    case "COUNT_RECONCILIATION":
      return {
        label: "مطابقة جرد فعلي (±)",
        bgClass: "bg-purple-50",
        textClass: "text-purple-700",
        borderClass: "border-purple-200",
      };
    default:
      return {
        label: type,
        bgClass: "bg-stone-50",
        textClass: "text-stone-700",
        borderClass: "border-stone-200",
      };
  }
}

/**
 * Inventory Alert Configuration
 */
export function getInventoryAlertConfig(type: string): StatusConfig {
  switch (type) {
    case "LOW_STOCK":
      return {
        label: "مخزون منخفض",
        bgClass: "bg-amber-50",
        textClass: "text-amber-700",
        borderClass: "border-amber-200",
      };
    case "OUT_OF_STOCK":
      return {
        label: "نفاد المخزون",
        bgClass: "bg-red-50",
        textClass: "text-red-700",
        borderClass: "border-red-200",
      };
    case "NEGATIVE_STOCK":
      return {
        label: "رصيد سالب (تجاوز)",
        bgClass: "bg-rose-100",
        textClass: "text-rose-800",
        borderClass: "border-rose-300",
      };
    default:
      return {
        label: type,
        bgClass: "bg-stone-50",
        textClass: "text-stone-700",
        borderClass: "border-stone-200",
      };
  }
}

/**
 * Purchase Receipt Status Configuration
 */
export function getPurchaseStatusConfig(status: string): StatusConfig {
  switch (status) {
    case "DRAFT":
      return {
        label: "مسودة (لم تُعتمد)",
        bgClass: "bg-stone-100",
        textClass: "text-stone-700",
        borderClass: "border-stone-300",
      };
    case "CONFIRMED":
      return {
        label: "مؤكدة ومعتمدة (تمت إضافة الرصيد)",
        bgClass: "bg-emerald-50",
        textClass: "text-emerald-700",
        borderClass: "border-emerald-200",
      };
    case "CANCELLED":
      return {
        label: "ملغاة",
        bgClass: "bg-red-50",
        textClass: "text-red-700",
        borderClass: "border-red-200",
      };
    default:
      return {
        label: status,
        bgClass: "bg-stone-50",
        textClass: "text-stone-700",
        borderClass: "border-stone-200",
      };
  }
}
