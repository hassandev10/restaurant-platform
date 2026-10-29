"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/cart-context";
import { orderRepository } from "@/repositories/order-repository";
import { restaurantRepository } from "@/repositories/restaurant-repository";
import { Restaurant } from "@/types/restaurant";
import { RestaurantTable } from "@/types/table";
import { OrderItem } from "@/types/order";
import { PriceDisplay } from "@/components/shared/price-display";
import { DemoNotice } from "@/components/shared/demo-notice";
import { formatCurrency } from "@/lib/formatters";
import { CheckCircle2, Loader2, MapPin, Banknote, ShoppingBag, Info } from "lucide-react";
import { toast } from "sonner";

interface CartSummaryProps {
  restaurant: Restaurant;
  table?: RestaurantTable | null;
  restaurantSlug: string;
  tableToken?: string;
}

export const CartSummary: React.FC<CartSummaryProps> = ({
  restaurant,
  table,
  restaurantSlug,
  tableToken,
}) => {
  const router = useRouter();
  const { items, subtotal, total, clearCart, isTakeaway } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Table identification state for checkout when browsing without initial table token
  const [tableInput, setTableInput] = useState("");
  const [validatedTable, setValidatedTable] = useState<RestaurantTable | null>(table || null);
  const [isValidatingTable, setIsValidatingTable] = useState(false);
  const [tableValidationError, setTableValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (table) {
      setValidatedTable(table);
    }
  }, [table]);

  const handleValidateTable = async (inputToValidate: string): Promise<RestaurantTable | null> => {
    const raw = inputToValidate.trim();
    if (!raw) {
      setTableValidationError("يرجى إدخال رقم الطاولة لإتمام الطلب");
      return null;
    }

    setIsValidatingTable(true);
    setTableValidationError(null);

    try {
      const res = await restaurantRepository.validateTable(restaurantSlug, raw);
      if (!res.valid) {
        setTableValidationError(res.error || "رقم الطاولة غير صحيح أو غير مسجل في هذا المطعم");
        setValidatedTable(null);
        return null;
      }

      setValidatedTable(res.table);
      setTableValidationError(null);
      toast.success(`تم التحقق من ${res.table.name} بنجاح`);
      return res.table;
    } catch {
      setTableValidationError("تعذر التحقق من الطاولة، يرجى التأكد من الاتصال وإعادة المحاولة");
      return null;
    } finally {
      setIsValidatingTable(false);
    }
  };

  const handleSubmitOrder = async () => {
    if (items.length === 0) {
      toast.error("السلة فارغة. يرجى إضافة وجبات أولاً");
      return;
    }

    if (isSubmitting) return;

    // Resolve authoritative table
    let activeTable = table || validatedTable;

    // If no table yet, but customer typed something in tableInput, validate it now
    if (!activeTable && tableInput.trim()) {
      activeTable = await handleValidateTable(tableInput);
      if (!activeTable) return;
    }

    // If still no table:
    if (!activeTable) {
      setTableValidationError("يرجى إدخال رقم الطاولة والتحقق منها لإرسال الطلب للمطبخ");
      toast.error("يرجى تحديد رقم الطاولة للمتابعة");
      return;
    }

    try {
      setIsSubmitting(true);

      // Map cart items to order item snapshots
      const orderItems: OrderItem[] = items.map((item) => {
        const optionsDeltaSum = item.selectedOptions.reduce(
          (sum, opt) => sum + opt.priceDelta,
          0
        );
        return {
          id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          productId: item.productId,
          productNameSnapshot: item.productNameSnapshot,
          unitPriceSnapshot: item.basePrice + optionsDeltaSum,
          quantity: item.quantity,
          selectedOptions: item.selectedOptions,
          notes: item.notes,
          lineTotal: item.lineTotal,
        };
      });

      const effectiveToken = activeTable.token || tableToken;

      const orderPayload = {
        orderType: "DINE_IN" as const,
        restaurantId: restaurant.id,
        branchId: activeTable.branchId || "branch-01",
        tableId: activeTable.id,
        tableToken: effectiveToken,
        tableName: activeTable.name,
        tableNameSnapshot: activeTable.name,
        items: orderItems,
        subtotal,
        total,
      };

      const createdOrder = await orderRepository.createOrder(orderPayload);

      // Clear the cart upon verified creation
      clearCart();

      // Persist active order for persistent tracking banner
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(
            "smart_restaurant_active_order_v1",
            JSON.stringify({
              orderId: createdOrder.id,
              orderNumber: createdOrder.orderNumber,
              orderType: "DINE_IN",
              restaurantSlug,
              tableToken: effectiveToken,
              status: createdOrder.status,
              createdAt: createdOrder.createdAt,
            })
          );
        } catch {
          // ignore
        }
      }

      toast.success("تم إرسال الطلب بنجاح!", {
        description: `رقم الطلب: ${createdOrder.orderNumber}`,
      });

      // Navigate to order confirmation and tracking
      const targetOrderUrl = `/r/${restaurantSlug}/t/${effectiveToken}/order/${createdOrder.id}`;
      router.push(targetOrderUrl);
    } catch (err: unknown) {
      console.error("Order submission failed:", err);
      const msg = err instanceof Error ? err.message : "تعذر إرسال الطلب، يرجى المحاولة مرة أخرى";
      toast.error(msg);
      setIsSubmitting(false);
    }
  };

  const activeTable = table || validatedTable;

  return (
    <div className="bg-white rounded-2xl border border-stone-200/90 p-4 sm:p-5 shadow-sm space-y-4">
      {/* Table Context Card */}
      {activeTable ? (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-forest-50/80 border border-forest-200 text-xs sm:text-sm">
          <div className="flex items-center gap-2 text-forest-900 font-semibold">
            <MapPin className="w-4 h-4 text-forest-700 flex-shrink-0" />
            <span>موقع الجلوس:</span>
            <span className="text-forest-950 font-bold bg-white px-2.5 py-0.5 rounded-md border border-forest-200 shadow-xs">
              {activeTable.name} {activeTable.sectionNameAr ? `(${activeTable.sectionNameAr})` : ""}
            </span>
          </div>
          {!table && (
            <button
              type="button"
              onClick={() => {
                setValidatedTable(null);
                setTableInput("");
              }}
              className="text-xs text-forest-700 hover:text-forest-900 underline font-semibold transition-colors"
            >
              تغيير الطاولة
            </button>
          )}
          {table && (
            <span className="text-forest-700 text-xs font-medium">داخل الصالة</span>
          )}
        </div>
      ) : isTakeaway ? (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs sm:text-sm">
          <div className="flex items-center gap-2 text-amber-950 font-bold">
            <ShoppingBag className="w-4 h-4 text-amber-700 flex-shrink-0" />
            <span>نوع الطلب:</span>
            <span className="text-amber-900 font-extrabold bg-white px-2.5 py-0.5 rounded-md border border-amber-200 shadow-xs">
              Take Away • استلام من المطعم
            </span>
          </div>
          <span className="text-amber-800 text-xs font-semibold">طلب سفري</span>
        </div>
      ) : (
        /* Table selection step when customer enters directly without table token */
        <div className="p-4 rounded-2xl bg-forest-50/70 border border-forest-200 space-y-3">
          <div className="flex items-start gap-2.5">
            <MapPin className="w-4 h-4 text-forest-800 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-stone-900">
                تحديد رقم الطاولة لإرسال الطلب للمطبخ
              </h3>
              <p className="text-[11px] sm:text-xs text-stone-600 mt-0.5">
                يرجى كتابة رقم الطاولة التي تجلس عليها (مثلاً: 4 أو طاولة 4) لربط طلبك بها مباشرة.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={tableInput}
              onChange={(e) => {
                setTableInput(e.target.value);
                if (tableValidationError) setTableValidationError(null);
              }}
              placeholder="رقم الطاولة (مثلاً: 4)"
              className="flex-1 px-3 py-2 rounded-xl border border-stone-300 bg-white text-stone-900 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-forest-700 placeholder:text-stone-400 font-medium"
              disabled={isValidatingTable}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleValidateTable(tableInput);
                }
              }}
            />
            <button
              type="button"
              onClick={() => handleValidateTable(tableInput)}
              disabled={isValidatingTable || !tableInput.trim()}
              className="px-4 py-2 rounded-xl bg-forest-800 hover:bg-forest-900 disabled:bg-stone-300 disabled:cursor-not-allowed text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
            >
              {isValidatingTable ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              <span>تحقق</span>
            </button>
          </div>

          {tableValidationError && (
            <p className="text-xs text-rose-600 font-medium flex items-center gap-1">
              <span>{tableValidationError}</span>
            </p>
          )}

          <div className="pt-2 border-t border-forest-100 flex items-start gap-1.5 text-[11px] text-stone-500 leading-relaxed">
            <Info className="w-3.5 h-3.5 text-stone-400 flex-shrink-0 mt-0.5" />
            <span>
              ملاحظة: نظام المطبخ المباشر يتطلب التحقق من رقم طاولة ساري داخل الصالة لإرسال الطلب وإعداده.
            </span>
          </div>
        </div>
      )}

      {/* Bill calculation breakdown */}
      <div className="space-y-2 text-sm text-stone-600">
        <div className="flex items-center justify-between">
          <span>المجموع الفرعي ({items.length} أصناف)</span>
          <span className="font-semibold text-stone-800">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-stone-400">
          <span>الضريبة والخدمة</span>
          <span>شاملة في الأسعار المعروضة</span>
        </div>
        <div className="pt-2 border-t border-stone-200 flex items-center justify-between">
          <span className="text-base font-bold text-stone-900">الإجمالي المستحق</span>
          <PriceDisplay amount={total} size="xl" />
        </div>
      </div>

      {/* Payment Instruction */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-cream-100/80 border border-cream-300 text-xs text-stone-800">
        <Banknote className="w-4 h-4 text-forest-800 flex-shrink-0" />
        <span className="font-medium">
          طريقة السداد: <strong>الدفع عند الكاشير داخل المطعم.</strong>
        </span>
      </div>

      {/* Demo notice */}
      <DemoNotice />

      {/* Submit Order Action Button */}
      <button
        type="button"
        disabled={isSubmitting || items.length === 0}
        onClick={handleSubmitOrder}
        className="w-full py-3.5 px-4 rounded-xl bg-forest-800 hover:bg-forest-900 disabled:bg-stone-300 disabled:cursor-not-allowed text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-soft transition-all active:scale-[0.99]"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>جاري إرسال الطلب...</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-5 h-5" />
            <span>تأكيد وإرسال الطلب للمطبخ</span>
          </>
        )}
      </button>
    </div>
  );
};
