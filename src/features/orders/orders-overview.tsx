"use client";

import React, { useEffect, useState, useMemo } from "react";
import { formatArabicDateTime, formatCurrency, getOrderStatusConfig, getPaymentStatusConfig } from "@/lib/formatters";
import { CONFIG } from "@/lib/config";
import { ordersService } from "@/services/orders-service";
import { Order, OrderEvent, OrderStatus } from "@/types/order";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  Filter,
  History,
  Receipt,
  RefreshCw,
  Search,
  Sparkles,
  Utensils,
  X,
  XCircle,
} from "lucide-react";

export function OrdersOverview() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "yesterday" | "week">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Order Details Modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderEvents, setOrderEvents] = useState<OrderEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(false);

  const [isSimulating, setIsSimulating] = useState(false);

  const loadOrders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await ordersService.getAllOrders();
      setOrders(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشل تحميل سجل الطلبات";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const openOrderDetails = async (order: Order) => {
    setSelectedOrder(order);
    setIsLoadingEvents(true);
    try {
      const events = await ordersService.getOrderEvents(order.id);
      setOrderEvents(events);
    } catch {
      setOrderEvents(order.events || []);
    } finally {
      setIsLoadingEvents(false);
    }
  };

  const handleSimulateOrder = async () => {
    setIsSimulating(true);
    try {
      const simulated = await ordersService.simulateOrder();
      setOrders((prev) => [simulated, ...prev]);
      toast.success(`تمت محاكاة طلب مصري جديد برقم #${simulated.orderNumber}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "فشلت عملية المحاكاة";
      toast.error(msg);
    } finally {
      setIsSimulating(false);
    }
  };

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;

      // Date filtering
      let matchesDate = true;
      if (dateFilter !== "all") {
        const orderTime = new Date(order.createdAt).getTime();
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        if (dateFilter === "today") {
          matchesDate = orderTime >= todayStart;
        } else if (dateFilter === "yesterday") {
          matchesDate = orderTime >= todayStart - 86400000 && orderTime < todayStart;
        } else if (dateFilter === "week") {
          matchesDate = orderTime >= todayStart - 7 * 86400000;
        }
      }

      // Search query
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        order.orderNumber.toLowerCase().includes(q) ||
        (order.tableName && order.tableName.toLowerCase().includes(q)) ||
        (order.tableNameSnapshot && order.tableNameSnapshot.toLowerCase().includes(q)) ||
        (order.items || []).some((item) =>
          item.productNameSnapshot.toLowerCase().includes(q)
        );

      return matchesStatus && matchesDate && matchesSearch;
    });
  }, [orders, statusFilter, dateFilter, searchQuery]);

  if (isLoading) {
    return <LoadingState message="جاري استرجاع سجل الطلبات الشامل..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadOrders} />;
  }

  return (
    <div className="space-y-6">
      {/* Top Banner and Summary */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-stone-900 font-cairo">
              نظرة عامة وسجل الطلبات
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-forest-50 text-forest-800 font-bold border border-forest-200">
              {orders.length} طلب إجمالي
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-1">
            استعراض سجل الطلبات والبحث وتتبع التدقيق المالي ومطابقة الفواتير
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Link to Orders Dashboard */}
          <a
            href={CONFIG.ordersDashboardUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-forest-900 bg-forest-50 hover:bg-forest-100 border border-forest-200 rounded-xl transition"
          >
            <Utensils className="w-4 h-4 text-forest-700" />
            <span>شاشة تحضير الطلبات الحية (Dashboard)</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          {/* Simulate Order */}
          <button
            onClick={handleSimulateOrder}
            disabled={isSimulating}
            type="button"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-stone-700 bg-cream-50 hover:bg-cream-100 border border-stone-200 rounded-xl transition"
            title="توليد طلب تجريبي مصري عبر السيرفر"
          >
            <Sparkles className="w-4 h-4 text-gold-500" />
            <span>{isSimulating ? "جاري المحاكاة..." : "محاكاة طلب فوري"}</span>
          </button>

          <button
            onClick={loadOrders}
            type="button"
            className="p-2 text-stone-500 hover:text-stone-900 hover:bg-cream-100 rounded-xl border border-stone-200 transition-colors"
            title="تحديث البيانات"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم الطلب، الطاولة، أو الصنف..."
              className="w-full pr-10 pl-3 py-2 text-xs bg-cream-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-700 text-stone-900"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-cream-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-700 text-stone-800"
          >
            <option value="all">كل الحالات ({orders.length})</option>
            <option value="NEW">جديد (NEW)</option>
            <option value="CONFIRMED">مؤكد (CONFIRMED)</option>
            <option value="PREPARING">قيد التجهيز (PREPARING)</option>
            <option value="READY">جاهز للتقديم (READY)</option>
            <option value="SERVED">تم التقديم (SERVED)</option>
            <option value="CANCELLED">ملغي (CANCELLED)</option>
          </select>

          {/* Date Range Filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="px-3 py-2 text-xs bg-cream-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-700 text-stone-800"
          >
            <option value="all">كل الفترات الزمنية</option>
            <option value="today">طلبات اليوم</option>
            <option value="yesterday">طلبات أمس</option>
            <option value="week">آخر 7 أيام</option>
          </select>
        </div>

        <span className="text-xs text-stone-500 font-semibold">
          عرض {filteredOrders.length} من أصل {orders.length} طلب
        </span>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="p-12 text-center">
            <Receipt className="w-12 h-12 text-stone-300 mx-auto mb-3" />
            <h3 className="text-stone-800 font-bold font-cairo text-base">لا توجد طلبات مطابقة</h3>
            <p className="text-stone-500 text-xs mt-1">جرب تغيير معايير التصفية أو البحث برقم آخر</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-cream-50/80 border-b border-stone-200 text-stone-600 font-bold">
                <tr>
                  <th className="py-3.5 pr-4">رقم الطلب</th>
                  <th className="py-3.5">الطاولة</th>
                  <th className="py-3.5">الأصناف المطلوبة</th>
                  <th className="py-3.5">حالة الطلب</th>
                  <th className="py-3.5">حالة الدفع</th>
                  <th className="py-3.5">تاريخ ووقت الإنشاء</th>
                  <th className="py-3.5">الإجمالي</th>
                  <th className="py-3.5 pl-4 text-center">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredOrders.map((order) => {
                  const statusConfig = getOrderStatusConfig(order.status);
                  const paymentConfig = getPaymentStatusConfig(order.paymentStatus);
                  const itemsCount = (order.items || []).reduce((acc, i) => acc + (i.quantity || 1), 0);
                  const itemsSummary = (order.items || [])
                    .map((i) => `${i.productNameSnapshot} (×${i.quantity})`)
                    .join("، ");

                  return (
                    <tr key={order.id} className="hover:bg-cream-50/50 transition-colors">
                      <td className="py-3.5 pr-4 font-mono font-bold text-stone-900" dir="ltr">
                        #{order.orderNumber}
                      </td>
                      <td className="py-3.5 font-bold text-stone-800">
                        {order.tableName || order.tableNameSnapshot || "صالة"}
                      </td>
                      <td className="py-3.5 text-stone-600 max-w-xs truncate" title={itemsSummary}>
                        <span className="font-semibold text-stone-800">{itemsCount} أصناف: </span>
                        <span>{itemsSummary}</span>
                      </td>
                      <td className="py-3.5">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-md font-semibold text-[11px] border ${statusConfig.bgClass} ${statusConfig.textClass} ${statusConfig.borderClass}`}
                        >
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="py-3.5">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold border ${paymentConfig.bgClass} ${paymentConfig.textClass} ${paymentConfig.borderClass}`}
                        >
                          {paymentConfig.label}
                        </span>
                      </td>
                      <td className="py-3.5 text-stone-500">
                        {formatArabicDateTime(order.createdAt)}
                      </td>
                      <td className="py-3.5 font-black text-stone-900 font-cairo">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="py-3.5 pl-4 text-center">
                        <button
                          onClick={() => openOrderDetails(order)}
                          type="button"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-forest-800 bg-forest-50 hover:bg-forest-100 border border-forest-200 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>عرض</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Details Drawer / Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <div className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-stone-200 p-6 md:p-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-stone-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-forest-900 text-gold-400 font-mono font-bold flex items-center justify-center">
                  #{selectedOrder.orderNumber}
                </div>
                <div>
                  <h3 className="text-lg font-bold font-cairo text-stone-900">
                    تفاصيل الفاتورة #{selectedOrder.orderNumber}
                  </h3>
                  <p className="text-xs text-stone-500">
                    {formatArabicDateTime(selectedOrder.createdAt)} • {selectedOrder.tableName || "صالة"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                type="button"
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-xl hover:bg-cream-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Badges Bar */}
            <div className="flex items-center gap-3 mb-6 p-3 bg-cream-50 rounded-2xl border border-cream-200">
              <div className="flex-1">
                <span className="text-[10px] text-stone-500 font-semibold block mb-0.5">حالة دورة الطلب</span>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-md font-bold text-xs border ${
                    getOrderStatusConfig(selectedOrder.status).bgClass
                  } ${getOrderStatusConfig(selectedOrder.status).textClass} ${
                    getOrderStatusConfig(selectedOrder.status).borderClass
                  }`}
                >
                  {getOrderStatusConfig(selectedOrder.status).label}
                </span>
              </div>

              <div className="flex-1">
                <span className="text-[10px] text-stone-500 font-semibold block mb-0.5">حالة الدفع والحساب</span>
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-md font-bold text-xs border ${
                    getPaymentStatusConfig(selectedOrder.paymentStatus).bgClass
                  } ${getPaymentStatusConfig(selectedOrder.paymentStatus).textClass} ${
                    getPaymentStatusConfig(selectedOrder.paymentStatus).borderClass
                  }`}
                >
                  {getPaymentStatusConfig(selectedOrder.paymentStatus).label}
                </span>
              </div>
            </div>

            {/* Items Receipt Table */}
            <div className="mb-6">
              <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-3">
                الأصناف وقائمة الطلب
              </h4>

              <div className="space-y-2 border border-stone-200 rounded-2xl p-4 bg-white shadow-2xs">
                {(selectedOrder.items || []).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between py-2 border-b border-stone-100 last:border-0 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-forest-900 bg-forest-100 px-1.5 py-0.2 rounded font-mono">
                          ×{item.quantity}
                        </span>
                        <span className="font-bold text-stone-900">{item.productNameSnapshot}</span>
                      </div>

                      {item.selectedOptions && item.selectedOptions.length > 0 && (
                        <div className="text-[11px] text-stone-500 mt-1 pr-6 space-y-0.5">
                          {item.selectedOptions.map((opt, i) => (
                            <div key={i} className="flex items-center gap-1">
                              <span>• {opt.groupNameAr}: {opt.optionNameAr}</span>
                              {opt.priceDelta > 0 && (
                                <span className="text-stone-400 font-mono">(+{opt.priceDelta} ج.م)</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {item.notes && (
                        <div className="text-[11px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded mt-1 pr-6">
                          ملاحظة: {item.notes}
                        </div>
                      )}
                    </div>

                    <div className="font-bold text-stone-900 font-cairo text-sm">
                      {formatCurrency(item.lineTotal)}
                    </div>
                  </div>
                ))}

                <div className="pt-3 border-t border-stone-200 space-y-1 text-xs">
                  <div className="flex justify-between text-stone-500">
                    <span>المجموع الفرعي (Subtotal):</span>
                    <span>{formatCurrency(selectedOrder.subtotal || selectedOrder.total)}</span>
                  </div>
                  <div className="flex justify-between font-black text-sm text-stone-900 pt-1 border-t border-stone-100">
                    <span>الإجمالي النهائي (Total):</span>
                    <span className="text-forest-800">{formatCurrency(selectedOrder.total)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Audit Trail Timeline */}
            <div>
              <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <History className="w-4 h-4 text-forest-700" />
                <span>سجل التغييرات ومراحل الطلب (Audit Trail)</span>
              </h4>

              {isLoadingEvents ? (
                <div className="text-center py-4 text-xs text-stone-400">جاري استرجاع سجل الأحداث...</div>
              ) : orderEvents.length === 0 ? (
                <div className="text-center py-4 text-xs text-stone-400">لا توجد أحداث مسجلة لهذا الطلب</div>
              ) : (
                <div className="space-y-2 border-r-2 border-forest-800 pr-3 mr-1 text-xs">
                  {orderEvents.map((event, idx) => (
                    <div key={idx} className="relative pb-2">
                      <div className="font-bold text-stone-800">
                        {getOrderStatusConfig(event.status).label}
                        <span className="text-stone-400 font-normal mr-2">بواسطة: {event.actor || "النظام"}</span>
                      </div>
                      <div className="text-[10px] text-stone-500 mt-0.5">
                        {formatArabicDateTime(event.timestamp)}
                      </div>
                      {event.note && (
                        <div className="text-[11px] text-stone-600 bg-cream-50 p-1.5 rounded mt-1">
                          {event.note}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-stone-100 flex items-center justify-between">
              <a
                href={CONFIG.ordersDashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-forest-800 hover:text-forest-950 font-bold inline-flex items-center gap-1"
              >
                <span>الانتقال لشاشة التشغيل المباشرة</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 text-xs font-bold text-stone-700 bg-cream-100 hover:bg-cream-200 rounded-xl"
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
