"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatArabicDateTime, formatUnit, getMovementTypeConfig } from "@/lib/formatters";
import { inventoryService } from "@/services/inventory-service";
import { InventoryItem, InventoryMovement, MovementType } from "@/types/inventory";
import { InventoryNav } from "@/components/inventory/inventory-nav";
import { ContractUnavailableBanner } from "@/components/shared/contract-unavailable-banner";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  Calendar,
  Filter,
  History,
  Package,
  RefreshCw,
  Search,
  User,
} from "lucide-react";

export function MovementsLedger() {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isContractLive, setIsContractLive] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState("all");
  const [selectedType, setSelectedType] = useState("all");

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [allMovements, allItems] = await Promise.all([
        inventoryService.getMovements(),
        inventoryService.getItems(),
      ]);

      const liveCheck = await inventoryService.checkContractStatus("/api/v1/admin/inventory/movements");
      setIsContractLive(liveCheck);

      setMovements(allMovements);
      setItems(allItems);
    } catch (err: any) {
      console.error("Failed to load movements:", err);
      setError(err?.message || "حدث خطأ أثناء تحميل سجل الحركات المخزنية");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered list
  const filteredMovements = movements.filter((mov) => {
    if (selectedItem !== "all" && mov.itemId !== selectedItem) return false;
    if (selectedType !== "all" && mov.movementType !== selectedType) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchName = mov.itemNameAr.toLowerCase().includes(q);
      const matchSku = mov.itemSku?.toLowerCase().includes(q) || false;
      const matchRef = mov.referenceId?.toLowerCase().includes(q) || false;
      const matchReason = mov.reason.toLowerCase().includes(q);
      const matchActor = mov.actor?.toLowerCase().includes(q) || false;
      return matchName || matchSku || matchRef || matchReason || matchActor;
    }
    return true;
  });

  // Aggregates
  const totalIn = movements.filter((m) => m.quantity > 0).reduce((sum, m) => sum + m.quantity, 0);
  const totalOut = movements.filter((m) => m.quantity < 0).reduce((sum, m) => sum + Math.abs(m.quantity), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">سجل حركات المخزون (Ledger)</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
              {filteredMovements.length} حركة مسجلة
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            سجل تدقيق كامل وغير قابل للتعديل لجميع عمليات التوريد، الصرف، الهدر، والتسويات
          </p>
        </div>

        <button
          onClick={loadData}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          تحديث السجل
        </button>
      </div>

      {/* Contract Banner */}
      {!isContractLive && (
        <ContractUnavailableBanner
          title="عقود ومواصفات سجل حركات المخزون والتدقيق (Ledger)"
          moduleNameAr="سجل تدقيق حركة المخزون"
          contracts={[
            {
              method: "GET",
              endpoint: "/api/v1/admin/inventory/movements",
              descriptionAr: "استرجاع السجل التاريخي لحركات المخزون مع التصفية بالصنف ونوع الحركة",
              status: "PENDING_BACKEND",
            },
          ]}
          alternativeActionDescription="يتم قيد وتتبع كافة الحركات محلياً في سجل التدقيق وفق مواصفات العقد البرمجي بانتظار تفعيلها في Go Backend."
        />
      )}

      {/* Sub Navigation */}
      <InventoryNav />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <History className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">إجمالي القيود بالسجل</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{movements.length} قيد</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">حركات الإضافة والتوريد (+)</p>
            <p className="text-xl font-bold text-emerald-700 mt-0.5">
              {movements.filter((m) => m.quantity > 0).length} حركة
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-100 text-red-800 flex items-center justify-center shrink-0">
            <ArrowUpRight className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">حركات الصرف والهدر (-)</p>
            <p className="text-xl font-bold text-red-700 mt-0.5">
              {movements.filter((m) => m.quantity < 0).length} حركة
            </p>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ابحث برقم المرجع، اسم الصنف، السبب، أو القائم بالحركة..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-9 pl-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Item Filter */}
          <div className="w-full md:w-60">
            <select
              value={selectedItem}
              onChange={(e) => setSelectedItem(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              <option value="all">جميع الأصناف ({items.length})</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.nameAr} ({it.sku})
                </option>
              ))}
            </select>
          </div>

          {/* Movement Type Filter */}
          <div className="w-full md:w-56">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              <option value="all">كل أنواع الحركات</option>
              <option value="PURCHASE_RECEIPT">توريد مشتريات</option>
              <option value="ORDER_CONSUMPTION">صرف طلبات المطبخ</option>
              <option value="MANUAL_CONSUMPTION">استهلاك يدوي</option>
              <option value="WASTE">تسجيل هدر وتالف</option>
              <option value="ADJUSTMENT">تسوية مخزنية</option>
              <option value="COUNT_RECONCILIATION">مطابقة جرد فعلي</option>
            </select>
          </div>
        </div>
      </div>

      {/* Movements Table */}
      {isLoading ? (
        <LoadingState message="جاري تحميل سجل الحركات المخزنية..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : filteredMovements.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <History className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-900">لا توجد حركات مخزنية مطابقة</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
            لم يتم العثور على أي قيود تطابق الفلاتر المحددة، جرّب إعادة ضبط خيارات البحث
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-gray-50/75 border-b border-gray-200 text-xs font-semibold text-gray-500">
                  <th className="py-3 px-4">تاريخ ووقت الحركة</th>
                  <th className="py-3 px-4">الصنف</th>
                  <th className="py-3 px-4">نوع الحركة</th>
                  <th className="py-3 px-4">الكمية المسجلة</th>
                  <th className="py-3 px-4">الرصيد قبل / بعد</th>
                  <th className="py-3 px-4">المرجع والسبب الإيضاحي</th>
                  <th className="py-3 px-4">القائم بالحركة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredMovements.map((mov) => {
                  const typeConfig = getMovementTypeConfig(mov.movementType);
                  const isPositive = mov.quantity > 0;

                  return (
                    <tr key={mov.id} className="hover:bg-gray-50/50 transition-colors">
                      {/* Date */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="text-xs font-semibold text-gray-900">
                          {formatArabicDateTime(mov.timestamp)}
                        </div>
                      </td>

                      {/* Item */}
                      <td className="py-3 px-4">
                        <Link
                          href={`/inventory/items/${mov.itemId}`}
                          className="font-bold text-gray-900 hover:text-primary transition-colors hover:underline block"
                        >
                          {mov.itemNameAr}
                        </Link>
                        {mov.itemSku && (
                          <span className="text-xs font-mono text-gray-500">{mov.itemSku}</span>
                        )}
                      </td>

                      {/* Type */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${typeConfig.bgClass} ${typeConfig.textClass} border ${typeConfig.borderClass}`}
                        >
                          {typeConfig.label}
                        </span>
                      </td>

                      {/* Quantity */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-xs font-bold font-mono ${
                            isPositive ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                          }`}
                        >
                          {isPositive ? `+${mov.quantity}` : mov.quantity} {formatUnit(mov.unit)}
                        </span>
                      </td>

                      {/* Balances */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="text-xs font-mono text-gray-700">
                          <span className="text-gray-400">من: </span>
                          <span>{mov.balanceBefore !== undefined ? mov.balanceBefore : "—"}</span>
                          <span className="mx-1 text-gray-400">←</span>
                          <span className="text-gray-400">إلى: </span>
                          <span className="font-bold text-gray-900">{mov.balanceAfter}</span>
                        </div>
                      </td>

                      {/* Reference & Reason */}
                      <td className="py-3 px-4 max-w-xs">
                        {mov.referenceId && (
                          <div className="text-xs font-semibold text-gray-800 flex items-center gap-1 mb-0.5">
                            <span className="font-mono bg-gray-100 px-1 rounded">{mov.referenceId}</span>
                          </div>
                        )}
                        <p className="text-xs text-gray-600 line-clamp-2" title={mov.reason}>
                          {mov.reason}
                        </p>
                      </td>

                      {/* Actor */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-gray-600">
                          <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span>{mov.actor || "النظام"}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
