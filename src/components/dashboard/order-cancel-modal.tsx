"use client";

import React, { useState } from "react";
import { Order } from "@/types/order";
import { AlertTriangle, Loader2, X, Ban } from "lucide-react";

interface OrderCancelModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmCancel: (orderId: string, reason: string) => Promise<void>;
  isCancelling?: boolean;
}

const COMMON_CANCEL_REASONS = [
  "طلب العميل إلغاء الوجبة",
  "نفاد صنف أو مكون من المطبخ",
  "طلب مكرر بالخطأ من الطاولة",
  "تأخر غير مقبول في التحضير",
  "خطأ في تحديد الطاولة",
  "سبب آخر...",
];

export const OrderCancelModal: React.FC<OrderCancelModalProps> = ({
  order,
  isOpen,
  onClose,
  onConfirmCancel,
  isCancelling = false,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>(COMMON_CANCEL_REASONS[0]);
  const [customReason, setCustomReason] = useState<string>("");

  if (!isOpen || !order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalReason =
      selectedReason === "سبب آخر..." ? customReason.trim() || "إلغاء بناءً على قرار المشرف" : selectedReason;
    await onConfirmCancel(order.id, finalReason);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/50 backdrop-blur-xs transition-opacity"
        onClick={isCancelling ? undefined : onClose}
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-stone-900">
                  تأكيد إلغاء الطلب #{order.orderNumber}
                </h3>
                <p className="text-xs text-stone-500 font-medium">
                  {order.tableName || order.tableNameSnapshot} • سيتم توثيق سبب الإلغاء في سجل الطلب
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={isCancelling}
              className="text-stone-400 hover:text-stone-700 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-stone-700 block">
                يرجى اختيار سبب الإلغاء:
              </label>

              <div className="space-y-1.5">
                {COMMON_CANCEL_REASONS.map((reason) => (
                  <label
                    key={reason}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                      selectedReason === reason
                        ? "bg-rose-50/70 border-rose-300 text-rose-900"
                        : "bg-stone-50/50 border-stone-200 text-stone-700 hover:bg-stone-100/60"
                    }`}
                  >
                    <input
                      type="radio"
                      name="cancel_reason"
                      checked={selectedReason === reason}
                      onChange={() => setSelectedReason(reason)}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span>{reason}</span>
                  </label>
                ))}
              </div>
            </div>

            {selectedReason === "سبب آخر..." && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 block">
                  اكتب سبب الإلغاء بالتفصيل:
                </label>
                <textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="اكتب التوضيح هنا..."
                  rows={2}
                  className="w-full p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  required
                />
              </div>
            )}

            <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-3 text-[11px] text-rose-800 leading-relaxed">
              تنبيه: لا يمكن التراجع عن إلغاء الطلب بعد اعتماده، وسيتم إخطار الصالة والمطبخ فوراً.
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={isCancelling}
                className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98 disabled:opacity-50"
              >
                {isCancelling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Ban className="w-4 h-4" />
                )}
                <span>تأكيد الإلغاء</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={isCancelling}
                className="py-3 px-4 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-100 font-bold text-xs transition-colors"
              >
                تراجع
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
