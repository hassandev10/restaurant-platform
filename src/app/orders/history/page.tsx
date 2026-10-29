"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Order } from "@/types/order";
import { orderRepository } from "@/repositories/order-repository";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { OrderCard } from "@/components/dashboard/order-card";
import { OrderDetailsDrawer } from "@/components/dashboard/order-details-drawer";
import { OrderReceiptModal } from "@/components/dashboard/order-receipt-modal";
import { formatCurrency } from "@/lib/formatters";
import {
  History,
  Search,
  CheckCircle2,
  XCircle,
  Banknote,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { AuthGuard } from "@/components/dashboard/auth-guard";
import { toast } from "sonner";

export default function OrderHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "SERVED" | "CANCELLED">("ALL");

  // Selection & modals
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);
  const [orderToPrint, setOrderToPrint] = useState<Order | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);

  const loadHistory = async () => {
    try {
      setIsLoading(true);
      const list = await orderRepository.getHistoricalOrders();
      setOrders(list);
    } catch {
      toast.error("تعذر تحميل سجل الطلبات");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  // Filtered list
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter !== "ALL" && order.status !== statusFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesNum = order.orderNumber.toLowerCase().includes(q);
        const matchesTbl = (order.tableName || order.tableNameSnapshot || "")
          .toLowerCase()
          .includes(q);
        const matchesItem = order.items.some((it) =>
          it.productNameSnapshot.toLowerCase().includes(q)
        );
        if (!matchesNum && !matchesTbl && !matchesItem) return false;
      }

      return true;
    });
  }, [orders, statusFilter, searchQuery]);

  // Aggregate statistics
  const stats = useMemo(() => {
    let servedCount = 0;
    let cancelledCount = 0;
    let totalRevenue = 0;

    orders.forEach((o) => {
      if (o.status === "SERVED") {
        servedCount += 1;
        totalRevenue += o.total;
      } else if (o.status === "CANCELLED") {
        cancelledCount += 1;
      }
    });

    return { servedCount, cancelledCount, totalRevenue };
  }, [orders]);

  return (
    <AuthGuard>
      <div className="min-h-screen bg-stone-100/70 text-stone-900 flex flex-col font-cairo" dir="rtl">
      <DashboardHeader
        restaurantName="مطعم الزيتونة"
        branchName="فرع المعادي - القاهرة"
        staffName="الكابتن أحمد (مشرف الصالة)"
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Breadcrumb & Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/orders"
              className="p-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 transition-colors"
              title="العودة لشاشة الطلبات الواردة"
            >
              <ArrowRight className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-stone-900 flex items-center gap-2">
                <History className="w-5 h-5 text-forest-800" />
                <span>سجل الطلبات السابقة</span>
              </h1>
              <p className="text-xs text-stone-500">
                أرشيف الطلبات المكتملة والملغاة خلال نوبة العمل الحالية
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadHistory}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-bold inline-flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-stone-500" />
            <span className="hidden sm:inline">تحديث السجل</span>
          </button>
        </div>

        {/* Operational Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-stone-500 font-bold">طلبات تم تقديمها</div>
              <div className="text-xl font-extrabold text-stone-900 font-cairo">
                {stats.servedCount} طلب
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-forest-100 text-forest-800 flex items-center justify-center flex-shrink-0">
              <Banknote className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-stone-500 font-bold">إجمالي المبيعات المحصلة</div>
              <div className="text-xl font-extrabold text-forest-900 font-cairo">
                {formatCurrency(stats.totalRevenue)}
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center flex-shrink-0">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-stone-500 font-bold">طلبات ملغاة</div>
              <div className="text-xl font-extrabold text-stone-900 font-cairo">
                {stats.cancelledCount} طلب
              </div>
            </div>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-stone-200 shadow-sm">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث في السجل برقم الطلب أو الطاولة..."
              className="w-full pr-10 pl-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-forest-700/20 focus:border-forest-700"
            />
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-stone-100 rounded-xl border border-stone-200 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                statusFilter === "ALL"
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              الكل ({orders.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("SERVED")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                statusFilter === "SERVED"
                  ? "bg-white text-emerald-800 shadow-sm"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              المقدمة ({stats.servedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("CANCELLED")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                statusFilter === "CANCELLED"
                  ? "bg-white text-rose-800 shadow-sm"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              الملغاة ({stats.cancelledCount})
            </button>
          </div>
        </div>

        {/* History List */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-stone-400 space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin text-forest-700" />
            <p className="text-xs font-bold text-stone-600">جاري تحميل سجل الطلبات...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center max-w-md mx-auto space-y-3 border border-stone-200">
            <History className="w-10 h-10 text-stone-300 mx-auto" />
            <h3 className="text-sm font-bold text-stone-900">لا توجد طلبات في السجل تطابق البحث</h3>
            <p className="text-xs text-stone-500">
              يمكنك مسح البحث أو تغيير فلتر الحالة.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                isSelected={selectedOrder?.id === order.id}
                onSelect={(ord) => {
                  setSelectedOrder(ord);
                  setIsDetailsOpen(true);
                }}
                onUpdateStatus={async () => {}}
                onRequestCancel={() => {}}
              />
            ))}
          </div>
        )}
      </main>

      {/* Drawer */}
      <OrderDetailsDrawer
        order={selectedOrder}
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        onUpdateStatus={async () => {}}
        onRequestCancel={() => {}}
        onPrintReceipt={(ord) => {
          setOrderToPrint(ord);
          setIsReceiptModalOpen(true);
        }}
      />

      {/* Printable Receipt */}
      <OrderReceiptModal
        order={orderToPrint}
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
      />
    </div>
    </AuthGuard>
  );
}
