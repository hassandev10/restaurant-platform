"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatArabicDateTime, formatCurrency, formatUnit, getMovementTypeConfig } from "@/lib/formatters";
import { inventoryService } from "@/services/inventory-service";
import { InventoryAlert, InventoryMovement, InventoryOverviewSummary, PurchaseReceipt } from "@/types/inventory";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { ContractUnavailableBanner } from "@/components/shared/contract-unavailable-banner";
import { InventoryNav } from "@/components/inventory/inventory-nav";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  DollarSign,
  History,
  Package,
  Plus,
  RefreshCw,
  Scale,
  ShoppingCart,
  TrendingDown,
  Warehouse,
  XCircle,
} from "lucide-react";

export function InventoryOverview() {
  const [summary, setSummary] = useState<InventoryOverviewSummary | null>(null);
  const [recentMovements, setRecentMovements] = useState<InventoryMovement[]>([]);
  const [recentPurchases, setRecentPurchases] = useState<PurchaseReceipt[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<InventoryAlert[]>([]);
  const [isContractLive, setIsContractLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sumRes, movements, purchases, alerts] = await Promise.all([
        inventoryService.getSummary(),
        inventoryService.getMovements(),
        inventoryService.getPurchases(),
        inventoryService.getAlerts({ status: "ACTIVE" }),
      ]);
      setSummary(sumRes.summary);
      setIsContractLive(sumRes.isContractLive);
      setRecentMovements(movements.slice(0, 6));
      setRecentPurchases(purchases.slice(0, 4));
      setActiveAlerts(alerts.slice(0, 5));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل تحميل ملخص المخزون";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (isLoading) {
    return <LoadingState message="جاري استرجاع مؤشرات المخزون وحركات الصرف والتوريد..." />;
  }

  if (error || !summary) {
    return <ErrorState message={error || "تعذر تحميل البيانات"} onRetry={loadData} />;
  }

  const contracts = inventoryService.getMissingContracts();

  return (
    <div className="space-y-6">
      <InventoryNav />

      {/* Contract Banner */}
      {!isContractLive && (
        <ContractUnavailableBanner
          title="عقود ومواصفات واجهات إدارة المخزون (Inventory Management Module)"
          moduleNameAr="نظام إدارة المخزون والمشتريات والوصفات"
          contracts={contracts}
          alternativeActionDescription="تم تفعيل كافة العمليات وحسابات الأرصدة والتحويلات محلياً في الواجهة الأمامية وفق معايير العقود الموثقة أدناه حتى يتم ربط الـ Migrations في خادم Go Backend."
        />
      )}

      {/* Top Banner with Quick Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-stone-900 font-cairo">
              لوحة الرقابة على المخزون والمستودع
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-forest-50 text-forest-800 font-bold border border-forest-200">
              {summary.totalItemsCount} صنف مسجل
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            متابعة دقيقة للأرصدة الفعلية، أذون الاستلام، استهلاك المطبخ، والتسويات الجردية
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Link
            href="/inventory/purchases/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-forest-900 hover:bg-forest-800 text-white rounded-xl shadow-xs transition"
          >
            <ShoppingCart className="w-4 h-4 text-gold-400" />
            <span>تسجيل إذن شراء جديد</span>
          </Link>

          <Link
            href="/inventory/adjustments"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl transition"
          >
            <Scale className="w-4 h-4 text-amber-700" />
            <span>تسوية / هدر / جرد</span>
          </Link>

          <Link
            href="/inventory/items/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-cream-100 hover:bg-cream-200 text-stone-800 border border-stone-300 rounded-xl transition"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة صنف</span>
          </Link>

          <button
            onClick={loadData}
            type="button"
            className="p-2 text-stone-500 hover:text-stone-900 hover:bg-cream-100 rounded-xl border border-stone-200 transition-colors"
            title="تحديث البيانات"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Active Items */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              إجمالي أصناف المخزون
            </span>
            <div className="w-10 h-10 rounded-xl bg-forest-50 text-forest-700 flex items-center justify-center">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black font-cairo text-stone-900">
            {summary.totalItemsCount} <span className="text-xs font-normal text-stone-500">صنف</span>
          </div>
          <div className="mt-2 text-xs text-stone-500 flex items-center justify-between">
            <span>{summary.rawIngredientsCount} مادة خام</span>
            <span className="font-semibold text-purple-700">{summary.finishedGoodsCount} منتج مباع</span>
          </div>
        </div>

        {/* Low Stock Items */}
        <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
              أصناف تحت حد الأمان
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black font-cairo text-amber-700">
            {summary.lowStockItemsCount} <span className="text-xs font-normal text-amber-600">صنف منخفض</span>
          </div>
          <div className="mt-2 text-xs text-amber-800 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>يتطلب إصدار أوامر شراء عاجلة</span>
          </div>
        </div>

        {/* Out of Stock & Negative */}
        <div className="bg-white p-5 rounded-2xl border border-red-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-red-800 uppercase tracking-wider">
              أصناف نفدت بالكامل
            </span>
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-700 flex items-center justify-center">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black font-cairo text-red-700">
            {summary.outOfStockItemsCount} <span className="text-xs font-normal text-red-600">صنف صفر</span>
          </div>
          <div className="mt-2 text-xs text-stone-500 flex items-center justify-between">
            <span>{summary.negativeStockItemsCount} رصيد سالب</span>
            <Link href="/inventory/alerts" className="text-xs font-bold text-red-600 hover:underline">
              عرض التنبيهات
            </Link>
          </div>
        </div>

        {/* Inventory Value */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              القيمة التقديرية للمخزون
            </span>
            <div className="w-10 h-10 rounded-xl bg-gold-50 text-gold-700 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black font-cairo text-stone-900">
            {formatCurrency(summary.estimatedInventoryValue)}
          </div>
          <div className="mt-2 text-[11px] text-stone-400">
            محسوبة استناداً لمتوسط سعر تكلفة آخر توريد
          </div>
        </div>
      </div>

      {/* Grid: Open Alerts & Recent Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Open Alerts Panel */}
        <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-stone-900 font-cairo text-sm">
                تنبيهات المخزون العاجلة ({activeAlerts.length})
              </h3>
            </div>
            <Link
              href="/inventory/alerts"
              className="text-xs font-bold text-forest-700 hover:text-forest-900 flex items-center gap-1"
            >
              <span>عرض الكل</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="flex-1 space-y-2.5">
            {activeAlerts.length === 0 ? (
              <div className="text-center py-8 text-stone-400 text-xs">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                <span>كافة الأصناف ضمن الحدود الآمنة للمخزون</span>
              </div>
            ) : (
              activeAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-2 ${
                    alert.alertType === "OUT_OF_STOCK"
                      ? "bg-red-50/70 border-red-200 text-red-900"
                      : alert.alertType === "NEGATIVE_STOCK"
                      ? "bg-rose-50 border-rose-200 text-rose-900"
                      : "bg-amber-50/70 border-amber-200 text-amber-900"
                  }`}
                >
                  <div>
                    <div className="font-bold font-cairo">{alert.itemNameAr}</div>
                    <div className="text-[11px] mt-0.5 opacity-80">
                      الرصيد: <strong dir="ltr">{alert.currentBalance} {formatUnit(alert.unit)}</strong> (حد الأمان: {alert.minThreshold})
                    </div>
                  </div>
                  <Link
                    href={`/inventory/items/${alert.itemId}`}
                    className="px-2 py-1 bg-white rounded-lg font-bold text-[10px] shadow-2xs hover:bg-stone-50 border border-stone-200"
                  >
                    فحص
                  </Link>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Movements Ledger Preview */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-stone-200 p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
            <div>
              <h3 className="font-bold text-stone-900 font-cairo text-sm">
                أحدث حركات الصرف والتوريد (Audit Ledger)
              </h3>
              <p className="text-xs text-stone-400">سجل غير قابل للتعديل يوثق كل إضافة أو خصم</p>
            </div>
            <Link
              href="/inventory/movements"
              className="text-xs font-bold text-forest-700 hover:text-forest-900 flex items-center gap-1"
            >
              <span>سجل الحركات الكامل</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="flex-1 overflow-x-auto">
            {recentMovements.length === 0 ? (
              <div className="text-center py-8 text-stone-400 text-xs">
                لا توجد حركات مخزنية مسجلة حتى الآن
              </div>
            ) : (
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-stone-100 text-stone-500 font-semibold">
                    <th className="pb-2.5">الوقت</th>
                    <th className="pb-2.5">الصنف</th>
                    <th className="pb-2.5">نوع الحركة</th>
                    <th className="pb-2.5">الكمية</th>
                    <th className="pb-2.5">الرصيد بعد</th>
                    <th className="pb-2.5">المرجع والسبب</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {recentMovements.map((mov) => {
                    const typeConfig = getMovementTypeConfig(mov.movementType);
                    const isPositive = mov.quantity > 0;

                    return (
                      <tr key={mov.id} className="hover:bg-cream-50/50">
                        <td className="py-2.5 text-stone-500 font-mono text-[11px]">
                          {formatArabicDateTime(mov.timestamp)}
                        </td>
                        <td className="py-2.5 font-bold text-stone-900">
                          {mov.itemNameAr}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${typeConfig.bgClass} ${typeConfig.textClass} ${typeConfig.borderClass}`}
                          >
                            {typeConfig.label}
                          </span>
                        </td>
                        <td className="py-2.5 font-bold font-mono" dir="ltr">
                          <span className={isPositive ? "text-emerald-700" : "text-red-700"}>
                            {isPositive ? `+${mov.quantity}` : mov.quantity} {formatUnit(mov.unit)}
                          </span>
                        </td>
                        <td className="py-2.5 font-mono text-stone-700 font-semibold" dir="ltr">
                          {mov.balanceAfter} {formatUnit(mov.unit)}
                        </td>
                        <td className="py-2.5 text-stone-500 max-w-[200px] truncate" title={mov.reason}>
                          {mov.referenceId && <strong className="text-stone-700 font-mono">[{mov.referenceId}] </strong>}
                          {mov.reason}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
