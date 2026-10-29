"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { formatArabicDateTime, formatCurrency, formatUnit, getPurchaseStatusConfig } from "@/lib/formatters";
import { inventoryService } from "@/services/inventory-service";
import { PurchaseReceipt, PurchaseReceiptStatus } from "@/types/inventory";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { InventoryNav } from "@/components/inventory/inventory-nav";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FileCheck2,
  FileClock,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Truck,
  X,
} from "lucide-react";

export function PurchasesList() {
  const [purchases, setPurchases] = useState<PurchaseReceipt[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReceipt, setSelectedReceipt] = useState<PurchaseReceipt | null>(null);
  const [isConfirmingId, setIsConfirmingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPurchases = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await inventoryService.getPurchases();
      setPurchases(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل تحميل أذون الشراء";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPurchases();
  }, []);

  const handleConfirmReceipt = async (receipt: PurchaseReceipt) => {
    if (isConfirmingId) return; // Prevent duplicate submission
    if (!confirm(`هل أنت متأكد من اعتماد إذن التوريد رقم ${receipt.receiptNumber}؟\nسيتم فوراً إضافة الكميات الواردة لأرصدة الأصناف وتسجيل الحركات.`)) {
      return;
    }

    setIsConfirmingId(receipt.id);
    try {
      const res = await inventoryService.confirmPurchase(receipt.id);
      setPurchases((prev) => prev.map((p) => (p.id === receipt.id ? res.receipt : p)));
      if (selectedReceipt?.id === receipt.id) {
        setSelectedReceipt(res.receipt);
      }
      toast.success(
        res.isContractLive
          ? "تم اعتماد إذن الشراء بنجاح وتحديث أرصدة المخزون بالخادم"
          : "تم اعتماد إذن الشراء بنجاح وزيادة أرصدة الأصناف وتسجيل الحركات."
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل اعتماد الإذن";
      toast.error(msg);
    } finally {
      setIsConfirmingId(null);
    }
  };

  // Filtered
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      const matchesStatus = statusFilter === "all" || p.status === statusFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        p.receiptNumber.toLowerCase().includes(q) ||
        (p.supplierName && p.supplierName.toLowerCase().includes(q)) ||
        (p.invoiceNumber && p.invoiceNumber.toLowerCase().includes(q));

      return matchesStatus && matchesSearch;
    });
  }, [purchases, statusFilter, searchQuery]);

  if (isLoading) {
    return <LoadingState message="جاري استرجاع فواتير وأذون استلام المشتريات..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadPurchases} />;
  }

  return (
    <div className="space-y-6">
      <InventoryNav />

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-stone-900 font-cairo">
              أذون استلام وتوريد المشتريات (Purchase Receipts)
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-forest-50 text-forest-800 font-bold border border-forest-200">
              {purchases.length} إذن مسجل
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            تسجيل فواتير الموردين، حساب معاملات التحويل، واعتماد استلام البضائع لزيادة الأرصدة
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/inventory/purchases/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-forest-900 hover:bg-forest-800 rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 text-gold-400" />
            <span>تسجيل إذن استلام جديد</span>
          </Link>
          <button
            onClick={loadPurchases}
            type="button"
            className="p-2 text-stone-500 hover:text-stone-900 hover:bg-cream-100 rounded-xl border border-stone-200 transition-colors"
            title="تحديث البيانات"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم الإذن أو المورد أو الفاتورة..."
              className="w-full pr-10 pl-3 py-2 text-xs bg-cream-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-700 text-stone-900"
            />
          </div>

          <div className="inline-flex rounded-xl bg-cream-100 p-1 border border-stone-200 text-xs font-semibold">
            <button
              onClick={() => setStatusFilter("all")}
              type="button"
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === "all" ? "bg-white text-forest-900 shadow-xs" : "text-stone-600"
              }`}
            >
              الكل ({purchases.length})
            </button>
            <button
              onClick={() => setStatusFilter("DRAFT")}
              type="button"
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === "DRAFT" ? "bg-white text-stone-900 shadow-xs" : "text-stone-600"
              }`}
            >
              مسودات فقط
            </button>
            <button
              onClick={() => setStatusFilter("CONFIRMED")}
              type="button"
              className={`px-3 py-1.5 rounded-lg transition ${
                statusFilter === "CONFIRMED" ? "bg-white text-emerald-800 shadow-xs" : "text-stone-600"
              }`}
            >
              معتمدة
            </button>
          </div>
        </div>

        <span className="text-xs text-stone-500 font-semibold">
          عرض {filteredPurchases.length} من {purchases.length} إذن
        </span>
      </div>

      {/* Receipts Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        {filteredPurchases.length === 0 ? (
          <div className="p-12 text-center">
            <Truck className="w-12 h-12 text-stone-300 mx-auto mb-3" />
            <h3 className="text-stone-800 font-bold font-cairo text-base">لا توجد أذون استلام مسجلة</h3>
            <p className="text-stone-500 text-xs mt-1">
              سجّل توريد جديد من الموردين لزيادة المخزون وتوثيق التكاليف
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-cream-50/80 border-b border-stone-200 text-stone-600 font-bold">
                <tr>
                  <th className="py-3.5 pr-4">رقم الإذن</th>
                  <th className="py-3.5">المورد وفاتورة الشراء</th>
                  <th className="py-3.5">تاريخ التوريد</th>
                  <th className="py-3.5">عدد الأصناف</th>
                  <th className="py-3.5">إجمالي الفاتورة</th>
                  <th className="py-3.5">حالة الإذن</th>
                  <th className="py-3.5">الاعتماد والمشرف</th>
                  <th className="py-3.5 pl-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredPurchases.map((receipt) => {
                  const statusConfig = getPurchaseStatusConfig(receipt.status);
                  const isDraft = receipt.status === "DRAFT";

                  return (
                    <tr key={receipt.id} className="hover:bg-cream-50/50 transition-colors">
                      <td className="py-3.5 pr-4 font-mono font-bold text-stone-900" dir="ltr">
                        {receipt.receiptNumber}
                      </td>
                      <td className="py-3.5">
                        <div className="font-bold text-stone-800">{receipt.supplierName || "مورد عام"}</div>
                        {receipt.invoiceNumber && (
                          <div className="text-[11px] text-stone-400 font-mono mt-0.5">
                            فاتورة: {receipt.invoiceNumber}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 text-stone-500 font-mono">
                        {formatArabicDateTime(receipt.receiptDate)}
                      </td>
                      <td className="py-3.5 font-bold text-stone-700">
                        {receipt.items.length} أصناف
                      </td>
                      <td className="py-3.5 font-black text-stone-900 font-cairo text-sm">
                        {formatCurrency(receipt.totalAmount)}
                      </td>
                      <td className="py-3.5">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-bold border ${statusConfig.bgClass} ${statusConfig.textClass} ${statusConfig.borderClass}`}
                        >
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="py-3.5 text-stone-500">
                        {receipt.confirmedAt ? (
                          <div>
                            <div className="text-emerald-700 font-semibold">{receipt.confirmedBy || "المشرف"}</div>
                            <div className="text-[10px] text-stone-400 font-mono">{formatArabicDateTime(receipt.confirmedAt)}</div>
                          </div>
                        ) : (
                          <span className="text-stone-400 text-[11px] italic">في انتظار الاعتماد</span>
                        )}
                      </td>
                      <td className="py-3.5 pl-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedReceipt(receipt)}
                            type="button"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-forest-800 bg-forest-50 hover:bg-forest-100 border border-forest-200 transition"
                            title="معاينة تفاصيل الإذن والأصناف"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>عرض</span>
                          </button>

                          {isDraft && (
                            <button
                              onClick={() => handleConfirmReceipt(receipt)}
                              disabled={isConfirmingId === receipt.id}
                              type="button"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:bg-stone-300 transition shadow-xs"
                              title="اعتماد الإذن وتحديث أرصدة المخزون"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{isConfirmingId === receipt.id ? "جاري الاعتماد..." : "اعتماد وتحديث الرصيد"}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receipt Details Modal */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-stone-200 p-6 md:p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-stone-100 mb-6">
              <div>
                <h3 className="text-lg font-bold font-cairo text-stone-900">
                  تفاصيل إذن استلام بضاعة: {selectedReceipt.receiptNumber}
                </h3>
                <p className="text-xs text-stone-500">
                  المورد: {selectedReceipt.supplierName} • {formatArabicDateTime(selectedReceipt.receiptDate)}
                </p>
              </div>
              <button
                onClick={() => setSelectedReceipt(null)}
                type="button"
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-xl hover:bg-cream-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Status bar */}
            <div className="mb-4 p-3 bg-cream-50 rounded-xl border border-stone-200 flex items-center justify-between text-xs">
              <div>
                <span className="text-stone-500 font-semibold">حالة الإذن: </span>
                <span className="font-bold text-stone-900">
                  {getPurchaseStatusConfig(selectedReceipt.status).label}
                </span>
              </div>
              <div className="font-bold text-forest-900 text-sm">
                الإجمالي: {formatCurrency(selectedReceipt.totalAmount)}
              </div>
            </div>

            {/* Items table */}
            <div className="space-y-2 mb-6">
              <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-2">الأصناف المستلمة:</h4>
              <div className="border border-stone-200 rounded-xl overflow-hidden">
                <table className="w-full text-right text-xs">
                  <thead className="bg-stone-50 text-stone-600 font-bold border-b border-stone-200">
                    <tr>
                      <th className="py-2.5 pr-3">الصنف</th>
                      <th className="py-2.5">كمية الشراء</th>
                      <th className="py-2.5">معامل التحويل</th>
                      <th className="py-2.5">الكمية الصافية للرصيد</th>
                      <th className="py-2.5">سعر الوحدة</th>
                      <th className="py-2.5 pl-3 text-left">إجمالي البند</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {selectedReceipt.items.map((it) => (
                      <tr key={it.id}>
                        <td className="py-2.5 pr-3 font-bold text-stone-900">
                          {it.itemNameAr}
                        </td>
                        <td className="py-2.5 font-mono" dir="ltr">
                          {it.purchaseQty} {formatUnit(it.purchaseUnit)}
                        </td>
                        <td className="py-2.5 font-mono text-stone-500" dir="ltr">
                          × {it.conversionFactor}
                        </td>
                        <td className="py-2.5 font-bold font-mono text-emerald-800" dir="ltr">
                          = {it.baseQty} {formatUnit(it.baseUnit)}
                        </td>
                        <td className="py-2.5 font-mono text-stone-700">
                          {formatCurrency(it.unitCost)}
                        </td>
                        <td className="py-2.5 pl-3 text-left font-bold text-stone-900 font-cairo">
                          {formatCurrency(it.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedReceipt.notes && (
              <div className="p-3 bg-cream-50 rounded-xl text-xs text-stone-600 mb-6">
                <strong>ملاحظات: </strong>
                {selectedReceipt.notes}
              </div>
            )}

            {/* Footer modal actions */}
            <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
              {selectedReceipt.status === "DRAFT" ? (
                <button
                  onClick={() => handleConfirmReceipt(selectedReceipt)}
                  disabled={isConfirmingId === selectedReceipt.id}
                  type="button"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>اعتماد الإذن وإضافة الأرصدة للمخزون فوراً</span>
                </button>
              ) : (
                <div className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تم اعتماد هذا الإذن وإضافته للأرصدة بنجاح</span>
                </div>
              )}

              <button
                onClick={() => setSelectedReceipt(null)}
                type="button"
                className="px-4 py-2 bg-cream-100 text-stone-700 font-bold rounded-xl text-xs hover:bg-cream-200 transition"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
