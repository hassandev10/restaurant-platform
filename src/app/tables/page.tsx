"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  RestaurantTable,
  TableStatus,
  TableSection,
  TableSortOption,
  TableStats,
} from "@/types/table";
import { Order } from "@/types/order";
import { tableRepository } from "@/repositories/table-repository";
import { orderRepository } from "@/repositories/order-repository";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { AuthGuard } from "@/components/dashboard/auth-guard";
import { TableSummaryCards } from "@/components/tables/table-summary-cards";
import { TableFiltersAndSearch } from "@/components/tables/table-filters-and-search";
import { TableCard } from "@/components/tables/table-card";
import { TableDetailsDrawer } from "@/components/tables/table-details-drawer";
import { TableReservationModal } from "@/components/tables/table-reservation-modal";
import { TableSessionModal } from "@/components/tables/table-session-modal";
import { TableCloseConfirmModal } from "@/components/tables/table-close-confirm-modal";
import { playActionSuccessPing } from "@/lib/sound";
import { toast } from "sonner";
import {
  Layers,
  RefreshCw,
  AlertCircle,
  Inbox,
} from "lucide-react";

export default function TablesManagementPage() {
  const router = useRouter();

  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [stats, setStats] = useState<TableStats>({
    total: 0,
    available: 0,
    occupied: 0,
    reserved: 0,
    cleaning: 0,
    outOfService: 0,
    attentionRequired: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters & Search state
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<TableStatus | "ALL">("ALL");
  const [selectedSection, setSelectedSection] = useState<TableSection | "ALL">("ALL");
  const [sortOption, setSortOption] = useState<TableSortOption>("NUMBER_ASC");

  // Selected table & drawer state
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Modals state
  const [sessionModalTable, setSessionModalTable] = useState<RestaurantTable | null>(null);
  const [reservationModalTable, setReservationModalTable] = useState<RestaurantTable | null>(null);
  const [closeConfirmTable, setCloseConfirmTable] = useState<RestaurantTable | null>(null);
  const [closeConfirmOrder, setCloseConfirmOrder] = useState<Order | null>(null);
  const [isClosingSession, setIsClosingSession] = useState<boolean>(false);

  // Load all tables & stats from repository
  const loadTablesData = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const [allTables, currentStats] = await Promise.all([
        tableRepository.getTables(),
        tableRepository.getTableStats(),
      ]);
      setTables(allTables);
      setStats(currentStats);
    } catch (err: unknown) {
      setLoadError(
        err instanceof Error
          ? err.message
          : "تعذر تحميل بيانات الطاولات. يرجى التحقق وإعادة المحاولة."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTablesData();

    // Subscribe to live table events
    const unsubTables = tableRepository.subscribeToTableEvents(() => {
      loadTablesData();
    });

    // Subscribe to order events
    const unsubOrders = orderRepository.subscribeToOrders(() => {
      loadTablesData();
    });

    // Background sync every 4 seconds to guarantee real-time table state
    const pollInterval = setInterval(() => {
      loadTablesData();
    }, 4000);

    return () => {
      clearInterval(pollInterval);
      unsubTables();
      unsubOrders();
    };
  }, [loadTablesData]);

  // Handle selecting a table to inspect in drawer
  const handleSelectTable = async (table: RestaurantTable) => {
    setSelectedTable(table);
    try {
      const { activeOrder: order } = await tableRepository.getTableWithActiveOrder(table.id);
      setActiveOrder(order);
    } catch {
      setActiveOrder(null);
    }
    setIsDrawerOpen(true);
  };

  // Status counts for filter tabs
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      AVAILABLE: 0,
      OCCUPIED: 0,
      RESERVED: 0,
      CLEANING: 0,
      OUT_OF_SERVICE: 0,
    };
    tables.forEach((t) => {
      if (t.status === "AVAILABLE" || t.status === "ACTIVE") counts.AVAILABLE++;
      else if (t.status === "OCCUPIED") counts.OCCUPIED++;
      else if (t.status === "RESERVED") counts.RESERVED++;
      else if (t.status === "CLEANING") counts.CLEANING++;
      else if (t.status === "OUT_OF_SERVICE" || t.status === "INACTIVE") counts.OUT_OF_SERVICE++;
    });
    return counts;
  }, [tables]);

  // Filtered and sorted tables
  const filteredTables = useMemo(() => {
    let result = [...tables];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.tableNumber.toString().includes(q) ||
          t.sectionNameAr.toLowerCase().includes(q) ||
          (t.currentOrderNumber && t.currentOrderNumber.toLowerCase().includes(q)) ||
          (t.currentReservation && t.currentReservation.guestName.toLowerCase().includes(q))
      );
    }

    // Status filter
    if (selectedStatus !== "ALL") {
      result = result.filter((t) => {
        if (selectedStatus === "AVAILABLE") return t.status === "AVAILABLE" || t.status === "ACTIVE";
        if (selectedStatus === "OUT_OF_SERVICE")
          return t.status === "OUT_OF_SERVICE" || t.status === "INACTIVE";
        return t.status === selectedStatus;
      });
    }

    // Section filter
    if (selectedSection !== "ALL") {
      result = result.filter((t) => t.section === selectedSection);
    }

    // Sorting
    switch (sortOption) {
      case "NUMBER_ASC":
        result.sort((a, b) => a.tableNumber - b.tableNumber);
        break;
      case "NUMBER_DESC":
        result.sort((a, b) => b.tableNumber - a.tableNumber);
        break;
      case "CAPACITY_DESC":
        result.sort((a, b) => b.capacity - a.capacity);
        break;
      case "DURATION_DESC":
        result.sort((a, b) => {
          const timeA = a.sessionStartedAt ? new Date(a.sessionStartedAt).getTime() : Date.now();
          const timeB = b.sessionStartedAt ? new Date(b.sessionStartedAt).getTime() : Date.now();
          return timeA - timeB;
        });
        break;
    }

    return result;
  }, [tables, searchQuery, selectedStatus, selectedSection, sortOption]);

  // Actions implementations
  const handleOpenSession = async (table: RestaurantTable, guestCount: number) => {
    try {
      const updated = await tableRepository.openTableSession(table.id, guestCount);
      toast.success(`تم فتح جلسة جديدة على ${updated.name} بنجاح 🎉`);
      playActionSuccessPing();
      loadTablesData();
      if (selectedTable?.id === table.id) {
        setSelectedTable(updated);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "فشل فتح الجلسة");
    }
  };

  const handleMarkCleaned = async (table: RestaurantTable) => {
    try {
      const updated = await tableRepository.updateTableStatus(table.id, "AVAILABLE");
      toast.success(`تم تنظيف ${updated.name} وإتاحتها للضيوف ✨`);
      playActionSuccessPing();
      loadTablesData();
      if (selectedTable?.id === table.id) {
        setSelectedTable(updated);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "فشل تحديث حالة الطاولة");
    }
  };

  const handlePromptCloseSession = async (table: RestaurantTable) => {
    try {
      const { activeOrder: order } = await tableRepository.getTableWithActiveOrder(table.id);
      setCloseConfirmTable(table);
      setCloseConfirmOrder(order);
    } catch {
      setCloseConfirmTable(table);
      setCloseConfirmOrder(null);
    }
  };

  const handleConfirmCloseSession = async () => {
    if (!closeConfirmTable) return;
    try {
      setIsClosingSession(true);
      const updated = await tableRepository.closeTableSession(closeConfirmTable.id);
      toast.success(`تم إنهاء جلسة ${updated.name} وتحويلها للتنظيف 🧹`);
      playActionSuccessPing();
      setCloseConfirmTable(null);
      setCloseConfirmOrder(null);
      setIsDrawerOpen(false);
      loadTablesData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "فشل إنهاء الجلسة");
    } finally {
      setIsClosingSession(false);
    }
  };

  const handleCreateReservation = async (reservationData: {
    guestName: string;
    guestPhone: string;
    guestCount: number;
    reservedTime: string;
    notes?: string;
  }) => {
    if (!reservationModalTable) return;
    try {
      const updated = await tableRepository.reserveTable(
        reservationModalTable.id,
        reservationData
      );
      toast.success(
        `تم تسجيل حجز ${reservationData.guestName} على ${updated.name} بنجاح 📅`
      );
      playActionSuccessPing();
      loadTablesData();
      if (selectedTable?.id === reservationModalTable.id) {
        setSelectedTable(updated);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "فشل تسجيل الحجز");
    }
  };

  const handleCancelReservation = async (table: RestaurantTable) => {
    try {
      const updated = await tableRepository.cancelReservation(table.id);
      toast.info(`تم إلغاء الحجز وإتاحة ${updated.name}`);
      playActionSuccessPing();
      loadTablesData();
      if (selectedTable?.id === table.id) {
        setSelectedTable(updated);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "فشل إلغاء الحجز");
    }
  };

  const handleToggleOutOfService = async (table: RestaurantTable, enable: boolean) => {
    try {
      const newStatus: TableStatus = enable ? "OUT_OF_SERVICE" : "AVAILABLE";
      const notes = enable ? "معطلة للصيانة الدورية" : undefined;
      const updated = await tableRepository.updateTableStatus(table.id, newStatus, notes);
      toast.success(
        enable
          ? `تم تحويل ${updated.name} كخارج الخدمة مؤقتاً`
          : `تم إعادة ${updated.name} للخدمة بنجاح`
      );
      playActionSuccessPing();
      loadTablesData();
      if (selectedTable?.id === table.id) {
        setSelectedTable(updated);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "فشل تحديث حالة الطاولة");
    }
  };

  const handleNavigateToOrder = (orderId: string) => {
    router.push(`/orders?search=${encodeURIComponent(orderId)}`);
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedStatus("ALL");
    setSelectedSection("ALL");
    setSortOption("NUMBER_ASC");
  };

  return (
    <AuthGuard>
      <div className="min-h-screen bg-stone-100/70 text-stone-900 flex flex-col font-cairo" dir="rtl">
        {/* Header with Navigation */}
        <DashboardHeader
          restaurantName="مطعم الزيتونة"
          branchName="فرع المعادي - القاهرة"
        />

        {/* Main Content Container */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6 flex-1">
          {/* Top Page Title & Subtitle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-forest-900 text-cream-100 flex items-center justify-center shadow-xs">
                  <Layers className="w-5 h-5 text-cream-200" />
                </div>
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                    إدارة الطاولات والصالات
                  </h1>
                  <p className="text-xs text-stone-500 font-medium mt-0.5">
                    مراقبة إشغال الصالة، متابعة الجلسات والطلبات النشطة، وإدارة الحجوزات
                  </p>
                </div>
              </div>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={loadTablesData}
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-bold transition-all shadow-xs active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-forest-800" : ""}`} />
              <span>تحديث البيانات</span>
            </button>
          </div>

          {/* Section 1: Summary Cards Overview */}
          <TableSummaryCards
            stats={stats}
            selectedStatus={selectedStatus}
            onSelectStatus={(status) => setSelectedStatus(status)}
          />

          {/* Section 2: Search, Filters, and Sorting Bar */}
          <TableFiltersAndSearch
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedStatus={selectedStatus}
            onStatusChange={setSelectedStatus}
            selectedSection={selectedSection}
            onSectionChange={setSelectedSection}
            sortOption={sortOption}
            onSortChange={setSortOption}
            onResetFilters={handleResetFilters}
            statusCounts={statusCounts}
            totalFiltered={filteredTables.length}
          />

          {/* Section 3: Tables Grid or States */}
          {isLoading ? (
            /* Loading Skeleton */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-stone-200 p-4 space-y-4 animate-pulse"
                >
                  <div className="flex justify-between items-center">
                    <div className="w-24 h-6 bg-stone-200 rounded-lg" />
                    <div className="w-16 h-6 bg-stone-200 rounded-lg" />
                  </div>
                  <div className="space-y-2 py-4">
                    <div className="w-3/4 h-4 bg-stone-100 rounded" />
                    <div className="w-1/2 h-3 bg-stone-100 rounded" />
                  </div>
                  <div className="w-full h-9 bg-stone-200 rounded-xl" />
                </div>
              ))}
            </div>
          ) : loadError ? (
            /* Error State */
            <div className="p-8 rounded-3xl bg-white border border-rose-200 text-center space-y-4 shadow-sm max-w-lg mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-base text-stone-900">حدث خطأ أثناء تحميل الطاولات</h3>
                <p className="text-xs text-rose-700 mt-1">{loadError}</p>
              </div>
              <button
                type="button"
                onClick={loadTablesData}
                className="py-2.5 px-6 rounded-xl bg-forest-900 text-white font-bold text-xs shadow-sm hover:bg-forest-950 transition-all inline-flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>إعادة المحاولة</span>
              </button>
            </div>
          ) : filteredTables.length === 0 ? (
            /* Empty State */
            <div className="p-12 rounded-3xl bg-white border border-stone-200 text-center space-y-4 shadow-2xs max-w-md mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-stone-100 text-stone-400 flex items-center justify-center mx-auto">
                <Inbox className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-black text-base text-stone-900">لا توجد طاولات مطابقة للبحث</h3>
                <p className="text-xs text-stone-500 mt-1">
                  لم يتم العثور على أي طاولة بالمعايير أو الفلاتر المحددة حالياً.
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetFilters}
                className="py-2.5 px-5 rounded-xl border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-50 transition-colors"
              >
                إعادة ضبط جميع الفلاتر
              </button>
            </div>
          ) : (
            /* Active Responsive Tables Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredTables.map((table) => (
                <TableCard
                  key={table.id}
                  table={table}
                  onSelectTable={handleSelectTable}
                  onOpenSession={(tbl) => setSessionModalTable(tbl)}
                  onMarkCleaned={handleMarkCleaned}
                  onOpenOrder={(orderId) => handleNavigateToOrder(orderId)}
                />
              ))}
            </div>
          )}
        </main>

        {/* Section 4: Slide-in Table Details Drawer */}
        <TableDetailsDrawer
          table={selectedTable}
          activeOrder={activeOrder}
          isOpen={isDrawerOpen}
          onClose={() => {
            setIsDrawerOpen(false);
            setSelectedTable(null);
            setActiveOrder(null);
          }}
          onOpenSessionModal={(tbl) => {
            setIsDrawerOpen(false);
            setSessionModalTable(tbl);
          }}
          onOpenReservationModal={(tbl) => {
            setIsDrawerOpen(false);
            setReservationModalTable(tbl);
          }}
          onPromptCloseSession={(tbl) => {
            handlePromptCloseSession(tbl);
          }}
          onMarkCleaned={handleMarkCleaned}
          onCancelReservation={handleCancelReservation}
          onToggleOutOfService={handleToggleOutOfService}
          onNavigateToOrder={handleNavigateToOrder}
        />

        {/* Section 5: Modals */}
        <TableSessionModal
          table={sessionModalTable}
          isOpen={sessionModalTable !== null}
          onClose={() => setSessionModalTable(null)}
          onConfirm={async (guestCount) => {
            if (sessionModalTable) {
              await handleOpenSession(sessionModalTable, guestCount);
            }
          }}
        />

        <TableReservationModal
          table={reservationModalTable}
          isOpen={reservationModalTable !== null}
          onClose={() => setReservationModalTable(null)}
          onConfirm={handleCreateReservation}
        />

        <TableCloseConfirmModal
          table={closeConfirmTable}
          activeOrder={closeConfirmOrder}
          isOpen={closeConfirmTable !== null}
          onClose={() => {
            setCloseConfirmTable(null);
            setCloseConfirmOrder(null);
          }}
          onConfirm={handleConfirmCloseSession}
          isSubmitting={isClosingSession}
        />
      </div>
    </AuthGuard>
  );
}
