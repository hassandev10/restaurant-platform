import {
  RestaurantTable,
  TableStatus,
  TableSection,
  TableStats,
  TableFilterParams,
  TableSubscriptionEvent,
} from "@/types/table";
import { Order, OrderStatus } from "@/types/order";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

function getWebSocketUrl(): string {
  try {
    const url = new URL(API_BASE_URL);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/api/v1/ws";
    return url.toString();
  } catch {
    return "ws://localhost:8080/api/v1/ws";
  }
}

export interface ITableRepository {
  getTables(filters?: TableFilterParams): Promise<RestaurantTable[]>;
  getTableById(id: string): Promise<RestaurantTable | null>;
  getTableWithActiveOrder(id: string): Promise<{ table: RestaurantTable; activeOrder: Order | null }>;
  getTableStats(): Promise<TableStats>;
  openTableSession(id: string, guestCount?: number): Promise<RestaurantTable>;
  closeTableSession(id: string): Promise<RestaurantTable>;
  updateTableStatus(id: string, status: TableStatus, notes?: string): Promise<RestaurantTable>;
  reserveTable(
    id: string,
    reservation: {
      guestName: string;
      guestPhone: string;
      guestCount: number;
      reservedTime: string;
      notes?: string;
    }
  ): Promise<RestaurantTable>;
  cancelReservation(id: string): Promise<RestaurantTable>;
  subscribeToTableEvents(callback: (event: TableSubscriptionEvent) => void): () => void;
}

interface BackendTableRecord {
  id: string;
  restaurantId: string;
  branchId?: string;
  tableNumber: string;
  displayName?: string;
  name?: string;
  capacity: number;
  sectionId?: string;
  sectionName?: string;
  token?: string;
  status: TableStatus;
  notes?: string;
  currentSession?: {
    id: string;
    openedAt: string;
    status: string;
    durationMinutes?: number;
  };
  activeOrder?: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    total: number;
    itemsCount: number;
  };
  updatedAt?: string;
}

export class ApiTableRepository implements ITableRepository {
  private listeners: Set<(event: TableSubscriptionEvent) => void> = new Set();
  private cachedToken: string | null = null;

  public setAuthToken(token: string) {
    this.cachedToken = token;
  }

  private async getAuthHeader(): Promise<Record<string, string>> {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("smart_restaurant_staff_session_v1");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.token) {
            return { Authorization: `Bearer ${parsed.token}` };
          }
        }
      } catch {
        // Ignore
      }
    }

    if (this.cachedToken) {
      return { Authorization: `Bearer ${this.cachedToken}` };
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "password123" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          this.cachedToken = data.token;
          return { Authorization: `Bearer ${data.token}` };
        }
      }
    } catch {
      // Ignore network error in Node
    }

    return {};
  }

  private mapBackendTable(bt: BackendTableRecord): RestaurantTable {
    const num = parseInt(bt.tableNumber || bt.name?.replace(/\D/g, "") || "1", 10) || 1;
    let section: TableSection = "MAIN_HALL";
    const secName = bt.sectionName || "";
    if (secName.includes("تراس") || secName.includes("ترّاس") || bt.sectionId === "sec-terrace") {
      section = "TERRACE";
    } else if (secName.includes("VIP") || bt.sectionId === "sec-vip") {
      section = "VIP";
    } else if (secName.includes("عائلات")) {
      section = "FAMILY";
    }

    return {
      id: bt.id,
      tableNumber: num,
      restaurantId: bt.restaurantId,
      branchId: bt.branchId || "branch-01",
      name: bt.displayName || bt.name || `طاولة ${num}`,
      token: bt.token || `tbl-${num}`,
      status: bt.status || "AVAILABLE",
      capacity: bt.capacity || 4,
      section,
      sectionNameAr:
        bt.sectionName ||
        (section === "TERRACE"
          ? "التراس الخارجي"
          : section === "VIP"
          ? "جناح VIP"
          : "الصالة الرئيسية"),
      notes: bt.notes,
      currentOrderId: bt.activeOrder?.id,
      currentOrderNumber: bt.activeOrder?.orderNumber,
      currentOrderTotal: bt.activeOrder?.total,
      currentOrderStatus: bt.activeOrder?.status,
      sessionStartedAt: bt.currentSession?.openedAt,
      guestCount: bt.capacity,
      updatedAt: bt.updatedAt,
    };
  }

  async getTables(filters?: TableFilterParams): Promise<RestaurantTable[]> {
    const authHeader = await this.getAuthHeader();
    const params = new URLSearchParams();
    if (filters?.status && filters.status !== "ALL") params.append("status", filters.status);
    if (filters?.query) params.append("search", filters.query);

    const url = `${API_BASE_URL}/api/v1/tables?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        ...authHeader,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`فشل جلب قائمة الطاولات: ${res.statusText}`);
    }

    const data = await res.json();
    const tablesList: BackendTableRecord[] = Array.isArray(data) ? data : data.tables || [];
    let result = tablesList.map((t) => this.mapBackendTable(t));

    if (filters?.section && filters.section !== "ALL") {
      result = result.filter((t: RestaurantTable) => t.section === filters.section);
    }

    if (filters?.sortBy) {
      switch (filters.sortBy) {
        case "NUMBER_ASC":
          result.sort((a: RestaurantTable, b: RestaurantTable) => a.tableNumber - b.tableNumber);
          break;
        case "NUMBER_DESC":
          result.sort((a: RestaurantTable, b: RestaurantTable) => b.tableNumber - a.tableNumber);
          break;
        case "CAPACITY_DESC":
          result.sort((a: RestaurantTable, b: RestaurantTable) => b.capacity - a.capacity);
          break;
        case "DURATION_DESC":
          result.sort((a: RestaurantTable, b: RestaurantTable) => {
            const timeA = a.sessionStartedAt ? new Date(a.sessionStartedAt).getTime() : Date.now();
            const timeB = b.sessionStartedAt ? new Date(b.sessionStartedAt).getTime() : Date.now();
            return timeA - timeB;
          });
          break;
      }
    } else {
      result.sort((a: RestaurantTable, b: RestaurantTable) => a.tableNumber - b.tableNumber);
    }

    return result;
  }

  async getTableById(id: string): Promise<RestaurantTable | null> {
    const authHeader = await this.getAuthHeader();
    const res = await fetch(`${API_BASE_URL}/api/v1/tables/${encodeURIComponent(id)}`, {
      headers: { ...authHeader },
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`فشل جلب تفاصيل الطاولة: ${res.statusText}`);
    const data = await res.json();
    return this.mapBackendTable(data);
  }

  async getTableWithActiveOrder(
    id: string
  ): Promise<{ table: RestaurantTable; activeOrder: Order | null }> {
    const authHeader = await this.getAuthHeader();
    const [table, activeOrderRes] = await Promise.all([
      this.getTableById(id),
      fetch(`${API_BASE_URL}/api/v1/tables/${encodeURIComponent(id)}/active-order`, {
        headers: { ...authHeader },
        cache: "no-store",
      }),
    ]);

    if (!table) throw new Error("الطاولة غير موجودة");

    let activeOrder: Order | null = null;
    if (activeOrderRes.ok) {
      activeOrder = await activeOrderRes.json();
    }

    return { table, activeOrder };
  }

  async getTableStats(): Promise<TableStats> {
    const tables = await this.getTables();
    const nowMs = Date.now();
    const stats: TableStats = {
      total: tables.length,
      available: 0,
      occupied: 0,
      reserved: 0,
      cleaning: 0,
      outOfService: 0,
      attentionRequired: 0,
    };

    tables.forEach((t) => {
      switch (t.status) {
        case "AVAILABLE":
        case "ACTIVE":
          stats.available++;
          break;
        case "OCCUPIED":
          stats.occupied++;
          if (t.sessionStartedAt) {
            const diffMins = (nowMs - new Date(t.sessionStartedAt).getTime()) / 60000;
            if (diffMins > 45) stats.attentionRequired++;
          }
          break;
        case "RESERVED":
          stats.reserved++;
          break;
        case "CLEANING":
          stats.cleaning++;
          stats.attentionRequired++;
          break;
        case "OUT_OF_SERVICE":
        case "INACTIVE":
          stats.outOfService++;
          break;
      }
    });

    return stats;
  }

  async openTableSession(id: string, guestCount?: number): Promise<RestaurantTable> {
    const authHeader = await this.getAuthHeader();
    const res = await fetch(`${API_BASE_URL}/api/v1/tables/${encodeURIComponent(id)}/sessions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
      },
      body: JSON.stringify({ guestCount, notes: "جلسة جديدة" }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `فشل فتح الجلسة: ${res.statusText}`);
    }

    const updatedTable = await this.getTableById(id);
    if (!updatedTable) throw new Error("تعذر جلب بيانات الطاولة بعد فتح الجلسة");
    return updatedTable;
  }

  async closeTableSession(id: string): Promise<RestaurantTable> {
    const { activeOrder } = await this.getTableWithActiveOrder(id);
    if (
      activeOrder &&
      ["NEW", "CONFIRMED", "PREPARING", "READY"].includes(activeOrder.status)
    ) {
      throw new Error(
        `لا يمكن إنهاء الجلسة أو تحرير الطاولة لوجود طلب نشط (${activeOrder.orderNumber} - ${activeOrder.status}). يجب تقديم الطلب أو إلغاؤه أولاً.`
      );
    }

    const authHeader = await this.getAuthHeader();
    const res = await fetch(
      `${API_BASE_URL}/api/v1/tables/${encodeURIComponent(id)}/sessions/latest/close`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader,
        },
        body: JSON.stringify({
          override: false,
          targetStatus: "CLEANING",
          notes: "إنهاء الجلسة",
        }),
      }
    );

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `فشل إنهاء الجلسة: ${res.statusText}`);
    }

    const updated = await this.getTableById(id);
    if (!updated) throw new Error("تعذر جلب بيانات الطاولة بعد إنهاء الجلسة");
    return updated;
  }

  async updateTableStatus(
    id: string,
    status: TableStatus,
    notes?: string
  ): Promise<RestaurantTable> {
    const authHeader = await this.getAuthHeader();
    const res = await fetch(`${API_BASE_URL}/api/v1/tables/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
      },
      body: JSON.stringify({ status, notes }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `فشل تحديث حالة الطاولة`);
    }

    const updated = await this.getTableById(id);
    if (!updated) throw new Error("تعذر جلب بيانات الطاولة");
    return updated;
  }

  async reserveTable(
    id: string,
    reservation: {
      guestName: string;
      guestPhone: string;
      guestCount: number;
      reservedTime: string;
      notes?: string;
    }
  ): Promise<RestaurantTable> {
    const authHeader = await this.getAuthHeader();
    const res = await fetch(`${API_BASE_URL}/api/v1/tables/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
      },
      body: JSON.stringify({
        status: "RESERVED",
        notes: `حجز باسم: ${reservation.guestName} (${reservation.guestPhone}) - ${reservation.reservedTime}`,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `فشل تسجيل الحجز للطاولة`);
    }

    const updated = await this.getTableById(id);
    if (!updated) throw new Error("تعذر جلب بيانات الطاولة المحجوزة");
    return updated;
  }

  async cancelReservation(id: string): Promise<RestaurantTable> {
    return this.updateTableStatus(id, "AVAILABLE", "");
  }

  subscribeToTableEvents(callback: (event: TableSubscriptionEvent) => void): () => void {
    this.listeners.add(callback);
    let ws: WebSocket | null = null;

    if (typeof window !== "undefined") {
      try {
        ws = new WebSocket(getWebSocketUrl());

        ws.onopen = () => {
          try {
            ws?.send(JSON.stringify({ action: "subscribe", restaurantId: "rest-01" }));
          } catch {
            // Ignore
          }
        };

        ws.onmessage = (msg: MessageEvent) => {
          try {
            const data = JSON.parse(msg.data);
            const typeStr = String(data.type || "").toLowerCase();
            if (
              typeStr.startsWith("table.") ||
              typeStr.startsWith("order.") ||
              typeStr === "created" ||
              typeStr === "updated" ||
              typeStr === "cancelled"
            ) {
              const tableObj: RestaurantTable =
                data.table ||
                (data.data && data.data.id ? data.data : ({ id: data.tableId || "table-04" } as unknown as RestaurantTable));

              callback({
                type: "STATUS_CHANGED",
                table: tableObj,
                timestamp: data.timestamp || new Date().toISOString(),
              });
            }
          } catch {
            // Ignore parse errors
          }
        };
      } catch {
        // Fallback
      }
    }

    return () => {
      this.listeners.delete(callback);
      if (ws) {
        try {
          ws.close();
        } catch {
          // Ignore
        }
      }
    };
  }
}

export const tableRepository: ITableRepository = new ApiTableRepository();
