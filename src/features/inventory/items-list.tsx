"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { formatCurrency, formatUnit, getItemCategoryLabel, getItemTypeConfig } from "@/lib/formatters";
import { inventoryService } from "@/services/inventory-service";
import { InventoryItem, InventoryItemType, ItemCategory } from "@/types/inventory";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { InventoryNav } from "@/components/inventory/inventory-nav";
import {
  AlertTriangle,
  ArrowUpDown,
  Boxes,
  CheckCircle2,
  Edit2,
  Eye,
  Filter,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";

export function ItemsList() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [stockStatusFilter, setStockStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "stock" | "cost">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const loadItems = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await inventoryService.getItems();
      setItems(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل استرجاع أصناف المخزون";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  // Filtered and Sorted
  const filteredItems = useMemo(() => {
    let result = items.filter((item) => {
      const matchesType = typeFilter === "all" || item.type === typeFilter;
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;

      let matchesStock = true;
      if (stockStatusFilter === "low") {
        matchesStock = item.currentStock > 0 && item.currentStock <= item.minStockThreshold;
      } else if (stockStatusFilter === "out") {
        matchesStock = item.currentStock <= 0;
      } else if (stockStatusFilter === "available") {
        matchesStock = item.currentStock > item.minStockThreshold;
      }

      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.nameAr.toLowerCase().includes(q) ||
        (item.nameEn && item.nameEn.toLowerCase().includes(q)) ||
        item.sku.toLowerCase().includes(q);

      return matchesType && matchesCategory && matchesStock && matchesSearch;
    });

    result.sort((a, b) => {
      if (sortBy === "name") {
        return sortOrder === "asc"
          ? a.nameAr.localeCompare(b.nameAr, "ar")
          : b.nameAr.localeCompare(a.nameAr, "ar");
      }
      if (sortBy === "stock") {
        return sortOrder === "asc" ? a.currentStock - b.currentStock : b.currentStock - a.currentStock;
      }
      if (sortBy === "cost") {
        return sortOrder === "asc" ? a.costPerBaseUnit - b.costPerBaseUnit : b.costPerBaseUnit - a.costPerBaseUnit;
      }
      return 0;
    });

    return result;
  }, [items, searchQuery, typeFilter, categoryFilter, stockStatusFilter, sortBy, sortOrder]);

  if (isLoading) {
    return <LoadingState message="جاري استرجاع أصناف المخزون والأرصدة الدفترية..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadItems} />;
  }

  return (
    <div className="space-y-6">
      <InventoryNav />

      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-stone-900 font-cairo">
              دليل أصناف المخزون (Inventory Catalog)
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-forest-50 text-forest-800 font-bold border border-forest-200">
              {filteredItems.length} صنف معروض
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            إدارة تعريف المواد الخام والمنتجات المباعة، وحدات التخزين، ومعاملات التحويل
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/inventory/items/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-forest-900 hover:bg-forest-800 rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 text-gold-400" />
            <span>إضافة صنف جديد</span>
          </Link>
          <button
            onClick={loadItems}
            type="button"
            className="p-2 text-stone-500 hover:text-stone-900 hover:bg-cream-100 rounded-xl border border-stone-200 transition-colors"
            title="تحديث البيانات"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم العربي، الإنجليزي، أو كود SKU..."
              className="w-full pr-10 pl-3 py-2 text-xs bg-cream-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-700 text-stone-900"
            />
          </div>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-cream-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-700 text-stone-800"
          >
            <option value="all">كل الأنواع</option>
            <option value="RAW_INGREDIENT">مادة خام فقط (RAW)</option>
            <option value="FINISHED_GOOD">منتج نهائي مباع (FINISHED)</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-cream-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-700 text-stone-800"
          >
            <option value="all">كل التصنيفات</option>
            <option value="MEAT">لحوم ومصنعاتها</option>
            <option value="POULTRY">دواجن وطيور</option>
            <option value="VEGETABLES">خضروات وفواكه</option>
            <option value="DAIRY">ألبان وأجبان</option>
            <option value="DRY_GOODS">حبوب وبقوليات</option>
            <option value="BEVERAGES">مشروبات ومعلبات</option>
            <option value="SPICES">توابل وبهارات</option>
          </select>

          {/* Stock Status Filter */}
          <select
            value={stockStatusFilter}
            onChange={(e) => setStockStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-cream-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-700 text-stone-800"
          >
            <option value="all">كل حالات الرصيد</option>
            <option value="available">متوفر وآمن</option>
            <option value="low">مخزون منخفض (تحت الحد)</option>
            <option value="out">منفد بالكامل (0 أو سالب)</option>
          </select>
        </div>
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center">
            <Boxes className="w-12 h-12 text-stone-300 mx-auto mb-3" />
            <h3 className="text-stone-800 font-bold font-cairo text-base">لا توجد أصناف مطابقة</h3>
            <p className="text-stone-500 text-xs mt-1">جرب تغيير معايير البحث أو إضافة صنف جديد</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-cream-50/80 border-b border-stone-200 text-stone-600 font-bold">
                <tr>
                  <th className="py-3.5 pr-4">كود الصنف (SKU)</th>
                  <th className="py-3.5">اسم الصنف</th>
                  <th className="py-3.5">النوع والتصنيف</th>
                  <th className="py-3.5">وحدة الصرف</th>
                  <th className="py-3.5">الرصيد الفعلي الحالي</th>
                  <th className="py-3.5">حد الأمان الأدنى</th>
                  <th className="py-3.5">تكلفة الوحدة</th>
                  <th className="py-3.5 pl-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredItems.map((item) => {
                  const typeConfig = getItemTypeConfig(item.type);
                  const isLow = item.currentStock > 0 && item.currentStock <= item.minStockThreshold;
                  const isOut = item.currentStock <= 0;

                  return (
                    <tr key={item.id} className="hover:bg-cream-50/50 transition-colors">
                      <td className="py-3.5 pr-4 font-mono font-bold text-stone-700" dir="ltr">
                        {item.sku}
                      </td>
                      <td className="py-3.5">
                        <div className="font-bold text-stone-900 font-cairo text-sm leading-tight">
                          {item.nameAr}
                        </div>
                        {item.nameEn && (
                          <div className="text-[11px] text-stone-400 font-mono mt-0.5" dir="ltr">
                            {item.nameEn}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5">
                        <div className="space-y-1">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${typeConfig.bgClass} ${typeConfig.textClass} ${typeConfig.borderClass}`}
                          >
                            {typeConfig.label}
                          </span>
                          <div className="text-[11px] text-stone-500 font-tajawal">
                            {getItemCategoryLabel(item.category)}
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 font-bold text-stone-700">
                        {formatUnit(item.baseUnit)}
                        {item.purchaseUnit && item.purchaseUnit !== item.baseUnit && (
                          <div className="text-[10px] text-stone-400 font-normal">
                            يُشترى بـ: {formatUnit(item.purchaseUnit)} ({item.conversionFactor})
                          </div>
                        )}
                      </td>
                      <td className="py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-black font-mono text-sm ${
                              isOut ? "text-red-600" : isLow ? "text-amber-600" : "text-emerald-700"
                            }`}
                            dir="ltr"
                          >
                            {item.currentStock} {formatUnit(item.baseUnit)}
                          </span>
                          {isOut ? (
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" title="نفد بالكامل" />
                          ) : isLow ? (
                            <span className="w-2 h-2 rounded-full bg-amber-500" title="منخفض" />
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3.5 font-mono text-stone-500" dir="ltr">
                        {item.minStockThreshold} {formatUnit(item.baseUnit)}
                      </td>
                      <td className="py-3.5 font-bold text-stone-800">
                        {formatCurrency(item.costPerBaseUnit)}
                        <span className="text-[10px] text-stone-400 block font-normal">لكل {formatUnit(item.baseUnit)}</span>
                      </td>
                      <td className="py-3.5 pl-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link
                            href={`/inventory/items/${item.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-forest-800 bg-forest-50 hover:bg-forest-100 border border-forest-200 transition"
                            title="عرض تفاصيل الصنف وحركاته"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>عرض</span>
                          </Link>
                          <Link
                            href={`/inventory/items/${item.id}?edit=true`}
                            className="p-1.5 text-stone-500 hover:text-stone-900 rounded-lg border border-stone-200 hover:bg-cream-100 transition"
                            title="تعديل المواصفات"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Link>
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
    </div>
  );
}
