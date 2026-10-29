import { apiClient } from "@/lib/api-client";
import { Order } from "@/types/order";
import { RestaurantTable } from "@/types/table";
import {
  AnalyticsOverviewMetrics,
  CategorySalesBreakdown,
  IAnalyticsService,
  RevenueSeriesPoint,
} from "@/types/contracts";

export interface BackendEndpointStatus {
  isAvailable: boolean;
  endpoint: string;
  method: string;
  descriptionAr: string;
}

export class AnalyticsService implements IAnalyticsService {
  /**
   * Status of the planned backend endpoints
   */
  getPlannedContracts(): BackendEndpointStatus[] {
    return [
      {
        isAvailable: false,
        endpoint: "/api/v1/admin/analytics/overview",
        method: "GET",
        descriptionAr: "إحصائيات المبيعات، متوسط الفاتورة، ومعدل الإلغاء الشامل من قاعدة البيانات",
      },
      {
        isAvailable: false,
        endpoint: "/api/v1/admin/analytics/revenue-series",
        method: "GET",
        descriptionAr: "المتسلسلة الزمنية للإيرادات اليومية والشهرية لحساب الرسوم البيانية",
      },
      {
        isAvailable: false,
        endpoint: "/api/v1/admin/analytics/categories",
        method: "GET",
        descriptionAr: "تحليل نسبة مساهمة تصنيفات الطعام الأكثر ربحية",
      },
    ];
  }

  async getOverviewMetrics(period?: "today" | "week" | "month"): Promise<AnalyticsOverviewMetrics> {
    try {
      const [analytics, dashStats] = await Promise.all([
        apiClient.get<any>("/api/v1/admin/analytics"),
        apiClient.get<any>("/api/v1/admin/dashboard/stats").catch(() => ({})),
      ]);

      const totalRevenue = analytics.totalRevenue || 0;
      const ordersCount = analytics.totalOrders || 0;
      const averageOrderValue = analytics.averageOrderValue || 0;
      const cancelledOrders = analytics.cancelledOrders || 0;
      const cancellationRate = ordersCount > 0 ? (cancelledOrders / ordersCount) * 100 : 0;
      const occupiedTablesCount = dashStats.tableOccupancy?.occupiedTables || 0;
      const totalTablesCount = dashStats.tableOccupancy?.totalTables || 0;

      return {
        totalRevenue,
        ordersCount,
        averageOrderValue,
        occupiedTablesCount,
        totalTablesCount,
        cancellationRate,
        periodStart: analytics.from || new Date().toISOString(),
        periodEnd: analytics.to || new Date().toISOString(),
      };
    } catch {
      throw new Error("فشل استرجاع المؤشرات التحليلية من خادم Go Backend.");
    }
  }

  async getRevenueSeries(from?: string, to?: string): Promise<RevenueSeriesPoint[]> {
    try {
      const params: Record<string, string> = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const analytics = await apiClient.get<any>("/api/v1/admin/analytics", params);
      const trend = analytics.salesTrend || [];
      return trend.map((t: any) => ({
        date: t.date,
        revenue: t.revenue,
        ordersCount: t.orders,
      }));
    } catch {
      throw new Error("فشل استرجاع متسلسلة الإيرادات من خادم Go Backend.");
    }
  }

  async getCategoryBreakdown(): Promise<CategorySalesBreakdown[]> {
    try {
      const analytics = await apiClient.get<any>("/api/v1/admin/analytics");
      const topCategories = analytics.topCategories || [];
      const totalRev = analytics.totalRevenue || 1;
      return topCategories.map((c: any) => ({
        categoryId: c.categoryId,
        categoryNameAr: c.categoryName,
        totalSales: c.revenue,
        quantitySold: c.itemsSold,
        percentage: Number(((c.revenue / totalRev) * 100).toFixed(1)),
      }));
    } catch {
      throw new Error("فشل استرجاع توزيع مبيعات الأقسام من خادم Go Backend.");
    }
  }

  /**
   * Real live metrics calculation derived strictly from actual live orders and tables!
   * No fake production data: strictly reflects the genuine state of orders and tables.
   */
  deriveLiveMetrics(orders: Order[], tables: RestaurantTable[]): {
    totalSales: number;
    completedOrdersCount: number;
    activeOrdersCount: number;
    cancelledOrdersCount: number;
    averageOrderValue: number;
    tableOccupancyRate: number;
    occupiedTables: number;
    totalTables: number;
    topSellingItems: Array<{ name: string; quantity: number; revenue: number }>;
  } {
    const servedOrders = orders.filter((o) => o.status === "SERVED");
    const activeOrders = orders.filter((o) => ["NEW", "CONFIRMED", "PREPARING", "READY"].includes(o.status));
    const cancelledOrders = orders.filter((o) => o.status === "CANCELLED");

    const totalSales = servedOrders.reduce((sum, o) => sum + (o.total || 0), 0);
    const completedOrdersCount = servedOrders.length;
    const activeOrdersCount = activeOrders.length;
    const cancelledOrdersCount = cancelledOrders.length;
    const averageOrderValue = completedOrdersCount > 0 ? totalSales / completedOrdersCount : 0;

    const totalTables = tables.length;
    const occupiedTables = tables.filter((t) => t.status === "OCCUPIED").length;
    const tableOccupancyRate = totalTables > 0 ? (occupiedTables / totalTables) * 100 : 0;

    // Calculate top selling items from order line items
    const itemMap = new Map<string, { name: string; quantity: number; revenue: number }>();
    for (const order of orders) {
      if (order.status === "CANCELLED") continue;
      for (const item of order.items || []) {
        const name = item.productNameSnapshot || "صنف";
        const existing = itemMap.get(name) || { name, quantity: 0, revenue: 0 };
        existing.quantity += item.quantity || 1;
        existing.revenue += item.lineTotal || 0;
        itemMap.set(name, existing);
      }
    }

    const topSellingItems = Array.from(itemMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    return {
      totalSales,
      completedOrdersCount,
      activeOrdersCount,
      cancelledOrdersCount,
      averageOrderValue,
      tableOccupancyRate,
      occupiedTables,
      totalTables,
      topSellingItems,
    };
  }
}

export const analyticsService = new AnalyticsService();
