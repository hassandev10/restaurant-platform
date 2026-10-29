"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatArabicDateTime, formatCurrency, formatUnit, getItemCategoryLabel, getItemTypeConfig, getMovementTypeConfig } from "@/lib/formatters";
import { inventoryService } from "@/services/inventory-service";
import { InventoryItem, InventoryMovement } from "@/types/inventory";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { ItemForm } from "./item-form";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock,
  DollarSign,
  Edit2,
  History,
  Lock,
  Plus,
  Scale,
  ShoppingCart,
  TrendingDown,
  XCircle,
} from "lucide-react";

interface ItemDetailsProps {
  itemId: string;
  initialEditMode?: boolean;
}

export function ItemDetails({ itemId, initialEditMode = false }: ItemDetailsProps) {
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [isEditing, setIsEditing] = useState(initialEditMode);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [itemData, movementsData] = await Promise.all([
        inventoryService.getItem(itemId),
        inventoryService.getMovements({ itemId }),
      ]);
      setItem(itemData);
      setMovements(movementsData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل تحميل تفاصيل الصنف";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [itemId]);

  if (isLoading) {
    return <LoadingState message="جاري استرجاع بيانات وسجل الصنف المخزني..." />;
  }

  if (error || !item) {
    return <ErrorState message={error || "الصنف غير موجود"} onRetry={loadData} />;
  }

  if (isEditing) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setIsEditing(false)}
          type="button"
          className="text-xs text-stone-500 hover:text-stone-900 font-bold mb-2 inline-flex items-center gap-1"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          <span>إلغاء وضع التعديل والعودة للتفاصيل</span>
        </button>
        <ItemForm initialItem={item} isEditing={true} />
      </div>
    );
  }

  const typeConfig = getItemTypeConfig(item.type);
  const isLow = item.currentStock > 0 && item.currentStock <= item.minStockThreshold;
  const isOut = item.currentStock <= 0;
  const itemValue = Math.max(0, item.currentStock) * item.costPerBaseUnit;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Link
            href="/inventory/items"
            className="p-2 rounded-xl bg-white border border-stone-200 text-stone-600 hover:text-stone-900 transition"
          >
            <ArrowRight className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-stone-200 text-stone-800" dir="ltr">
                {item.sku}
              </span>
              <h1 className="text-xl font-bold font-cairo text-stone-900">{item.nameAr}</h1>
            </div>
            {item.nameEn && <p className="text-xs text-stone-400 font-mono mt-0.5" dir="ltr">{item.nameEn}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsEditing(true)}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-stone-700 bg-white hover:bg-cream-100 border border-stone-200 rounded-xl transition"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>تعديل المواصفات</span>
          </button>

          <Link
            href="/inventory/purchases/new"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-forest-900 hover:bg-forest-800 rounded-xl shadow-xs transition"
          >
            <ShoppingCart className="w-3.5 h-3.5 text-gold-400" />
            <span>تسجيل توريد</span>
          </Link>

          <Link
            href="/inventory/adjustments"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition"
          >
            <Scale className="w-3.5 h-3.5 text-amber-700" />
            <span>تسوية / هدر</span>
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Current Balance */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-bold text-stone-500 block mb-1">الرصيد الفعلي الحالي</span>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-3xl font-black font-mono ${
                isOut ? "text-red-600" : isLow ? "text-amber-600" : "text-emerald-700"
              }`}
              dir="ltr"
            >
              {item.currentStock}
            </span>
            <span className="text-xs font-bold text-stone-600">{formatUnit(item.baseUnit)}</span>
          </div>
          <div className="mt-2 text-xs">
            {isOut ? (
              <span className="text-red-600 font-bold flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5" />
                <span>الرصيد نافد بالكامل!</span>
              </span>
            ) : isLow ? (
              <span className="text-amber-600 font-bold flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>مخزون منخفض تحت حد الأمان</span>
              </span>
            ) : (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>الرصيد آمن وفي النطاق الطبيعي</span>
              </span>
            )}
          </div>
        </div>

        {/* Safety Threshold */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-bold text-stone-500 block mb-1">حد الأمان الأدنى (Min Alert)</span>
          <div className="text-2xl font-black font-cairo text-stone-900 font-mono" dir="ltr">
            {item.minStockThreshold} <span className="text-xs font-normal text-stone-500">{formatUnit(item.baseUnit)}</span>
          </div>
          <p className="text-[11px] text-stone-400 mt-2">
            يتم إرسال إشعار فوري عند انخفاض الرصيد عن هذا الحد
          </p>
        </div>

        {/* Unit Cost */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-bold text-stone-500 block mb-1">تكلفة الوحدة الأساسية</span>
          <div className="text-2xl font-black font-cairo text-stone-900">
            {formatCurrency(item.costPerBaseUnit)}
          </div>
          <p className="text-[11px] text-stone-400 mt-2">
            لكل {formatUnit(item.baseUnit)}
          </p>
        </div>

        {/* Total Stock Value */}
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs">
          <span className="text-xs font-bold text-stone-500 block mb-1">إجمالي قيمة الرصيد بالمستودع</span>
          <div className="text-2xl font-black font-cairo text-forest-800">
            {formatCurrency(itemValue)}
          </div>
          <p className="text-[11px] text-stone-400 mt-2">
            الرصيد الفعلي × تكلفة الوحدة
          </p>
        </div>
      </div>

      {/* Specifications & Conversion Card */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
        <h3 className="text-sm font-bold font-cairo text-stone-900 mb-4 pb-2 border-b border-stone-100">
          المواصفات الفنية وقواعد التحويل
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="p-3 rounded-xl bg-cream-50 border border-stone-200">
            <span className="text-stone-400 block mb-0.5">نوع الصنف</span>
            <span className="font-bold text-stone-800">{typeConfig.label}</span>
          </div>

          <div className="p-3 rounded-xl bg-cream-50 border border-stone-200">
            <span className="text-stone-400 block mb-0.5">التصنيف</span>
            <span className="font-bold text-stone-800">{getItemCategoryLabel(item.category)}</span>
          </div>

          <div className="p-3 rounded-xl bg-cream-50 border border-stone-200">
            <span className="text-stone-400 block mb-0.5">وحدة الصرف والوصفات</span>
            <span className="font-bold text-stone-800">{formatUnit(item.baseUnit)} ({item.baseUnit})</span>
          </div>

          <div className="p-3 rounded-xl bg-cream-50 border border-stone-200">
            <span className="text-stone-400 block mb-0.5">معادلة الشراء والتوريد</span>
            <span className="font-bold text-forest-900 font-mono" dir="ltr">
              1 {formatUnit(item.purchaseUnit || item.baseUnit)} = {item.conversionFactor || 1} {formatUnit(item.baseUnit)}
            </span>
          </div>
        </div>

        {item.description && (
          <div className="mt-4 p-3 rounded-xl bg-cream-50/50 text-xs text-stone-600 border border-stone-200">
            <strong className="text-stone-800 block mb-1">الوصف والملاحظات:</strong>
            {item.description}
          </div>
        )}
      </div>

      {/* Specific Movement Ledger for this item */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-stone-100 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-forest-50 text-forest-700 flex items-center justify-center">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-stone-900 font-cairo">
                سجل حركات الصنف ({movements.length} حركة)
              </h3>
              <p className="text-[11px] text-stone-400">سجل تدقيق غير قابل للتعديل يوثق كل توريد واستهلاك وتسوية</p>
            </div>
          </div>
        </div>

        {movements.length === 0 ? (
          <div className="text-center py-8 text-stone-400 text-xs">
            لا توجد حركات مخزنية مسجلة لهذا الصنف حتى الآن
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-cream-50/80 border-b border-stone-200 text-stone-600 font-bold">
                <tr>
                  <th className="py-3 pr-3">التاريخ والوقت</th>
                  <th className="py-3">نوع الحركة</th>
                  <th className="py-3">الكمية</th>
                  <th className="py-3">الرصيد قبل</th>
                  <th className="py-3">الرصيد بعد</th>
                  <th className="py-3">المرجع</th>
                  <th className="py-3">السبب والمشرف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {movements.map((mov) => {
                  const typeCfg = getMovementTypeConfig(mov.movementType);
                  const isPositive = mov.quantity > 0;

                  return (
                    <tr key={mov.id} className="hover:bg-cream-50/50">
                      <td className="py-3 pr-3 text-stone-500 font-mono text-[11px]">
                        {formatArabicDateTime(mov.timestamp)}
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${typeCfg.bgClass} ${typeCfg.textClass} ${typeCfg.borderClass}`}
                        >
                          {typeCfg.label}
                        </span>
                      </td>
                      <td className="py-3 font-bold font-mono text-sm" dir="ltr">
                        <span className={isPositive ? "text-emerald-700" : "text-red-700"}>
                          {isPositive ? `+${mov.quantity}` : mov.quantity} {formatUnit(mov.unit)}
                        </span>
                      </td>
                      <td className="py-3 font-mono text-stone-500" dir="ltr">
                        {mov.balanceBefore !== undefined ? `${mov.balanceBefore} ${formatUnit(mov.unit)}` : "—"}
                      </td>
                      <td className="py-3 font-mono font-bold text-stone-900" dir="ltr">
                        {mov.balanceAfter} {formatUnit(mov.unit)}
                      </td>
                      <td className="py-3 font-mono text-stone-700">
                        {mov.referenceId || "—"}
                      </td>
                      <td className="py-3 text-stone-600">
                        <div>{mov.reason}</div>
                        {mov.actor && <span className="text-[10px] text-stone-400">بواسطة: {mov.actor}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
