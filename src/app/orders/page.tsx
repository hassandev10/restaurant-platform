"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Order, OrderStatus } from "@/types/order";
import { orderRepository, OrderSubscriptionEvent } from "@/repositories/order-repository";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { OrderStatusTabs, FilterTabKey } from "@/components/dashboard/order-status-tabs";
import {
  OrderSearchAndSort,
  OrderSortOption,
} from "@/components/dashboard/order-search-and-sort";
import { OrderCard } from "@/components/dashboard/order-card";
import { OrdersPagination } from "@/components/dashboard/orders-pagination";
import { OrderDetailsDrawer } from "@/components/dashboard/order-details-drawer";
import { OrderCancelModal } from "@/components/dashboard/order-cancel-modal";
import { OrderReceiptModal } from "@/components/dashboard/order-receipt-modal";
import { TableSessionDrawer } from "@/components/dashboard/table-session-drawer";
import {
  isOrderDelayed,
  canTransitionStatus,
} from "@/lib/order-workflow";
import { playNewOrderChime, playActionSuccessPing } from "@/lib/sound";
import {
  Inbox,
  AlertCircle,
  RefreshCw,
  PlusCircle,
  Loader2,
} from "lucide-react";
import { AuthGuard } from "@/components/dashboard/auth-guard";
import { toast } from "sonner";

export default function IncomingOrdersPage() {
  // Pool of orders used for accurate real-time badge counts and instant updates
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  // Currently displayed paginated slice from server
  const [pagedOrders, setPagedOrders] = useState<Order[]>([]);
  const [totalOrders, setTotalOrders] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(12);
  const [isPageLoading, setIsPageLoading] = useState<boolean>(false);
  const [isInitialLoading, setIsInitialLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Active filters and sort state
  const [activeTab, setActiveTab] = useState<FilterTabKey>("ALL_ACTIVE");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortOption, setSortOption] = useState<OrderSortOption>("OLDEST_FIRST");
  const [onlyDelayed, setOnlyDelayed] = useState<boolean>(false);

  // Interactive Modals and Selection state
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);
  const [orderToCancel, setOrderToCancel] = useState<Order | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [orderToPrint, setOrderToPrint] = useState<Order | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);
  const [orderForSession, setOrderForSession] = useState<Order | null>(null);
  const [isSessionDrawerOpen, setIsSessionDrawerOpen] = useState<boolean>(false);

  // Loading indicator states for action protection
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Track sounded order IDs to avoid duplicate chimes
  const soundedOrderIds = useRef<Set<string>>(new Set());
  const isFetchingRef = useRef<boolean>(false);

  // Initialize filters from URL on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlTab = urlParams.get("tab") as FilterTabKey | null;
      const urlPage = parseInt(urlParams.get("page") || "1", 10);
      const urlPageSize = parseInt(urlParams.get("pageSize") || "12", 10);
      const urlSearch = urlParams.get("search") || "";
      const urlDelayed = urlParams.get("delayed") === "true";

      const validTabs: FilterTabKey[] = [
        "ALL_ACTIVE",
        "NEW",
        "CONFIRMED",
        "PREPARING",
        "READY",
        "SERVED",
        "CANCELLED",
      ];

      if (urlTab && validTabs.includes(urlTab)) {
        setActiveTab(urlTab);
      }
      if (!isNaN(urlPage) && urlPage >= 1) {
        setCurrentPage(urlPage);
      }
      if ([12, 24, 48].includes(urlPageSize)) {
        setPageSize(urlPageSize);
      }
      if (urlSearch) {
        setSearchQuery(urlSearch);
      }
      if (urlDelayed) {
        setOnlyDelayed(true);
      }
    } catch {
      // Ignore URL parse error
    }
  }, []);

  // Sync state to URL query parameters
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const url = new URL(window.location.href);
      if (activeTab !== "ALL_ACTIVE") {
        url.searchParams.set("tab", activeTab);
      } else {
        url.searchParams.delete("tab");
      }

      if (currentPage > 1) {
        url.searchParams.set("page", String(currentPage));
      } else {
        url.searchParams.delete("page");
      }

      if (pageSize !== 12) {
        url.searchParams.set("pageSize", String(pageSize));
      } else {
        url.searchParams.delete("pageSize");
      }

      if (searchQuery.trim()) {
        url.searchParams.set("search", searchQuery.trim());
      } else {
        url.searchParams.delete("search");
      }

      if (onlyDelayed) {
        url.searchParams.set("delayed", "true");
      } else {
        url.searchParams.delete("delayed");
      }

      window.history.replaceState({}, "", url.toString());
    } catch {
      // Ignore history state error
    }
  }, [activeTab, currentPage, pageSize, searchQuery, onlyDelayed]);

  // Load overall counts pool
  const loadOrderCounts = useCallback(async () => {
    try {
      const [activeList, historyList] = await Promise.all([
        orderRepository.getActiveOrders(),
        orderRepository.getHistoricalOrders(),
      ]);

      const map = new Map<string, Order>();
      activeList.forEach((o) => map.set(o.id, o));
      historyList.forEach((o) => map.set(o.id, o));
      const combined = Array.from(map.values());
      setAllOrders(combined);

      // Pre-seed known order IDs so they don't ring on page boot
      combined.forEach((o) => soundedOrderIds.current.add(o.id));
    } catch (err) {
      console.error("Failed to load order counts:", err);
    }
  }, []);

  // Fetch paginated slice from server
  const fetchPaginatedSlice = useCallback(
    async (
      targetPage: number,
      targetPageSize: number,
      targetTab: FilterTabKey,
      targetSearch: string,
      targetDelayed: boolean,
      targetSort: OrderSortOption
    ) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      setIsPageLoading(true);
      setLoadError(null);

      try {
        // Query backend server-side pagination
        const response = await orderRepository.getPaginatedOrders({
          page: targetPage,
          pageSize: targetPageSize,
          status: targetTab,
          search: targetSearch,
        });

        let results = [...response.orders];

        // Apply client-side delayed filter if toggled
        if (targetDelayed) {
          results = results.filter((o) => isOrderDelayed(o.createdAt, o.status));
        }

        // Apply sort option
        results.sort((a, b) => {
          switch (targetSort) {
            case "OLDEST_FIRST":
              return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            case "NEWEST_FIRST":
              return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            case "TABLE_NUMBER":
              return (a.tableName || "").localeCompare(b.tableName || "", "ar");
            case "TOTAL_DESC":
              return b.total - a.total;
            default:
              return 0;
          }
        });

        setPagedOrders(results);
        setTotalOrders(response.total);
        setTotalPages(response.totalPages);

        // Clamp page if out of bounds and we have pages
        if (targetPage > response.totalPages && response.totalPages > 0) {
          setCurrentPage(response.totalPages);
        }
      } catch (err) {
        console.error("Failed to fetch paginated orders:", err);
        setLoadError("تعذر تحميل الطلبات الواردة. يرجى التحقق من الاتصال والمحاولة مرة أخرى.");
      } finally {
        setIsPageLoading(false);
        setIsInitialLoading(false);
        isFetchingRef.current = false;
      }
    },
    []
  );

  // Trigger paginated slice fetch whenever dependencies change
  useEffect(() => {
    fetchPaginatedSlice(
      currentPage,
      pageSize,
      activeTab,
      searchQuery,
      onlyDelayed,
      sortOption
    );
  }, [
    currentPage,
    pageSize,
    activeTab,
    searchQuery,
    onlyDelayed,
    sortOption,
    fetchPaginatedSlice,
  ]);

  // Initial boot: load counts pool
  useEffect(() => {
    loadOrderCounts();
  }, [loadOrderCounts]);

  // Real-time WebSocket listener
  useEffect(() => {
    const unsubscribe = orderRepository.subscribeToOrders((event: OrderSubscriptionEvent) => {
      const incoming = event.order;

      // Update pool for tab counts
      setAllOrders((prev) => {
        const existingIndex = prev.findIndex((o) => o.id === incoming.id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = incoming;
          return updated;
        } else {
          return [incoming, ...prev];
        }
      });

      // Update in current paged view if present
      setPagedOrders((prev) => {
        const idx = prev.findIndex((o) => o.id === incoming.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = incoming;
          return copy;
        }
        // If brand new order and we are on page 1 of active/new tab, prepend it
        if (
          event.type === "CREATED" &&
          currentPage === 1 &&
          (activeTab === "ALL_ACTIVE" || activeTab === "NEW")
        ) {
          return [incoming, ...prev.slice(0, pageSize - 1)];
        }
        return prev;
      });

      // Update details drawer if open with the same order
      setSelectedOrder((current) => (current && current.id === incoming.id ? incoming : current));

      // Notification and sound for brand new orders
      if (event.type === "CREATED" && !soundedOrderIds.current.has(incoming.id)) {
        soundedOrderIds.current.add(incoming.id);
        playNewOrderChime();
        toast.info(`طلب جديد وارد! ${incoming.tableName || incoming.tableNameSnapshot}`, {
          description: `رقم الطلب #${incoming.orderNumber} • ${incoming.items.length} أصناف بقيمة ${incoming.total} ج.م`,
          duration: 6000,
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentPage, activeTab, pageSize]);

  // Periodic interval to keep elapsed time badges updating
  useEffect(() => {
    const timer = setInterval(() => {
      setPagedOrders((current) => [...current]);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // Background silent sync (every 5 seconds) to ensure real-time counts and order state
  useEffect(() => {
    const syncTimer = setInterval(async () => {
      try {
        const [activeList, historyList] = await Promise.all([
          orderRepository.getActiveOrders(),
          orderRepository.getHistoricalOrders(),
        ]);

        const map = new Map<string, Order>();
        activeList.forEach((o) => map.set(o.id, o));
        historyList.forEach((o) => map.set(o.id, o));
        const combined = Array.from(map.values());

        setAllOrders(combined);

        // Sound chime for brand-new order detected during poll
        combined.forEach((o) => {
          if (o.status === "NEW" && !soundedOrderIds.current.has(o.id)) {
            soundedOrderIds.current.add(o.id);
            playNewOrderChime();
            toast.info(`طلب جديد وارد! ${o.tableName || o.tableNameSnapshot}`, {
              description: `رقم الطلب #${o.orderNumber} • ${o.items.length} أصناف بقيمة ${o.total} ج.م`,
              duration: 6000,
            });
          }
        });
      } catch {
        // Silently ignore background polling errors
      }
    }, 5000);

    return () => clearInterval(syncTimer);
  }, []);

  // Compute status counts for tabs
  const counts = useMemo(() => {
    const res = {
      ALL_ACTIVE: 0,
      NEW: 0,
      CONFIRMED: 0,
      PREPARING: 0,
      READY: 0,
      SERVED: 0,
      CANCELLED: 0,
    };

    allOrders.forEach((o) => {
      if (o.status !== "SERVED" && o.status !== "CANCELLED") {
        res.ALL_ACTIVE += 1;
      }
      if (o.status in res) {
        res[o.status as keyof typeof res] += 1;
      }
    });

    return res;
  }, [allOrders]);

  // Delayed orders count for filter toggle
  const delayedOrdersCount = useMemo(() => {
    return allOrders.filter(
      (o) => o.status !== "SERVED" && o.status !== "CANCELLED" && isOrderDelayed(o.createdAt, o.status)
    ).length;
  }, [allOrders]);

  // Reset to page 1 on filter changes
  const handleTabChange = (newTab: FilterTabKey) => {
    setActiveTab(newTab);
    setCurrentPage(1);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleDelayedToggle = (delayed: boolean) => {
    setOnlyDelayed(delayed);
    setCurrentPage(1);
  };

  const handleSortChange = (sort: OrderSortOption) => {
    setSortOption(sort);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage !== currentPage && !isPageLoading) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePageSizeChange = (newSize: number) => {
    if (newSize !== pageSize && !isPageLoading) {
      setPageSize(newSize);
      setCurrentPage(1);
    }
  };

  // Status transitions
  const handleUpdateStatus = async (orderId: string, nextStatus: OrderStatus) => {
    const targetOrder = pagedOrders.find((o) => o.id === orderId) || allOrders.find((o) => o.id === orderId);
    if (!targetOrder) return;

    if (!canTransitionStatus(targetOrder.status, nextStatus)) {
      toast.error("انتقال غير مسموح به في دورة حياة الطلب");
      return;
    }

    try {
      setUpdatingOrderId(orderId);
      const updated = await orderRepository.updateOrderStatus(
        orderId,
        nextStatus,
        "الكابتن أحمد (مشرف الصالة)"
      );

      if (updated) {
        playActionSuccessPing();
        // Update both local views immediately
        setPagedOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
        setAllOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));

        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(updated);
        }

        const successMessage =
          nextStatus === "CONFIRMED"
            ? `تم تأكيد الطلب #${updated.orderNumber} بنجاح ✓`
            : nextStatus === "PREPARING"
            ? `تم إرسال الطلب #${updated.orderNumber} إلى المطبخ للتحضير 👨‍🍳`
            : nextStatus === "READY"
            ? `أصبح الطلب #${updated.orderNumber} جاهزاً للتقديم 🛎️`
            : nextStatus === "SERVED"
            ? `تم تقديم الطلب #${updated.orderNumber} للعميل وسداد الحساب 🍽️`
            : `تم تحديث حالة الطلب #${updated.orderNumber}`;

        toast.success(successMessage);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "حدث خطأ أثناء تحديث حالة الطلب";
      toast.error(msg);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Handle cancel confirmation
  const handleConfirmCancel = async (orderId: string, reason: string) => {
    try {
      setUpdatingOrderId(orderId);
      const updated = await orderRepository.cancelOrder(
        orderId,
        reason,
        "الكابتن أحمد (مشرف الصالة)"
      );

      if (updated) {
        setPagedOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
        setAllOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));

        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder(updated);
        }
        toast.error(`تم إلغاء الطلب #${updated.orderNumber}`, {
          description: `السبب: ${reason}`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "تعذر إلغاء الطلب";
      toast.error(msg);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Send new test order to backend
  const handleSimulateNewOrder = async () => {
    try {
      setIsSimulating(true);
      await orderRepository.createOrder({
        restaurantId: "rest-01",
        branchId: "branch-01",
        tableId: "table-04",
        tableName: "طاولة 4",
        items: [
          {
            id: `item-${Date.now()}`,
            productId: "prod-01",
            productNameSnapshot: "كباب مشوي على الفحم",
            unitPriceSnapshot: 195,
            quantity: 1,
            lineTotal: 195,
            selectedOptions: [],
          },
        ],
        subtotal: 195,
        total: 195,
      });
      toast.success("تم إرسال طلب تجريبي جديد بنجاح إلى النظام");
    } catch (err) {
      console.error("Order creation failed:", err);
      toast.error("تعذر إرسال الطلب التجريبي");
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-stone-100/70 text-stone-900 flex flex-col font-cairo" dir="rtl">
        {/* Staff Header */}
        <DashboardHeader
          restaurantName="مطعم الزيتونة"
          branchName="فرع المعادي - القاهرة"
          staffName="الكابتن أحمد (مشرف الصالة)"
          newOrdersCount={counts.NEW}
          onSimulateOrder={handleSimulateNewOrder}
          isSimulating={isSimulating}
        />

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-4">
          {/* Status Filters Toolbar */}
          <OrderStatusTabs
            activeTab={activeTab}
            onChangeTab={handleTabChange}
            counts={counts}
          />

          {/* Search, Delay Threshold & Sorting Controls */}
          <OrderSearchAndSort
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            sortOption={sortOption}
            onSortChange={handleSortChange}
            onlyDelayed={onlyDelayed}
            onToggleDelayed={handleDelayedToggle}
            delayedCount={delayedOrdersCount}
            totalFilteredCount={totalOrders}
          />

          {/* Orders Operational Grid / List */}
          {isInitialLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-stone-400 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-forest-700" />
              <p className="text-sm font-bold text-stone-600">جاري تحميل الطلبات الواردة من السيرفر...</p>
            </div>
          ) : loadError ? (
            <div className="bg-white rounded-3xl p-8 border border-rose-200 text-center max-w-md mx-auto space-y-4 my-8">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-stone-900 text-base">خطأ في جلب البيانات</h3>
                <p className="text-xs text-stone-500">{loadError}</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  fetchPaginatedSlice(
                    currentPage,
                    pageSize,
                    activeTab,
                    searchQuery,
                    onlyDelayed,
                    sortOption
                  )
                }
                className="py-2.5 px-5 rounded-xl bg-forest-900 text-white text-xs font-bold hover:bg-forest-950 transition-colors inline-flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>إعادة المحاولة</span>
              </button>
            </div>
          ) : pagedOrders.length === 0 ? (
            <div className="bg-white rounded-3xl border border-stone-200/90 p-12 text-center max-w-md mx-auto space-y-4 my-6 shadow-sm">
              <div className="w-14 h-14 rounded-3xl bg-forest-50 text-forest-800 flex items-center justify-center mx-auto border border-forest-100">
                <Inbox className="w-7 h-7 text-forest-700" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-extrabold text-stone-900">
                  لا توجد طلبات تطابق الفلتر الحالي
                </h3>
                <p className="text-xs text-stone-500 max-w-xs mx-auto leading-relaxed">
                  {searchQuery
                    ? `لم يتم العثور على أي طلبات تطابق البحث "${searchQuery}".`
                    : activeTab === "NEW"
                    ? "رائع! لا توجد طلبات جديدة بانتظار التأكيد حالياً."
                    : activeTab === "ALL_ACTIVE"
                    ? "لا توجد طلبات نشطة في الصالة حالياً. يمكنك محاكاة طلب جديد للاختبار."
                    : `لا توجد أي طلبات في حالة "${activeTab}".`}
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleSimulateNewOrder}
                  disabled={isSimulating}
                  className="w-full sm:w-auto py-2.5 px-4 rounded-xl bg-forest-900 hover:bg-forest-950 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-soft cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4 text-cream-200" />
                  <span>محاكاة طلب جديد الآن</span>
                </button>

                {(searchQuery || onlyDelayed || activeTab !== "ALL_ACTIVE") && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("ALL_ACTIVE");
                      setSearchQuery("");
                      setOnlyDelayed(false);
                      setCurrentPage(1);
                    }}
                    className="w-full sm:w-auto py-2.5 px-4 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-100 font-bold text-xs transition-colors cursor-pointer"
                  >
                    إعادة ضبط الفلاتر وعرض النشطة
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Grid of Order Cards with subtle loading state */}
              <div className="relative">
                {isPageLoading && (
                  <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] rounded-3xl z-10 flex items-center justify-center">
                    <div className="bg-white/95 px-4 py-2.5 rounded-2xl shadow-md border border-stone-200 flex items-center gap-2 text-forest-800 text-xs font-bold">
                      <Loader2 className="w-4 h-4 animate-spin text-forest-700" />
                      <span>جاري تحديث الصفحة...</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pagedOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      isSelected={selectedOrder?.id === order.id}
                      onSelect={(ord: Order) => {
                        setSelectedOrder(ord);
                        setIsDetailsOpen(true);
                      }}
                      onUpdateStatus={handleUpdateStatus}
                      onRequestCancel={(ord: Order) => {
                        setOrderToCancel(ord);
                        setIsCancelModalOpen(true);
                      }}
                      onOpenSession={(ord: Order) => {
                        setOrderForSession(ord);
                        setIsSessionDrawerOpen(true);
                      }}
                      isUpdating={updatingOrderId === order.id}
                    />
                  ))}
                </div>
              </div>

              {/* Server-Side Pagination Controls */}
              <OrdersPagination
                page={currentPage}
                pageSize={pageSize}
                total={totalOrders}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                isLoading={isPageLoading}
              />
            </div>
          )}
        </main>

        {/* Slide-out Order Details Side Drawer */}
        <OrderDetailsDrawer
          order={selectedOrder}
          isOpen={isDetailsOpen}
          onClose={() => setIsDetailsOpen(false)}
          onUpdateStatus={handleUpdateStatus}
          onRequestCancel={(ord) => {
            setOrderToCancel(ord);
            setIsCancelModalOpen(true);
          }}
          onPrintReceipt={(ord) => {
            setOrderToPrint(ord);
            setIsReceiptModalOpen(true);
          }}
          onOpenSession={(ord) => {
            setOrderForSession(ord);
            setIsSessionDrawerOpen(true);
          }}
          isUpdating={updatingOrderId === selectedOrder?.id}
        />

        {/* Cancel Order Confirmation Modal */}
        <OrderCancelModal
          order={orderToCancel}
          isOpen={isCancelModalOpen}
          onClose={() => {
            setIsCancelModalOpen(false);
            setOrderToCancel(null);
          }}
          onConfirmCancel={handleConfirmCancel}
          isCancelling={updatingOrderId === orderToCancel?.id}
        />

        {/* Kitchen Ticket / Receipt Print Modal */}
        <OrderReceiptModal
          order={orderToPrint}
          isOpen={isReceiptModalOpen}
          onClose={() => {
            setIsReceiptModalOpen(false);
            setOrderToPrint(null);
          }}
          restaurantName="مطعم الزيتونة"
          branchName="فرع المعادي - القاهرة"
        />

        {/* Table Session Details Side Drawer */}
        <TableSessionDrawer
          order={orderForSession}
          isOpen={isSessionDrawerOpen}
          onClose={() => {
            setIsSessionDrawerOpen(false);
            setOrderForSession(null);
          }}
          onSelectOrder={(ord) => {
            setSelectedOrder(ord);
            setIsDetailsOpen(true);
          }}
          onSessionClosed={() => {
            fetchPaginatedSlice(
              currentPage,
              pageSize,
              activeTab,
              searchQuery,
              onlyDelayed,
              sortOption
            );
            loadOrderCounts();
          }}
        />
      </div>
    </AuthGuard>
  );
}
