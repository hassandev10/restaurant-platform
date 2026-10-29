"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { formatArabicDateTime, formatUnit, getMovementTypeConfig } from "@/lib/formatters";
import { useAuth } from "@/context/auth-context";
import { inventoryService } from "@/services/inventory-service";
import { InventoryItem, MovementType, StockAdjustmentRequest } from "@/types/inventory";
import { InventoryNav } from "@/components/inventory/inventory-nav";
import { LoadingState } from "@/components/shared/loading-state";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Flame,
  History,
  Lock,
  MinusCircle,
  PlusCircle,
  Scale,
  Trash2,
} from "lucide-react";

export function AdjustmentsForm() {
  const router = useRouter();
  const { user } = useAuth();
  const [itemsList, setItemsList] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [movementType, setMovementType] = useState<
    "MANUAL_CONSUMPTION" | "WASTE" | "ADJUSTMENT" | "COUNT_RECONCILIATION"
  >("WASTE");
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [countedQuantity, setCountedQuantity] = useState<number>(0);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  useEffect(() => {
    inventoryService.getItems().then((data) => {
      setItemsList(data);
      if (data.length > 0) {
        setSelectedItemId(data[0].id);
        setCountedQuantity(data[0].currentStock);
      }
      setIsLoading(false);
    });
  }, []);

  const selectedItem = itemsList.find((i) => i.id === selectedItemId);

  // When item changes, reset countedQuantity to currentStock
  useEffect(() => {
    if (selectedItem) {
      setCountedQuantity(selectedItem.currentStock);
    }
  }, [selectedItemId]);

  // Check user permissions: Only ADMIN, SUPERVISOR, or CHEF can record adjustments/waste
  const canPerformAdjustment = user?.role === "ADMIN" || user?.role === "SUPERVISOR" || user?.role === "CHEF";

  // Calculate diff for reconciliation
  const countDifference = selectedItem
    ? Number((countedQuantity - selectedItem.currentStock).toFixed(2))
    : 0;

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!canPerformAdjustment) {
      toast.error("عفواً، تسجيل التسويات والهدر يتطلب صلاحيات مدير النظام أو مشرف الصالة أو رئيس المطبخ");
      return;
    }

    if (!reason.trim()) {
      toast.error("يرجى كتابة سبب إلزامي لحركة التسوية أو الهدر للتدقيق المخزني");
      return;
    }

    if (movementType === "COUNT_RECONCILIATION") {
      if (countedQuantity < 0) {
        toast.error("الكمية الفعلية لا يمكن أن تكون قيمة سالبة");
        return;
      }
    } else {
      if (quantity <= 0) {
        toast.error("يرجى إدخال كمية صالحة أكبر من الصفر");
        return;
      }
    }

    setConfirmModalOpen(true);
  };

  const handleFinalSubmit = async () => {
    if (!selectedItem) return;

    setIsSubmitting(true);
    try {
      const payload: StockAdjustmentRequest = {
        itemId: selectedItem.id,
        movementType,
        quantity: movementType === "COUNT_RECONCILIATION" ? undefined : quantity,
        countedQuantity: movementType === "COUNT_RECONCILIATION" ? countedQuantity : undefined,
        unit: selectedItem.baseUnit,
        reason: reason.trim(),
        note: note.trim() || undefined,
      };

      const res = await inventoryService.recordAdjustment(payload, user?.name || "المشرف");

      toast.success(
        res.isContractLive
          ? "تم تسجيل التسوية بنجاح وتحديث الرصيد في قاعدة البيانات"
          : "تم تسجيل حركة التسوية بنجاح وتحديث الرصيد في السجل المالي الدفتري."
      );

      setConfirmModalOpen(false);
      router.push(`/inventory/items/${selectedItem.id}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشلت عملية التسوية";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="جاري استرجاع الأصناف ونماذج التسوية..." />;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <InventoryNav />

      {/* Back button */}
      <div className="flex items-center justify-between">
        <Link
          href="/inventory/items"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-stone-900 bg-white px-3 py-1.5 rounded-xl border border-stone-200 transition"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة لدليل الأصناف</span>
        </Link>
        <span className="text-xs text-stone-400">إجراءات الرقابة المخزنية وضبط الرصيد</span>
      </div>

      {/* Permission alert if Cashier */}
      {!canPerformAdjustment && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-xs text-red-800">
          <Lock className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <strong className="block font-bold">صلاحية غير كافية لإجراء التسويات:</strong>
            حسابك الحالي مسجل برتبة ({user?.roleNameAr || user?.role}). يتطلب تسجيل الهدر والتسويات الجردية صلاحية المشرف العام (ADMIN) أو مشرف الصالة أو رئيس المطبخ.
          </div>
        </div>
      )}

      <form onSubmit={handlePreSubmit} className="bg-white rounded-3xl border border-stone-200 p-6 md:p-8 shadow-xs space-y-6">
        <div className="flex items-start justify-between pb-4 border-b border-stone-100">
          <div>
            <h2 className="text-lg font-bold font-cairo text-stone-900">
              تسجيل تسوية مخزنية / هدر وتوالف / جرد فعلي
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              توثيق الفروقات الاستهلاكية وتعديل الرصيد الدفتري بصورة معتمدة غير قابلة للمسح
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <Scale className="w-5 h-5" />
          </div>
        </div>

        {/* Action Type Selector */}
        <div>
          <label className="block text-xs font-bold text-stone-700 mb-2">
            نوع العملية المخزنية <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <button
              type="button"
              onClick={() => setMovementType("WASTE")}
              className={`p-3 rounded-xl border text-right font-bold transition flex flex-col justify-between ${
                movementType === "WASTE"
                  ? "bg-red-50 border-red-300 text-red-900 shadow-2xs"
                  : "bg-cream-50/50 border-stone-200 text-stone-600 hover:bg-cream-100"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span>هدر وتوالف</span>
                <Trash2 className="w-4 h-4 text-red-600" />
              </div>
              <span className="text-[10px] font-normal text-stone-500">تلف، كسر، انتهاء صلاحية</span>
            </button>

            <button
              type="button"
              onClick={() => setMovementType("MANUAL_CONSUMPTION")}
              className={`p-3 rounded-xl border text-right font-bold transition flex flex-col justify-between ${
                movementType === "MANUAL_CONSUMPTION"
                  ? "bg-amber-50 border-amber-300 text-amber-900 shadow-2xs"
                  : "bg-cream-50/50 border-stone-200 text-stone-600 hover:bg-cream-100"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span>استهلاك تشغيلي</span>
                <MinusCircle className="w-4 h-4 text-amber-600" />
              </div>
              <span className="text-[10px] font-normal text-stone-500">تجهيز داخلي خارج الطلبات</span>
            </button>

            <button
              type="button"
              onClick={() => setMovementType("COUNT_RECONCILIATION")}
              className={`p-3 rounded-xl border text-right font-bold transition flex flex-col justify-between ${
                movementType === "COUNT_RECONCILIATION"
                  ? "bg-purple-50 border-purple-300 text-purple-900 shadow-2xs"
                  : "bg-cream-50/50 border-stone-200 text-stone-600 hover:bg-cream-100"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span>مطابقة جرد فعلي</span>
                <ClipboardCheck className="w-4 h-4 text-purple-600" />
              </div>
              <span className="text-[10px] font-normal text-stone-500">إدخال الكمية المعدودة يدوياً</span>
            </button>

            <button
              type="button"
              onClick={() => setMovementType("ADJUSTMENT")}
              className={`p-3 rounded-xl border text-right font-bold transition flex flex-col justify-between ${
                movementType === "ADJUSTMENT"
                  ? "bg-indigo-50 border-indigo-300 text-indigo-900 shadow-2xs"
                  : "bg-cream-50/50 border-stone-200 text-stone-600 hover:bg-cream-100"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span>تسوية رصيد عامة</span>
                <Scale className="w-4 h-4 text-indigo-600" />
              </div>
              <span className="text-[10px] font-normal text-stone-500">إضافة أو خصم فروقات</span>
            </button>
          </div>
        </div>

        {/* Item Selector */}
        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1.5">
            الصنف المراد تسويته <span className="text-red-500">*</span>
          </label>
          <select
            value={selectedItemId}
            onChange={(e) => setSelectedItemId(e.target.value)}
            className="w-full px-3.5 py-2.5 text-xs bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 text-stone-800"
          >
            {itemsList.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nameAr} ({item.sku}) — الرصيد الدفتري الحالي: {item.currentStock} {formatUnit(item.baseUnit)}
              </option>
            ))}
          </select>
        </div>

        {/* Current Balance Display Card */}
        {selectedItem && (
          <div className="p-4 bg-cream-50 border border-stone-200 rounded-2xl flex items-center justify-between text-xs">
            <div>
              <span className="text-stone-500 block mb-0.5">الرصيد الدفتري المسجل بالنظام:</span>
              <div className="font-black font-mono text-base text-stone-900" dir="ltr">
                {selectedItem.currentStock} {formatUnit(selectedItem.baseUnit)}
              </div>
            </div>

            <div className="text-left font-mono">
              <span className="text-stone-400 block mb-0.5">حد الأمان:</span>
              <span className="font-bold text-stone-700">{selectedItem.minStockThreshold} {formatUnit(selectedItem.baseUnit)}</span>
            </div>
          </div>
        )}

        {/* Quantities Form - Count Reconciliation vs Direct Quantity */}
        {movementType === "COUNT_RECONCILIATION" && selectedItem ? (
          <div className="p-4 bg-purple-50/60 border border-purple-200 rounded-2xl space-y-3">
            <h3 className="text-xs font-bold font-cairo text-purple-900 flex items-center gap-1.5">
              <ClipboardCheck className="w-4 h-4" />
              <span>نتائج الجرد الفعلي على أرض الواقع بالمستودع</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  الكمية الفعلية المعدودة <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={countedQuantity}
                    onChange={(e) => setCountedQuantity(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 text-xs bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-purple-700 font-mono text-stone-800"
                    required
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">
                    {formatUnit(selectedItem.baseUnit)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 mb-1">
                  الفارق المحتسب (عجز / زيادة)
                </label>
                <div
                  className={`px-3.5 py-2.5 text-xs rounded-xl font-mono font-bold flex items-center justify-between border ${
                    countDifference < 0
                      ? "bg-red-50 text-red-700 border-red-200"
                      : countDifference > 0
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-white text-stone-600 border-stone-200"
                  }`}
                  dir="ltr"
                >
                  <span>
                    {countDifference > 0 ? `+${countDifference}` : countDifference} {formatUnit(selectedItem.baseUnit)}
                  </span>
                  <span className="text-[11px] font-tajawal font-normal">
                    {countDifference < 0 ? "عجز مخزني" : countDifference > 0 ? "فائض مخزني" : "مطابق تماماً"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              {movementType === "WASTE"
                ? "كمية الهدر أو التالف المراد خصمها"
                : movementType === "MANUAL_CONSUMPTION"
                ? "كمية الاستهلاك التشغيلي المراد خصمها"
                : "كمية التسوية المراد تعديلها"}{" "}
              <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="any"
                min="0.01"
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2.5 text-xs bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 text-stone-800 font-mono"
                required
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">
                {selectedItem ? formatUnit(selectedItem.baseUnit) : ""}
              </span>
            </div>
          </div>
        )}

        {/* Reason (MANDATORY) */}
        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1.5">
            سبب الحركة (إلزامي للرقابة والتدقيق) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثال: تلف أثناء التجهيز بالمطبخ، كسر زجاجات، أو فروقات جرد شهري"
            className="w-full px-3.5 py-2.5 text-xs bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 text-stone-800"
            required
          />
        </div>

        {/* Note / Reference */}
        <div>
          <label className="block text-xs font-bold text-stone-700 mb-1.5">
            ملاحظات أو مرجع إضافي (اختياري)
          </label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="اسم المسؤول المباشر عن الهدر، أو رقم تقرير التلف الداخلي..."
            className="w-full px-3.5 py-2.5 text-xs bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 text-stone-800"
          />
        </div>

        {/* Submit */}
        <div className="pt-4 border-t border-stone-200 flex items-center justify-end gap-3">
          <Link
            href="/inventory/items"
            className="px-4 py-2.5 text-xs font-bold text-stone-600 hover:text-stone-900 bg-cream-100 rounded-xl"
          >
            إلغاء
          </Link>

          <button
            type="submit"
            disabled={isSubmitting || !canPerformAdjustment}
            className="px-6 py-2.5 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 rounded-xl shadow-xs transition flex items-center gap-1.5"
          >
            <Scale className="w-4 h-4" />
            <span>مراجعة وتأكيد الحركة</span>
          </button>
        </div>
      </form>

      {/* Confirmation Modal */}
      {confirmModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-stone-200 p-6 md:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold font-cairo text-stone-900">
                  تأكيد تسجيل حركة المخزون
                </h3>
                <p className="text-xs text-stone-500">يرجى التأكد، هذه الحركة نهائية وغير قابلة للحذف</p>
              </div>
            </div>

            <div className="p-4 bg-cream-50 rounded-2xl border border-stone-200 space-y-2 text-xs mb-4">
              <div className="flex justify-between">
                <span className="text-stone-500">الصنف:</span>
                <span className="font-bold text-stone-900">{selectedItem.nameAr}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">نوع الحركة:</span>
                <span className="font-bold text-stone-900">{getMovementTypeConfig(movementType).label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">الرصيد الدفتري الحالي:</span>
                <span className="font-mono" dir="ltr">{selectedItem.currentStock} {formatUnit(selectedItem.baseUnit)}</span>
              </div>
              <div className="flex justify-between border-t border-stone-200 pt-2 font-bold text-stone-900">
                <span>الرصيد الجديد المتوقع:</span>
                <span className="font-mono text-forest-800" dir="ltr">
                  {movementType === "COUNT_RECONCILIATION"
                    ? `${countedQuantity} ${formatUnit(selectedItem.baseUnit)}`
                    : movementType === "WASTE" || movementType === "MANUAL_CONSUMPTION"
                    ? `${Number((selectedItem.currentStock - quantity).toFixed(2))} ${formatUnit(selectedItem.baseUnit)}`
                    : `${Number((selectedItem.currentStock + quantity).toFixed(2))} ${formatUnit(selectedItem.baseUnit)}`}
                </span>
              </div>
              <div className="pt-2 border-t border-stone-200 text-stone-600">
                <strong>السبب الموثق: </strong>
                <span>{reason}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setConfirmModalOpen(false)}
                disabled={isSubmitting}
                type="button"
                className="px-4 py-2 text-xs font-bold text-stone-600 hover:text-stone-900 bg-cream-100 rounded-xl"
              >
                رجوع للتعديل
              </button>
              <button
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                type="button"
                className="px-5 py-2 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 disabled:bg-stone-300 rounded-xl shadow-xs transition"
              >
                {isSubmitting ? "جاري التسجيل وتحديث الرصيد..." : "تأكيد واعتماد التسوية"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
