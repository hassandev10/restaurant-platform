"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { formatCurrency, formatUnit } from "@/lib/formatters";
import { inventoryService } from "@/services/inventory-service";
import {
  CreatePurchaseReceiptItemRequest,
  InventoryItem,
  InventoryPurchaseUnit,
} from "@/types/inventory";
import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  CheckCircle2,
  FileClock,
  Plus,
  Receipt,
  ShoppingCart,
  Trash2,
} from "lucide-react";

interface FormLineItem {
  id: string;
  itemId: string;
  purchaseQty: number;
  purchaseUnit: InventoryPurchaseUnit;
  conversionFactor: number;
  unitCost: number;
}

interface PurchaseFormProps {
  initialItemId?: string;
}

export function PurchaseForm({ initialItemId }: PurchaseFormProps = {}) {
  const router = useRouter();
  const [itemsList, setItemsList] = useState<InventoryItem[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [supplierName, setSupplierName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [receiptDate, setReceiptDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");

  const [lineItems, setLineItems] = useState<FormLineItem[]>([
    {
      id: "line-1",
      itemId: "",
      purchaseQty: 1,
      purchaseUnit: "kg",
      conversionFactor: 1,
      unitCost: 0,
    },
  ]);

  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  useEffect(() => {
    inventoryService
      .getItems()
      .then((data) => {
        setItemsList(data);
        if (data.length > 0) {
          const matched = initialItemId ? data.find((i) => i.id === initialItemId) : null;
          const chosen = matched || data[0];
          setLineItems([
            {
              id: "line-1",
              itemId: chosen.id,
              purchaseQty: 1,
              purchaseUnit: chosen.purchaseUnit || chosen.baseUnit,
              conversionFactor: chosen.conversionFactor || 1,
              unitCost: chosen.costPerBaseUnit * (chosen.conversionFactor || 1),
            },
          ]);
        }
      })
      .finally(() => setIsLoadingItems(false));
  }, [initialItemId]);

  const handleItemChange = (index: number, itemId: string) => {
    const selected = itemsList.find((i) => i.id === itemId);
    if (!selected) return;

    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        itemId,
        purchaseUnit: selected.purchaseUnit || selected.baseUnit,
        conversionFactor: selected.conversionFactor || 1,
        unitCost: selected.costPerBaseUnit * (selected.conversionFactor || 1),
      };
      return updated;
    });
  };

  const handleUpdateLine = (index: number, updates: Partial<FormLineItem>) => {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], ...updates };
      return updated;
    });
  };

  const handleAddLine = () => {
    const defaultItem = itemsList[0];
    setLineItems((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}`,
        itemId: defaultItem?.id || "",
        purchaseQty: 1,
        purchaseUnit: defaultItem?.purchaseUnit || defaultItem?.baseUnit || "kg",
        conversionFactor: defaultItem?.conversionFactor || 1,
        unitCost: (defaultItem?.costPerBaseUnit || 0) * (defaultItem?.conversionFactor || 1),
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lineItems.length <= 1) {
      toast.error("يجب أن يحتوي إذن الاستلام على صنف واحد على الأقل");
      return;
    }
    setLineItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Calculations
  const calculatedLines = useMemo(() => {
    return lineItems.map((line) => {
      const invItem = itemsList.find((i) => i.id === line.itemId);
      const factor = Number(line.conversionFactor) || 1;
      const baseQty = Number((line.purchaseQty * factor).toFixed(2));
      const lineTotal = Number((line.purchaseQty * line.unitCost).toFixed(2));

      return {
        ...line,
        itemNameAr: invItem?.nameAr || "صنف مخزون",
        baseUnit: invItem?.baseUnit || "kg",
        baseQty,
        lineTotal,
      };
    });
  }, [lineItems, itemsList]);

  const totalReceiptAmount = useMemo(() => {
    return calculatedLines.reduce((sum, line) => sum + line.lineTotal, 0);
  }, [calculatedLines]);

  const handleSaveDraft = async () => {
    if (calculatedLines.some((l) => !l.itemId || l.purchaseQty <= 0)) {
      toast.error("يرجى التأكد من اختيار الأصناف وتحديد كميات شراء صالحة");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreatePurchaseReceiptItemRequest[] = calculatedLines.map((l) => ({
        itemId: l.itemId,
        purchaseQty: l.purchaseQty,
        purchaseUnit: l.purchaseUnit,
        conversionFactor: l.conversionFactor,
        unitCost: l.unitCost,
      }));

      const res = await inventoryService.createPurchaseDraft({
        supplierName: supplierName.trim() || undefined,
        invoiceNumber: invoiceNumber.trim() || undefined,
        receiptDate: new Date(receiptDate).toISOString(),
        notes: notes.trim() || undefined,
        items: payload,
      });

      toast.success(
        res.isContractLive
          ? "تم حفظ مسودة إذن الاستلام في الخادم بنجاح (دون زيادة الرصيد)"
          : "تم حفظ مسودة إذن الاستلام بنجاح (دون زيادة الرصيد حتى يتم الاعتماد)"
      );
      router.push("/inventory/purchases");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل حفظ المسودة";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmAndAddStock = async () => {
    if (calculatedLines.some((l) => !l.itemId || l.purchaseQty <= 0)) {
      toast.error("يرجى التأكد من اختيار الأصناف وتحديد كميات صالحة");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: CreatePurchaseReceiptItemRequest[] = calculatedLines.map((l) => ({
        itemId: l.itemId,
        purchaseQty: l.purchaseQty,
        purchaseUnit: l.purchaseUnit,
        conversionFactor: l.conversionFactor,
        unitCost: l.unitCost,
      }));

      // Create draft first
      const draftRes = await inventoryService.createPurchaseDraft({
        supplierName: supplierName.trim() || undefined,
        invoiceNumber: invoiceNumber.trim() || undefined,
        receiptDate: new Date(receiptDate).toISOString(),
        notes: notes.trim() || undefined,
        items: payload,
      });

      // Confirm immediately
      const confirmRes = await inventoryService.confirmPurchase(draftRes.receipt.id);

      toast.success(
        confirmRes.isContractLive
          ? "تم اعتماد إذن الشراء وإضافة الأرصدة في قاعدة البيانات بنجاح"
          : "تم اعتماد إذن الشراء بنجاح وزيادة أرصدة الأصناف وتسجيل الحركات."
      );
      setConfirmModalOpen(false);
      router.push("/inventory/purchases");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل اعتماد الإذن";
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <Link
          href="/inventory/purchases"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-stone-900 bg-white px-3 py-1.5 rounded-xl border border-stone-200 transition"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة لقائمة أذون التوريد</span>
        </Link>
        <span className="text-xs text-stone-400">إذن استلام بضاعة ومشتريات جديد</span>
      </div>

      <div className="bg-white rounded-3xl border border-stone-200 p-6 md:p-8 shadow-xs space-y-6">
        <div className="flex items-start justify-between pb-4 border-b border-stone-100">
          <div>
            <h2 className="text-lg font-bold font-cairo text-stone-900">
              تسجيل إذن استلام بضاعة ومشتريات
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              إدخال الكميات الموردة بوحدات الشراء وتحويلها تلقائياً للكمية الصافية للرصيد
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-forest-50 text-forest-700 flex items-center justify-center">
            <ShoppingCart className="w-5 h-5" />
          </div>
        </div>

        {/* Supplier & Receipt Info */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              اسم المورد / الشركة
            </label>
            <input
              type="text"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              placeholder="مثال: شركة النيل للمواد الغذائية"
              className="w-full px-3.5 py-2.5 text-xs bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 text-stone-800"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              رقم فاتورة المورد (اختياري)
            </label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="مثال: INV-98124"
              dir="ltr"
              className="w-full px-3.5 py-2.5 text-xs bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 text-stone-800 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1.5">
              تاريخ استلام البضاعة <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={receiptDate}
              onChange={(e) => setReceiptDate(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-cream-50 border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 text-stone-800"
              required
            />
          </div>
        </div>

        {/* Line Items Table */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
              قائمة الأصناف المستلمة:
            </h3>
            <button
              onClick={handleAddLine}
              type="button"
              className="inline-flex items-center gap-1 text-xs font-bold text-forest-700 hover:text-forest-900 bg-forest-50 px-3 py-1.5 rounded-lg border border-forest-200 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة صنف آخر</span>
            </button>
          </div>

          <div className="space-y-3">
            {calculatedLines.map((line, idx) => (
              <div
                key={line.id}
                className="p-4 rounded-2xl border border-stone-200 bg-cream-50/50 space-y-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-600 font-mono">بند #{idx + 1}</span>
                  {calculatedLines.length > 1 && (
                    <button
                      onClick={() => handleRemoveLine(idx)}
                      type="button"
                      className="text-red-600 hover:text-red-700 p-1"
                      title="حذف هذا البند"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
                  {/* Select Item */}
                  <div className="lg:col-span-2">
                    <label className="block font-bold text-stone-700 mb-1">الصنف المخزني</label>
                    <select
                      value={line.itemId}
                      onChange={(e) => handleItemChange(idx, e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-xl focus:ring-2 focus:ring-forest-700 text-stone-800"
                    >
                      {itemsList.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.nameAr} ({item.sku})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Purchase Quantity & Unit */}
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">كمية الشراء</label>
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        step="any"
                        min="0.1"
                        value={line.purchaseQty}
                        onChange={(e) => handleUpdateLine(idx, { purchaseQty: parseFloat(e.target.value) || 0 })}
                        className="w-20 px-2.5 py-2 text-xs bg-white border border-stone-300 rounded-xl font-mono text-stone-800"
                        required
                      />
                      <select
                        value={line.purchaseUnit}
                        onChange={(e) => handleUpdateLine(idx, { purchaseUnit: e.target.value as InventoryPurchaseUnit })}
                        className="flex-1 px-2 py-2 text-xs bg-white border border-stone-300 rounded-xl text-stone-800"
                      >
                        <option value="kg">كجم</option>
                        <option value="g">جرام</option>
                        <option value="l">لتر</option>
                        <option value="piece">قطعة</option>
                        <option value="carton">كرتونة</option>
                        <option value="box">علبة</option>
                        <option value="sack">شيكارة</option>
                        <option value="can">كانز</option>
                      </select>
                    </div>
                  </div>

                  {/* Conversion Factor */}
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">
                      معامل التحويل (×)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.01"
                      value={line.conversionFactor}
                      onChange={(e) => handleUpdateLine(idx, { conversionFactor: parseFloat(e.target.value) || 1 })}
                      className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-xl font-mono text-stone-800"
                      title="كم وحدة أساسية في كل وحدة شراء"
                    />
                  </div>

                  {/* Unit Cost */}
                  <div>
                    <label className="block font-bold text-stone-700 mb-1">سعر الشراء للوحدة</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={line.unitCost}
                        onChange={(e) => handleUpdateLine(idx, { unitCost: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-xl font-mono text-stone-800"
                        required
                      />
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-stone-400">ج.م</span>
                    </div>
                  </div>
                </div>

                {/* Calculated preview for this line */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs pt-2 border-t border-stone-200/60 text-stone-600 gap-2">
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-stone-400">الكمية الصافية للرصيد:</span>
                    <strong className="text-forest-900 bg-white px-2 py-0.5 rounded border border-stone-200">
                      = {line.baseQty} {formatUnit(line.baseUnit)}
                    </strong>
                    <span className="text-stone-400 text-[11px]">
                      ({line.purchaseQty} {formatUnit(line.purchaseUnit)} × {line.conversionFactor})
                    </span>
                  </div>

                  <div className="font-bold text-stone-900">
                    إجمالي البند: <span className="text-forest-800 font-cairo">{formatCurrency(line.lineTotal)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Overall Total and Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-stone-100">
          <div>
            <label className="block text-xs font-bold text-stone-700 mb-1">ملاحظات إضافية</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="رقم أمر الشراء، حالة البضاعة المستلمة، أو اسم السائق..."
              className="w-full px-3 py-2 text-xs bg-cream-50 border border-stone-300 rounded-xl text-stone-800"
            />
          </div>

          <div className="bg-forest-950 text-cream-100 p-5 rounded-2xl flex flex-col justify-between">
            <span className="text-xs text-gold-400 font-bold uppercase tracking-wider">
              إجمالي قيمة فاتورة الشراء:
            </span>
            <div className="text-2xl font-black font-cairo text-white">
              {formatCurrency(totalReceiptAmount)}
            </div>
            <div className="text-[11px] text-cream-300/80 mt-1">
              {calculatedLines.length} أصناف جاهزة للإدراج في دورة التوريد
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-stone-500">
            * حفظ المسودة لا يزيد الأرصدة حتى يتم الاعتماد رسمياً لمنع ازدواجية الحركات.
          </p>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={handleSaveDraft}
              disabled={isSubmitting}
              type="button"
              className="px-4 py-2.5 text-xs font-bold text-stone-700 bg-cream-100 hover:bg-cream-200 rounded-xl transition flex items-center gap-1.5"
            >
              <FileClock className="w-4 h-4 text-stone-500" />
              <span>حفظ كمسودة فقط</span>
            </button>

            <button
              onClick={() => setConfirmModalOpen(true)}
              disabled={isSubmitting}
              type="button"
              className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl shadow-xs transition flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-200" />
              <span>مراجعة واعتماد التوريد فوراً</span>
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-stone-200 p-6 md:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold font-cairo text-stone-900">
                  تأكيد اعتماد إذن استلام المشتريات
                </h3>
                <p className="text-xs text-stone-500">
                  يرجى مراجعة الكميات الصافية المحتسبة قبل تحديث الأرصدة
                </p>
              </div>
            </div>

            <div className="space-y-2 mb-6 max-h-56 overflow-y-auto pr-1">
              {calculatedLines.map((line, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-cream-50 border border-stone-200 text-xs flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-stone-900">{line.itemNameAr}</div>
                    <div className="text-[11px] text-stone-500 mt-0.5">
                      {line.purchaseQty} {formatUnit(line.purchaseUnit)} × {line.conversionFactor}
                    </div>
                  </div>
                  <div className="font-bold font-mono text-emerald-800 text-sm" dir="ltr">
                    +{line.baseQty} {formatUnit(line.baseUnit)}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 mb-6 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                بمجرد التأكيد، ستتم إضافة هذه الكميات فورياً لأرصدة الأصناف بالمستودع وتسجيل حركات توريد غير قابلة للتراجع في السجل المالي.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                onClick={() => setConfirmModalOpen(false)}
                disabled={isSubmitting}
                type="button"
                className="px-4 py-2 text-xs font-bold text-stone-600 hover:text-stone-900 bg-cream-100 rounded-xl"
              >
                تعديل البيانات
              </button>
              <button
                onClick={handleConfirmAndAddStock}
                disabled={isSubmitting}
                type="button"
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:bg-stone-300 rounded-xl shadow-xs transition"
              >
                {isSubmitting ? "جاري الاعتماد وتحديث الرصيد..." : "تأكيد الاعتماد النهائي"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
