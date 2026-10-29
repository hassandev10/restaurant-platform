"use client";

import React from "react";
import { Order } from "@/types/order";
import { formatCurrency, formatArabicDateTime } from "@/lib/formatters";
import { getOrderStatusLabel } from "@/lib/formatters";
import { Printer, X } from "lucide-react";

interface OrderReceiptModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  restaurantName?: string;
  branchName?: string;
}

export const OrderReceiptModal: React.FC<OrderReceiptModalProps> = ({
  order,
  isOpen,
  onClose,
  restaurantName = "مطعم الزيتونة",
  branchName = "فرع المعادي - القاهرة",
}) => {
  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity print:hidden"
        onClick={onClose}
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-150 print:p-0 print:border-none print:shadow-none print:max-w-none">
          {/* Modal Toolbar (hidden when printing) */}
          <div className="flex items-center justify-between pb-4 border-b border-stone-200 print:hidden mb-4">
            <h3 className="text-sm font-bold text-stone-900">معاينة بون الطلب / المطبخ</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-forest-900 text-white font-bold text-xs hover:bg-forest-950 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>طباعة</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Printable Ticket Receipt Content */}
          <div className="font-mono text-stone-900 text-xs space-y-3 p-4 bg-stone-50 rounded-2xl border border-stone-200 print:bg-white print:border-none print:p-0">
            {/* Header */}
            <div className="text-center space-y-1 pb-3 border-b border-dashed border-stone-400">
              <div className="font-extrabold text-base tracking-tight">{restaurantName}</div>
              <div className="text-[11px] text-stone-600">{branchName}</div>
              <div className="text-[11px] font-bold text-forest-900 mt-1">
                بون تحضير الصالة (Kitchen POS)
              </div>
            </div>

            {/* Metadata Table */}
            <div className="space-y-1 text-[11px] pb-2 border-b border-dashed border-stone-400">
              <div className="flex justify-between">
                <span>رقم الطلب:</span>
                <span className="font-bold">#{order.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>الموقع / الطاولة:</span>
                <span className="font-bold bg-stone-200 px-1 rounded">
                  {order.tableName || order.tableNameSnapshot}
                </span>
              </div>
              <div className="flex justify-between">
                <span>التاريخ والوقت:</span>
                <span>{formatArabicDateTime(order.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>الحالة الحالية:</span>
                <span className="font-bold">{getOrderStatusLabel(order.status)}</span>
              </div>
            </div>

            {/* Items Table */}
            <div className="space-y-2 py-2 border-b border-dashed border-stone-400">
              <div className="flex justify-between font-bold text-[11px] text-stone-600">
                <span>الصنف / التفاصيل</span>
                <span>الإجمالي</span>
              </div>

              {order.items.map((item, idx) => (
                <div key={item.id || idx} className="space-y-0.5">
                  <div className="flex justify-between font-bold">
                    <span>
                      {item.quantity}× {item.productNameSnapshot}
                    </span>
                    <span>{formatCurrency(item.lineTotal)}</span>
                  </div>

                  {item.selectedOptions && item.selectedOptions.length > 0 && (
                    <div className="text-[10px] text-stone-600 pr-3">
                      {item.selectedOptions.map((opt) => opt.optionNameAr).join(" • ")}
                    </div>
                  )}

                  {item.notes && (
                    <div className="text-[10px] text-amber-900 bg-amber-100/60 px-1.5 py-0.5 rounded pr-2">
                      ملاحظة: {item.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="space-y-1 text-xs pt-1">
              <div className="flex justify-between text-stone-600">
                <span>المجموع الفرعي:</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              <div className="flex justify-between font-extrabold text-sm pt-1 border-t border-stone-400">
                <span>الإجمالي الصافي:</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-[10px] text-stone-500 pt-3 border-t border-dashed border-stone-400 space-y-0.5">
              <div>طُبع بواسطة نظام الطلب الذكي</div>
              <div>شكراً لزيارتكم مطعم الزيتونة</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
