"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { formatCurrency, formatArabicDateTime, getOrderStatusConfig } from "@/lib/formatters";
import { CONFIG } from "@/lib/config";
import { ordersService } from "@/services/orders-service";
import { tablesService } from "@/services/tables-service";
import { Order } from "@/types/order";
import { RestaurantTable } from "@/types/table";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import {
  ArrowUpRight,
  Armchair,
  CheckCircle2,
  Clock,
  DollarSign,
  ExternalLink,
  Flame,
  PlusCircle,
  RefreshCw,
  ShoppingBag,
  TableProperties,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";

export function DashboardOverview() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<"today" | "yesterday" | "week" | "all">("all");

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [allOrders, tablesResp] = await Promise.all([
        ordersService.getAllOrders(),
        tablesService.listTables({ pageSize: 100 }),
      ]);
      setOrders(allOrders);
      setTables(tablesResp.tables || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل تحميل بيانات لوحة التحكم";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter orders by selected date filter
  const filteredOrders = useMemo(() => {
    if (dateFilter === "all") return orders;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 86400000;
    const weekStart = todayStart - 7 * 86400000;

    return orders.filter((order) => {
      const orderTime = new Date(order.createdAt).getTime();
      if (dateFilter === "today") return orderTime >= todayStart;
      if (dateFilter === "yesterday") return orderTime >= yesterdayStart && orderTime < todayStart;
      if (dateFilter === "week") return orderTime >= weekStart;
      return true;
    });
  }, [orders, dateFilter]);

  // Derived metrics from real API data
  const metrics = useMemo(() => {
    const servedOrders = filteredOrders.filter((o) => o.status === "SERVED");
    const activeOrders = filteredOrders.filter((o) =>
      ["NEW", "CONFIRMED", "PREPARING", "READY"].includes(o.status)
    );
    const cancelledOrders = filteredOrders.filter((o) => o.status === "CANCELLED");

    const totalSales = servedOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const averageOrderValue = servedOrders.length > 0 ? totalSales / servedOrders.length : 0;

    // Table occupancy from real tables API
    const totalTables = tables.length;
    const occupiedTables = tables.filter((t) => t.status === "OCCUPIED").length;
    const availableTables = tables.filter((t) => t.status === "AVAILABLE").length;
    const cleaningTables = tables.filter((t) => t.status === "CLEANING").length;
    const occupancyRate = totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : 0;

    // Best-selling menu items aggregated from real order line items
    const itemMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    for (const order of filteredOrders) {
      if (order.status === "CANCELLED") continue;
      for (const item of order.items || []) {
        const name = item.productNameSnapshot || "صنف";
        const current = itemMap.get(name) || { name, quantity: 0, revenue: 0 };
        current.quantity += item.quantity || 1;
        current.revenue += item.lineTotal || 0;
        itemMap.set(name, current);
      }
    }

    const topSellingItems = Array.from(itemMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    return {
      totalSales,
      ordersCount: filteredOrders.length,
      servedCount: servedOrders.length,
      activeCount: activeOrders.length,
      cancelledCount: cancelledOrders.length,
      averageOrderValue,
      totalTables,
      occupiedTables,
      availableTables,
      cleaningTables,
      occupancyRate,
      topSellingItems,
    };
  }, [filteredOrders, tables]);

  if (isLoading) {
    return <LoadingState message="جاري استرجاع بيانات اللوحة القيادية..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadData} />;
  }

  return (
    <div className="space-y-8">
      {/* Top Controls: Refresh & Date Range Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-stone-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-stone-900 font-cairo">
            ملخص الأداء والعمليات اليومية
          </h2>
          <p className="text-xs text-stone-500">
            البيانات مسترجعة مباشرة من خادم Go Backend وقاعدة البيانات الحقيقية
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          {/* Date Filter Pills */}
          <div className="inline-flex rounded-xl bg-cream-100 p-1 border border-stone-200 text-xs font-semibold">
            <button
              onClick={() => setDateFilter("today")}
              type="button"
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                dateFilter === "today"
                  ? "bg-white text-forest-900 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              اليوم
            </button>
            <button
              onClick={() => setDateFilter("yesterday")}
              type="button"
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                dateFilter === "yesterday"
                  ? "bg-white text-forest-900 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              أمس
            </button>
            <button
              onClick={() => setDateFilter("week")}
              type="button"
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                dateFilter === "week"
                  ? "bg-white text-forest-900 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              آخر 7 أيام
            </button>
            <button
              onClick={() => setDateFilter("all")}
              type="button"
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                dateFilter === "all"
                  ? "bg-white text-forest-900 shadow-xs"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              الكل
            </button>
          </div>

          <button
            onClick={loadData}
            type="button"
            className="p-2 text-stone-600 hover:text-stone-900 hover:bg-cream-200 rounded-xl transition-colors border border-stone-200"
            title="تحديث البيانات"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Primary KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Sales */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              إجمالي المبيعات المحققة
            </span>
            <div className="w-10 h-10 rounded-xl bg-forest-50 text-forest-700 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black font-cairo text-stone-900">
            {formatCurrency(metrics.totalSales)}
          </div>
          <div className="mt-2 text-xs text-stone-500 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>محسوبة من {metrics.servedCount} طلب تم تقديمه</span>
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              عدد الطلبات الكلي
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black font-cairo text-stone-900">
            {metrics.ordersCount} <span className="text-sm font-normal text-stone-500">طلب</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-amber-700 font-semibold bg-amber-50 px-2 py-0.5 rounded-md">
              {metrics.activeCount} نشط
            </span>
            <span className="text-red-700 font-semibold bg-red-50 px-2 py-0.5 rounded-md">
              {metrics.cancelledCount} ملغي
            </span>
          </div>
        </div>

        {/* Table Occupancy */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              نسبة إشغال الصالة
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Armchair className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black font-cairo text-stone-900">
            {metrics.occupancyRate}%
          </div>
          <div className="mt-2 text-xs text-stone-500 flex items-center justify-between">
            <span>{metrics.occupiedTables} من {metrics.totalTables} طاولة مشغولة</span>
            <span className="text-emerald-700 font-bold">{metrics.availableTables} شاغرة</span>
          </div>
        </div>

        {/* Average Order Value */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              متوسط قيمة الفاتورة
            </span>
            <div className="w-10 h-10 rounded-xl bg-gold-50 text-gold-700 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black font-cairo text-stone-900">
            {formatCurrency(metrics.averageOrderValue)}
          </div>
          <div className="mt-2 text-xs text-stone-500">
            لكل طلب تم إغلاقه ومحاسبته
          </div>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="bg-gradient-to-r from-forest-900 via-forest-950 to-forest-900 rounded-2xl p-6 text-white shadow-soft">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold font-cairo text-gold-300">
              إجراءات سريعة لإدارة المطعم
            </h3>
            <p className="text-xs text-cream-200/80 mt-1">
              تنقل مباشر إلى الوحدات التشغيلية الحية
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href="/tables"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm border border-white/20 transition-colors"
            >
              <TableProperties className="w-4 h-4 text-gold-400" />
              <span>إدارة الطاولات ({metrics.totalTables})</span>
            </Link>

            <Link
              href="/menu"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm border border-white/20 transition-colors"
            >
              <UtensilsCrossed className="w-4 h-4 text-gold-400" />
              <span>إدارة المنيو</span>
            </Link>

            <Link
              href="/orders"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-gold-500 hover:bg-gold-400 text-forest-950 transition-colors shadow-xs"
            >
              <span>سجل الطلبات الشامل</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>

            <a
              href={CONFIG.ordersDashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-forest-800 hover:bg-forest-700 text-white border border-forest-600 transition-colors"
            >
              <span>شاشة المطبخ والكاشير</span>
              <ExternalLink className="w-3.5 h-3.5 text-gold-400" />
            </a>
          </div>
        </div>
      </div>

      {/* Grid: Best-selling items + Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Best-selling Items */}
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                <Flame className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-stone-900 font-cairo text-base">
                الأصناف الأكثر طلباً
              </h3>
            </div>
            <span className="text-xs text-stone-400">حسب الكمية المباعة</span>
          </div>

          <div className="flex-1 space-y-3">
            {metrics.topSellingItems.length === 0 ? (
              <div className="text-center py-8 text-stone-400 text-xs">
                لا توجد طلبات كافية لحساب الأصناف الأكثر مبيعاً
              </div>
            ) : (
              metrics.topSellingItems.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-cream-50/70 border border-cream-200"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-forest-100 text-forest-800 font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-stone-800 font-cairo">
                        {item.name}
                      </p>
                      <p className="text-[11px] text-stone-500">
                        {item.quantity} طلبات تم بيعها
                      </p>
                    </div>
                  </div>
                  <div className="text-left font-bold text-xs text-forest-800">
                    {formatCurrency(item.revenue)}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-stone-100">
            <Link
              href="/menu"
              className="text-xs font-bold text-forest-700 hover:text-forest-900 flex items-center justify-center gap-1 transition-colors"
            >
              <span>تعديل قائمة الطعام والأصناف</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Recent Orders Overview */}
        <div className="lg:col-span-2 bg-white border border-stone-200 rounded-2xl p-6 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-stone-100">
            <div>
              <h3 className="font-bold text-stone-900 font-cairo text-base">
                أحدث الطلبات الواردة
              </h3>
              <p className="text-xs text-stone-500">
                آخر العمليات المسجلة في النظام
              </p>
            </div>
            <Link
              href="/orders"
              className="text-xs font-bold text-forest-700 hover:text-forest-900 flex items-center gap-1 transition-colors"
            >
              <span>عرض كل الطلبات ({orders.length})</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="flex-1 overflow-x-auto">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12 text-stone-400 text-sm">
                لا توجد طلبات مسجلة ضمن الفترة المختارة
              </div>
            ) : (
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-stone-100 text-stone-500 font-semibold">
                    <th className="pb-3 pr-2">رقم الطلب</th>
                    <th className="pb-3">الطاولة</th>
                    <th className="pb-3">الأصناف</th>
                    <th className="pb-3">الحالة</th>
                    <th className="pb-3">الوقت</th>
                    <th className="pb-3 text-left pl-2">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredOrders.slice(0, 6).map((order) => {
                    const statusConfig = getOrderStatusConfig(order.status);
                    const itemsSummary = (order.items || [])
                      .map((i) => `${i.productNameSnapshot} (×${i.quantity})`)
                      .join("، ");

                    return (
                      <tr key={order.id} className="hover:bg-cream-50/60 transition-colors">
                        <td className="py-3 pr-2 font-mono font-bold text-stone-900" dir="ltr">
                          #{order.orderNumber}
                        </td>
                        <td className="py-3 font-semibold text-stone-800">
                          {order.tableName || order.tableNameSnapshot || "صالة"}
                        </td>
                        <td className="py-3 text-stone-600 max-w-[180px] truncate" title={itemsSummary}>
                          {itemsSummary || "—"}
                        </td>
                        <td className="py-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md font-semibold text-[11px] border ${statusConfig.bgClass} ${statusConfig.textClass} ${statusConfig.borderClass}`}
                          >
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="py-3 text-stone-500">
                          {formatArabicDateTime(order.createdAt)}
                        </td>
                        <td className="py-3 text-left pl-2 font-bold text-stone-900">
                          {formatCurrency(order.total)}
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
