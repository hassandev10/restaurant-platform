"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { formatArabicDateTime, formatUnit, getInventoryAlertConfig } from "@/lib/formatters";
import { inventoryService } from "@/services/inventory-service";
import { InventoryAlert, InventoryAlertType, InventoryAlertStatus } from "@/types/inventory";
import { InventoryNav } from "@/components/inventory/inventory-nav";
import { ContractUnavailableBanner } from "@/components/shared/contract-unavailable-banner";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  DollarSign,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShoppingCart,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

export function AlertsView() {
  const [alerts, setAlerts] = useState<InventoryAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isContractLive, setIsContractLive] = useState(false);

  // Filters
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("ACTIVE");
  const [search, setSearch] = useState("");

  // Override Modal state
  const [selectedAlertForOverride, setSelectedAlertForOverride] = useState<InventoryAlert | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [isOverriding, setIsOverriding] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await inventoryService.getAlerts({
        alertType: selectedType !== "all" ? selectedType : undefined,
        status: selectedStatus !== "all" ? selectedStatus : undefined,
      });

      const liveCheck = await inventoryService.checkContractStatus("/api/v1/admin/inventory/alerts");
      setIsContractLive(liveCheck);

      setAlerts(data);
    } catch (err: any) {
      console.error("Failed to load alerts:", err);
      setError(err?.message || "حدث خطأ أثناء تحميل تنبيهات المخزون");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedType, selectedStatus]);

  const handleResolve = async (alertId: string) => {
    try {
      await inventoryService.resolveAlert(alertId);
      toast.success("تم تحديث حالة التنبيه إلى معالج بنجاح");
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "فشل معالجة التنبيه");
    }
  };

  const handleConfirmOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlertForOverride) return;

    if (!overrideReason.trim()) {
      toast.error("يرجى كتابة سبب التجاوز الإداري للاعتماد");
      return;
    }

    setIsOverriding(true);
    try {
      const shortage = Math.max(0, -selectedAlertForOverride.currentBalance);
      await inventoryService.requestStockOverride({
        itemId: selectedAlertForOverride.itemId,
        shortageQuantity: shortage,
        reason: overrideReason.trim(),
      });

      toast.success("تم تسجيل التجاوز الإداري بنجاح في سجل الرقابة");
      setSelectedAlertForOverride(null);
      setOverrideReason("");
      loadData();
    } catch (err: any) {
      toast.error(err?.message || "فشل تسجيل التجاوز");
    } finally {
      setIsOverriding(false);
    }
  };

  const filteredAlerts = alerts.filter((alert) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      alert.itemNameAr.toLowerCase().includes(q) ||
      (alert.itemSku && alert.itemSku.toLowerCase().includes(q))
    );
  });

  const lowCount = alerts.filter((a) => a.alertType === "LOW_STOCK" && a.status === "ACTIVE").length;
  const outCount = alerts.filter((a) => a.alertType === "OUT_OF_STOCK" && a.status === "ACTIVE").length;
  const negCount = alerts.filter((a) => a.alertType === "NEGATIVE_STOCK" && a.status === "ACTIVE").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">تنبيهات المخزون والأرصدة الحرجة</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
              {filteredAlerts.length} تنبيه
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            مراقبة الأصناف التي اقتربت من النفاد أو نفدت بالكامل أو تجاوزت للرصيد السالب
          </p>
        </div>

        <button
          onClick={loadData}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className="w-4 h-4" />
          تحديث التنبيهات
        </button>
      </div>

      {/* Contract Banner */}
      {!isContractLive && (
        <ContractUnavailableBanner
          title="عقود ومواصفات واجهات تنبيهات المخزون والأرصدة الحرجة"
          moduleNameAr="نظام مراقبة تنبيهات المخزون"
          contracts={[
            {
              method: "GET",
              endpoint: "/api/v1/admin/inventory/alerts",
              descriptionAr: "استرجاع قائمة تنبيهات المخزون النشطة",
              status: "PENDING_BACKEND",
            },
            {
              method: "POST",
              endpoint: "/api/v1/admin/inventory/alerts/:id/resolve",
              descriptionAr: "إغلاق التنبيه أو تعليمه كمعالج",
              status: "PENDING_BACKEND",
            },
            {
              method: "POST",
              endpoint: "/api/v1/admin/inventory/overrides",
              descriptionAr: "تسجيل تجاوز استثنائي للرصيد السالب بموافقة المشرف",
              status: "PENDING_BACKEND",
            },
          ]}
          alternativeActionDescription="تظهر التنبيهات وتجاوزات الأرصدة السالبة محلياً وفق مواصفات العقد البرمجي بانتظار تفعيلها في Go Backend."
        />
      )}

      {/* Sub Navigation */}
      <InventoryNav />

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-amber-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">أصناف قاربت على النفاد (Low Stock)</p>
            <p className="text-xl font-bold text-amber-700 mt-0.5">{lowCount} صنف</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-red-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-red-100 text-red-700 flex items-center justify-center shrink-0">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">أصناف نافدة تماماً (Out of Stock)</p>
            <p className="text-xl font-bold text-red-700 mt-0.5">{outCount} صنف</p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-purple-200 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-500 font-medium">أرصدة سالبة تحتاج تدقيقاً (Negative)</p>
            <p className="text-xl font-bold text-purple-700 mt-0.5">{negCount} صنف</p>
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
              placeholder="ابحث باسم الصنف أو كود SKU..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-9 pl-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Type Filter */}
          <div className="w-full md:w-56">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              <option value="all">كل أنواع التنبيهات</option>
              <option value="LOW_STOCK">منخفض (Low Stock)</option>
              <option value="OUT_OF_STOCK">نافد تماماً (Out of Stock)</option>
              <option value="NEGATIVE_STOCK">رصيد سالب (Negative Stock)</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-gray-200">
            <button
              onClick={() => setSelectedStatus("ACTIVE")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                selectedStatus === "ACTIVE" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              التنبيهات النشطة
            </button>
            <button
              onClick={() => setSelectedStatus("RESOLVED")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                selectedStatus === "RESOLVED" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              تمت معالجتها
            </button>
            <button
              onClick={() => setSelectedStatus("all")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                selectedStatus === "all" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              الكل
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingState message="جاري استرجاع تنبيهات المخزون..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : filteredAlerts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-900">المخزون في حالة ممتازة!</h3>
          <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
            لا توجد تنبيهات نشطة حالياً. جميع الأصناف متوفرة بأرصدة تتجاوز حدود الأمان المحددة
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => {
            const config = getInventoryAlertConfig(alert.alertType);
            const isNegative = alert.alertType === "NEGATIVE_STOCK";

            return (
              <div
                key={alert.id}
                className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:border-gray-300 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl shrink-0 ${config.bgClass} ${config.textClass}`}>
                    <AlertTriangle className="w-5 h-5" />
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/inventory/items/${alert.itemId}`}
                        className="font-bold text-gray-900 hover:text-primary transition-colors hover:underline"
                      >
                        {alert.itemNameAr}
                      </Link>
                      {alert.itemSku && (
                        <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                          {alert.itemSku}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${config.bgClass} ${config.textClass} border ${config.borderClass}`}>
                        {config.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mt-1.5">
                      <span>
                        الرصيد الفعلي الحالي:{" "}
                        <strong className={alert.currentBalance <= 0 ? "text-red-700 font-mono" : "text-gray-900 font-mono"}>
                          {alert.currentBalance} {formatUnit(alert.unit)}
                        </strong>
                      </span>
                      <span>
                        حد الأمان الأدنى:{" "}
                        <strong className="text-gray-900 font-mono">
                          {alert.minThreshold} {formatUnit(alert.unit)}
                        </strong>
                      </span>
                      <span>تاريخ الرصد: {formatArabicDateTime(alert.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                  {/* Shortcut to purchase */}
                  <Link
                    href={`/inventory/purchases/new?itemId=${alert.itemId}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    طلب توريد
                  </Link>

                  {/* Negative stock override */}
                  {isNegative && alert.status === "ACTIVE" && (
                    <button
                      onClick={() => setSelectedAlertForOverride(alert)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-100 hover:bg-purple-200 rounded-lg transition-colors"
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      تسجيل تجاوز
                    </button>
                  )}

                  {/* Resolve */}
                  {alert.status === "ACTIVE" ? (
                    <button
                      onClick={() => handleResolve(alert.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-gray-500" />
                      إغلاق التنبيه
                    </button>
                  ) : (
                    <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      تمت المعالجة
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Override Modal */}
      {selectedAlertForOverride && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 text-right space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-purple-700" />
                تجاوز إداري للرصيد السالب
              </h3>
              <button
                onClick={() => setSelectedAlertForOverride(null)}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                &times;
              </button>
            </div>

            <div className="space-y-2 text-xs text-gray-600 bg-purple-50/60 p-3 rounded-lg border border-purple-200/60">
              <p>
                <strong>الصنف:</strong> {selectedAlertForOverride.itemNameAr} ({selectedAlertForOverride.itemSku})
              </p>
              <p>
                <strong>الرصيد الحالي:</strong>{" "}
                <span className="text-red-700 font-bold font-mono">
                  {selectedAlertForOverride.currentBalance} {formatUnit(selectedAlertForOverride.unit)}
                </span>
              </p>
              <p className="text-purple-800">
                تسجيل التجاوز يسمح باستمرار قبول طلبات المطبخ مؤقتاً لحين استلام فاتورة التوريد وتسجيلها بالنظام.
              </p>
            </div>

            <form onSubmit={handleConfirmOverride} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  سبب التجاوز والاعتماد الإداري <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="مثال: تم استلام بضاعة طازجة من المورد بالمطبخ قبل تسجيل الفاتورة الدفترية..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedAlertForOverride(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isOverriding || !overrideReason.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 disabled:opacity-50 rounded-lg shadow-sm transition-colors"
                >
                  {isOverriding ? "جاري الاعتماد..." : "تأكيد التجاوز الإداري"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
