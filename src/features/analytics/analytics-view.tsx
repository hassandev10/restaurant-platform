"use client";

import React, { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/formatters";
import { ordersService } from "@/services/orders-service";
import { tablesService } from "@/services/tables-service";
import { analyticsService } from "@/services/analytics-service";
import { ContractUnavailableBanner, EndpointContractItem } from "@/components/shared/contract-unavailable-banner";
import { BarChart3, Database, Info, TrendingUp, Users, DollarSign } from "lucide-react";

export function AnalyticsView() {
  const [liveStats, setLiveStats] = useState<{
    totalSales: number;
    completedOrdersCount: number;
    activeOrdersCount: number;
    cancelledOrdersCount: number;
    averageOrderValue: number;
    tableOccupancyRate: number;
    occupiedTables: number;
    totalTables: number;
    topSellingItems: Array<{ name: string; quantity: number; revenue: number }>;
  } | null>(null);

  useEffect(() => {
    Promise.all([
      ordersService.getAllOrders().catch(() => []),
      tablesService.listTables({ pageSize: 100 }).catch(() => ({ tables: [] })),
    ]).then(([orders, tablesResp]) => {
      const derived = analyticsService.deriveLiveMetrics(orders, tablesResp.tables || []);
      setLiveStats(derived);
    });
  }, []);

  const contracts: EndpointContractItem[] = [
    {
      method: "GET",
      endpoint: "/api/v1/admin/analytics/overview?period=today|week|month",
      descriptionAr: "حساب إجمالي المبيعات، ومعدل دوران الطاولات، ومتوسط قيمة الفاتورة عبر استعلامات تجميع SQL سريعة من الخادم مباشرة",
      status: "PENDING_BACKEND",
      sampleResponse: JSON.stringify(
        {
          totalRevenue: 28450.5,
          ordersCount: 142,
          averageOrderValue: 200.35,
          occupiedTablesCount: 8,
          totalTablesCount: 18,
          cancellationRate: 2.1,
          periodStart: "2026-10-27T00:00:00Z",
          periodEnd: "2026-10-27T23:59:59Z",
        },
        null,
        2
      ),
    },
    {
      method: "GET",
      endpoint: "/api/v1/admin/analytics/revenue-series?from=YYYY-MM-DD&to=YYYY-MM-DD",
      descriptionAr: "المتسلسلة الزمنية اليومية والشهرية لرسم منحنيات الإيرادات ومقارنة أداء الفترات السابقة",
      status: "PENDING_BACKEND",
      sampleResponse: JSON.stringify(
        [
          { date: "2026-10-25", revenue: 14200.0, ordersCount: 71 },
          { date: "2026-10-26", revenue: 16800.0, ordersCount: 84 },
          { date: "2026-10-27", revenue: 18950.0, ordersCount: 95 },
        ],
        null,
        2
      ),
    },
    {
      method: "GET",
      endpoint: "/api/v1/admin/analytics/categories",
      descriptionAr: "توزيع المبيعات بحسب أقسام الطعام (مشويات، مقبلات، مشروبات، حلويات) لحساب الأكثر مساهمة في الأرباح",
      status: "PENDING_BACKEND",
      sampleResponse: JSON.stringify(
        [
          { categoryId: "cat-01", categoryNameAr: "المشويات واللحوم", totalSales: 15400.0, quantitySold: 88, percentage: 54.1 },
          { categoryId: "cat-02", categoryNameAr: "المقبلات والشوربات", totalSales: 4500.0, quantitySold: 92, percentage: 15.8 },
          { categoryId: "cat-03", categoryNameAr: "المشروبات والعصائر", totalSales: 3800.0, quantitySold: 110, percentage: 13.3 },
        ],
        null,
        2
      ),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Missing Backend Contract Official Unavailable Banner */}
      <ContractUnavailableBanner
        title="شاشة التحليلات المتقدمة والتقارير المالية"
        moduleNameAr="وحدة التحليلات (Analytics Engine)"
        contracts={contracts}
        alternativeActionDescription="تم حساب المؤشرات الحالية أدناه بشكل مشتق لحظياً من الطلبات الحقيقية المسجلة في السيرفر، بينما تتطلب الرسوم البيانية التاريخية تفعيل نقاط النهاية أعلاه في Go Backend."
      />

      {/* Derived Real-time Analytics from Existing Endpoints */}
      {liveStats && (
        <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-forest-50 text-forest-700 flex items-center justify-center">
                <BarChart3 className="w-4 h-4" />
              </div>
              <h3 className="font-bold font-cairo text-base text-stone-900">
                المؤشرات المشتقة من الطلبات الحالية (Client-Derived Metrics)
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              بيانات حقيقية من الخادم
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-cream-50 border border-stone-200">
              <span className="text-xs text-stone-500 font-bold block mb-1">إجمالي المبيعات المؤكدة</span>
              <div className="text-xl font-black text-forest-900 font-cairo">
                {formatCurrency(liveStats.totalSales)}
              </div>
              <span className="text-[10px] text-stone-400 mt-1 block">
                من {liveStats.completedOrdersCount} طلب تم تسليمه
              </span>
            </div>

            <div className="p-4 rounded-xl bg-cream-50 border border-stone-200">
              <span className="text-xs text-stone-500 font-bold block mb-1">متوسط قيمة الفاتورة</span>
              <div className="text-xl font-black text-stone-900 font-cairo">
                {formatCurrency(liveStats.averageOrderValue)}
              </div>
              <span className="text-[10px] text-stone-400 mt-1 block">لكل زبون تمت خدمته</span>
            </div>

            <div className="p-4 rounded-xl bg-cream-50 border border-stone-200">
              <span className="text-xs text-stone-500 font-bold block mb-1">نسبة إشغال الصالة</span>
              <div className="text-xl font-black text-amber-700 font-cairo">
                {Math.round(liveStats.tableOccupancyRate)}%
              </div>
              <span className="text-[10px] text-stone-400 mt-1 block">
                {liveStats.occupiedTables} من {liveStats.totalTables} طاولة مشغولة
              </span>
            </div>

            <div className="p-4 rounded-xl bg-cream-50 border border-stone-200">
              <span className="text-xs text-stone-500 font-bold block mb-1">معدل الطلبات الملغاة</span>
              <div className="text-xl font-black text-stone-900 font-cairo">
                {liveStats.cancelledOrdersCount} <span className="text-xs text-stone-500 font-normal">طلبات</span>
              </div>
              <span className="text-[10px] text-red-500 mt-1 block">ملغاة مع توثيق السبب</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
