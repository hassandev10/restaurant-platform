import React from "react";
import { RestaurantTable } from "@/types/table";
import { Order } from "@/types/order";
import {
  AlertTriangle,
  X,
  Sparkles,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { formatEGP } from "@/lib/order-workflow";

interface TableCloseConfirmModalProps {
  table: RestaurantTable | null;
  activeOrder: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isSubmitting?: boolean;
}

export const TableCloseConfirmModal: React.FC<TableCloseConfirmModalProps> = ({
  table,
  activeOrder,
  isOpen,
  onClose,
  onConfirm,
  isSubmitting = false,
}) => {
  if (!isOpen || !table) return null;

  // Strict domain rule: Never release a table while an active order remains!
  const hasUnfinishedOrder =
    activeOrder &&
    ["NEW", "CONFIRMED", "PREPARING", "READY"].includes(activeOrder.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs font-cairo animate-in fade-in duration-150">
      <div
        className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-stone-200 overflow-hidden"
        dir="rtl"
      >
        {/* Header */}
        <div
          className={`p-5 text-white flex items-center justify-between ${
            hasUnfinishedOrder ? "bg-rose-900" : "bg-amber-900"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-white">
              {hasUnfinishedOrder ? (
                <ShieldAlert className="w-5 h-5 text-rose-300" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-300" />
              )}
            </div>
            <div>
              <h3 className="font-black text-base">
                {hasUnfinishedOrder ? "إجراء غير مسموح به" : "تأكيد إنهاء الجلسة"}
              </h3>
              <p className="text-xs text-white/80">
                {table.name} • {table.sectionNameAr}
              </p>
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

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {hasUnfinishedOrder ? (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs leading-relaxed space-y-2">
                <p className="font-extrabold text-sm flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>لا يمكن إتاحة الطاولة للتنظيف أثناء وجود أوردر نشط!</span>
                </p>
                <p>
                  يوجد أوردر قيد المعالجة (
                  <strong className="font-mono text-rose-950 font-bold">
                    {activeOrder.orderNumber}
                  </strong>{" "}
                  - الحالة: <strong>{activeOrder.status}</strong>) بقيمة{" "}
                  <strong>{formatEGP(activeOrder.total)}</strong>.
                </p>
                <p className="text-rose-700 text-[11px]">
                  يجب إنهاء دورة حياة الأوردر (تقديمه للعميل أو إلغاؤه) قبل إخلاء الطاولة لحماية
                  سجلات المبيعات والحسابات.
                </p>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-5 rounded-xl bg-stone-900 text-white text-xs font-bold hover:bg-black transition-colors"
                >
                  فهمت ذلك، إغلاق
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-stone-700 leading-relaxed">
                هل أنت متأكد من إنهاء جلسة ضيوف <strong>{table.name}</strong>؟
              </p>

              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>سيتم تحويل حالة الطاولة إلى &quot;تحتاج تنظيف&quot;</span>
                </p>
                <p className="text-[11px] text-amber-800">
                  لتنبيه طاقم الصالة بتعقيم وتجهيز الطاولة قبل تسكين ضيوف جدد.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-stone-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="py-2.5 px-4 rounded-xl border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-50"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={isSubmitting}
                  className="py-2.5 px-5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>إنهاء الجلسة وإرسال للتنظيف</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
