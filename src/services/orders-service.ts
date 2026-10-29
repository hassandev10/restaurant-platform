import { apiClient } from "@/lib/api-client";
import { Order, OrderEvent, OrderStatus } from "@/types/order";

export interface IOrdersService {
  getActiveOrders(restaurantId?: string): Promise<Order[]>;
  getHistoricalOrders(restaurantId?: string): Promise<Order[]>;
  getAllOrders(restaurantId?: string): Promise<Order[]>;
  getOrderByID(orderId: string): Promise<Order>;
  getOrderEvents(orderId: string): Promise<OrderEvent[]>;
  updateOrderStatus(orderId: string, status: OrderStatus, actor?: string, note?: string): Promise<Order>;
  cancelOrder(orderId: string, reason: string, actor?: string): Promise<Order>;
  simulateOrder(restaurantId?: string): Promise<Order>;
}

export class OrdersService implements IOrdersService {
  async getActiveOrders(restaurantId?: string): Promise<Order[]> {
    return await apiClient.get<Order[]>("/api/v1/dashboard/orders", { restaurantId });
  }

  async getHistoricalOrders(restaurantId?: string): Promise<Order[]> {
    return await apiClient.get<Order[]>("/api/v1/dashboard/orders/history", { restaurantId });
  }

  async getAllOrders(restaurantId?: string): Promise<Order[]> {
    const [active, history] = await Promise.all([
      this.getActiveOrders(restaurantId).catch(() => [] as Order[]),
      this.getHistoricalOrders(restaurantId).catch(() => [] as Order[]),
    ]);

    // Combine and sort by createdAt descending
    const all = [...active, ...history];
    return all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getOrderByID(orderId: string): Promise<Order> {
    return await apiClient.get<Order>(`/api/v1/orders/${orderId}`);
  }

  async getOrderEvents(orderId: string): Promise<OrderEvent[]> {
    return await apiClient.get<OrderEvent[]>(`/api/v1/orders/${orderId}/events`);
  }

  async updateOrderStatus(orderId: string, status: OrderStatus, actor: string = "Admin", note: string = ""): Promise<Order> {
    return await apiClient.patch<Order>(`/api/v1/orders/${orderId}/status`, { status, actor, note });
  }

  async cancelOrder(orderId: string, reason: string, actor: string = "Admin"): Promise<Order> {
    return await apiClient.post<Order>(`/api/v1/orders/${orderId}/cancel`, { reason, actor });
  }

  async simulateOrder(restaurantId: string = "rest-01"): Promise<Order> {
    return await apiClient.post<Order>("/api/v1/dashboard/orders/simulate", undefined, {
      params: { restaurantId },
    });
  }
}

export const ordersService = new OrdersService();
