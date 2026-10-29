import { Order, OrderStatus, OrderType } from "@/types/order";
import { orderRpc } from "@/lib/rpc-client";
import { OrderStatus as OrderStatusProto, OrderType as OrderTypeProto } from "@/gen/restaurant/v1/order_pb";

export interface CreateOrderDTO {
  orderType?: OrderType;
  restaurantId: string;
  branchId: string;
  tableId?: string;
  tableToken?: string;
  tableContextToken?: string;
  tableNameSnapshot?: string;
  tableName?: string;
  items: Order["items"];
  subtotal: number;
  total: number;
}

export type OrderSubscriptionEventType = "CREATED" | "UPDATED" | "CANCELLED";

export interface OrderSubscriptionEvent {
  type: OrderSubscriptionEventType;
  order: Order;
  timestamp: string;
}

export interface IOrderRepository {
  getActiveOrders(restaurantId?: string): Promise<Order[]>;
  getHistoricalOrders(restaurantId?: string): Promise<Order[]>;
  getOrderById(orderId: string): Promise<Order | null>;
  createOrder(dto: CreateOrderDTO): Promise<Order>;
  updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    actor?: string,
    note?: string
  ): Promise<Order | null>;
  cancelOrder(
    orderId: string,
    reason: string,
    actor?: string
  ): Promise<Order | null>;
  simulateIncomingOrder(
    restaurantId?: string,
    customOrder?: Partial<Order>
  ): Promise<Order>;
  subscribeToOrders(
    callback: (event: OrderSubscriptionEvent) => void
  ): () => void;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

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

function toDomainStatus(status: OrderStatusProto | number): OrderStatus {
  switch (status) {
    case OrderStatusProto.CONFIRMED:
      return "CONFIRMED";
    case OrderStatusProto.PREPARING:
      return "PREPARING";
    case OrderStatusProto.READY:
      return "READY";
    case OrderStatusProto.SERVED:
      return "SERVED";
    case OrderStatusProto.CANCELLED:
      return "CANCELLED";
    case OrderStatusProto.NEW:
    default:
      return "NEW";
  }
}

function toProtoStatus(status: OrderStatus): OrderStatusProto {
  switch (status) {
    case "CONFIRMED":
      return OrderStatusProto.CONFIRMED;
    case "PREPARING":
      return OrderStatusProto.PREPARING;
    case "READY":
      return OrderStatusProto.READY;
    case "SERVED":
      return OrderStatusProto.SERVED;
    case "CANCELLED":
      return OrderStatusProto.CANCELLED;
    case "NEW":
    default:
      return OrderStatusProto.NEW;
  }
}

function toDomainOrder(o: any): Order {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    orderType: o.orderType === OrderTypeProto.TAKEAWAY ? "TAKEAWAY" : "DINE_IN",
    restaurantId: o.restaurantId,
    branchId: o.branchId,
    tableId: o.tableId,
    tableName: o.tableName || o.tableNameSnapshot || "",
    tableNameSnapshot: o.tableNameSnapshot || o.tableName || "",
    status: toDomainStatus(o.status),
    subtotal: o.subtotal,
    total: o.total,
    paymentStatus: (o.status === OrderStatusProto.CANCELLED || o.paymentStatus === 3) ? "CANCELLED" : o.paymentStatus === 2 ? "PAID" : "PENDING_CASHIER",
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    items: (o.items || []).map((it: any) => ({
      id: it.id,
      productId: it.productId,
      productNameSnapshot: it.productNameSnapshot,
      unitPriceSnapshot: it.unitPriceSnapshot,
      quantity: it.quantity,
      selectedOptions: (it.selectedOptions || []).map((opt: any) => ({
        groupId: opt.groupId,
        groupNameAr: opt.groupNameAr,
        optionId: opt.optionId,
        optionNameAr: opt.optionNameAr,
        priceDelta: opt.priceDelta,
      })),
      notes: it.notes,
      lineTotal: it.lineTotal,
    })),
    events: (o.events || []).map((ev: any) => ({
      id: ev.id,
      timestamp: ev.timestamp,
      status: toDomainStatus(ev.status),
      actor: ev.actor,
      note: ev.note,
    })),
  };
}

export class ApiOrderRepository implements IOrderRepository {
  async getActiveOrders(restaurantId?: string): Promise<Order[]> {
    try {
      const res = await orderRpc.listActiveOrders({
        restaurantSlug: restaurantId || "demo-restaurant",
      });
      return (res.orders || []).map(toDomainOrder);
    } catch (err) {
      console.error("ApiOrderRepository.getActiveOrders RPC failed:", err);
      return [];
    }
  }

  async getHistoricalOrders(restaurantId?: string): Promise<Order[]> {
    try {
      const res = await orderRpc.listHistoricalOrders({
        restaurantSlug: restaurantId || "demo-restaurant",
        date: "",
      });
      return (res.orders || []).map(toDomainOrder);
    } catch (err) {
      console.error("ApiOrderRepository.getHistoricalOrders RPC failed:", err);
      return [];
    }
  }

  async getOrderById(orderId: string): Promise<Order | null> {
    try {
      const res = await orderRpc.getOrder({ orderId });
      if (!res.order) return null;
      return toDomainOrder(res.order);
    } catch (err) {
      console.error(`ApiOrderRepository.getOrderById RPC failed for ${orderId}:`, err);
      return null;
    }
  }

  async createOrder(dto: CreateOrderDTO): Promise<Order> {
    try {
      const res = await orderRpc.createOrder({
        orderType: dto.orderType === "TAKEAWAY" ? OrderTypeProto.TAKEAWAY : OrderTypeProto.DINE_IN,
        restaurantId: dto.restaurantId,
        branchId: dto.branchId,
        tableId: dto.tableId || "",
        tableToken: dto.tableToken || "",
        tableContextToken: dto.tableContextToken || "",
        tableNameSnapshot: dto.tableNameSnapshot || dto.tableName || "",
        tableName: dto.tableName || dto.tableNameSnapshot || "",
        items: dto.items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          notes: it.notes || "",
          selectedOptions: (it.selectedOptions || []).map((opt) => ({
            groupId: opt.groupId,
            optionId: opt.optionId,
          })),
        })),
        notes: "",
        forceNewOrder: false,
      });

      if (!res.order) {
        throw new Error("لم يتم استلام تفاصيل الطلب من الخادم");
      }

      return toDomainOrder(res.order);
    } catch (err: any) {
      const msg = err?.message || err?.rawMessage || "فشل إرسال الطلب";
      throw new Error(msg);
    }
  }

  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    actor?: string,
    note?: string
  ): Promise<Order | null> {
    try {
      const res = await orderRpc.updateOrderStatus({
        orderId,
        status: toProtoStatus(status),
        actor: actor || "",
        note: note || "",
        allowLowStockOverride: false,
        overrideReason: "",
      });
      if (!res.order) return null;
      return toDomainOrder(res.order);
    } catch (err) {
      console.error(`ApiOrderRepository.updateOrderStatus RPC failed for ${orderId}:`, err);
      return null;
    }
  }

  async cancelOrder(
    orderId: string,
    reason: string,
    actor?: string
  ): Promise<Order | null> {
    try {
      const res = await orderRpc.cancelOrder({
        orderId,
        reason,
        actor: actor || "",
      });
      if (!res.order) return null;
      return toDomainOrder(res.order);
    } catch (err) {
      console.error(`ApiOrderRepository.cancelOrder RPC failed for ${orderId}:`, err);
      return null;
    }
  }

  async simulateIncomingOrder(
    restaurantId?: string,
    customOrder?: Partial<Order>
  ): Promise<Order> {
    try {
      const res = await orderRpc.simulateIncomingOrder({
        restaurantId: restaurantId || "rest-01",
        branchId: "branch-01",
      });
      if (!res.order) throw new Error("فشل محاكاة الطلب");
      return toDomainOrder(res.order);
    } catch (err) {
      console.error("ApiOrderRepository.simulateIncomingOrder RPC failed:", err);
      throw err;
    }
  }

  subscribeToOrders(
    callback: (event: OrderSubscriptionEvent) => void
  ): () => void {
    let ws: WebSocket | null = null;
    let isDisposed = false;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const connect = () => {
      if (isDisposed) return;
      try {
        ws = new WebSocket(getWebSocketUrl());

        ws.onopen = () => {
          console.log("[OrderRepo WS] Connected to live orders stream");
        };

        ws.onmessage = (event) => {
          try {
            const rawMsg = JSON.parse(event.data);
            if (rawMsg.type && rawMsg.order) {
              callback({
                type: rawMsg.type,
                order: rawMsg.order,
                timestamp: rawMsg.timestamp || new Date().toISOString(),
              });
            }
          } catch (e) {
            console.error("[OrderRepo WS] Parse error:", e);
          }
        };

        ws.onclose = () => {
          if (!isDisposed) {
            reconnectTimer = setTimeout(connect, 3000);
          }
        };

        ws.onerror = (err) => {
          console.error("[OrderRepo WS] Error:", err);
          ws?.close();
        };
      } catch (e) {
        console.error("[OrderRepo WS] Initialization error:", e);
        if (!isDisposed) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      }
    };

    connect();

    return () => {
      isDisposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }
}

export const orderRepository: IOrderRepository = new ApiOrderRepository();
