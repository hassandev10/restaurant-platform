import { createClient, Interceptor } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";

import { AuthService } from "@/gen/restaurant/v1/auth_pb";
import { RestaurantService } from "@/gen/restaurant/v1/restaurant_pb";
import { MenuService } from "@/gen/restaurant/v1/menu_pb";
import { TableService } from "@/gen/restaurant/v1/table_pb";
import { OrderService } from "@/gen/restaurant/v1/order_pb";
import { InventoryService } from "@/gen/restaurant/v1/inventory_pb";
import { AdminService } from "@/gen/restaurant/v1/admin_pb";

import { CONFIG } from "./config";
import { SessionStorageManager } from "./storage";

const authInterceptor: Interceptor = (next) => async (req) => {
  const token = SessionStorageManager.getToken();
  if (token) {
    req.header.set("Authorization", `Bearer ${token}`);
  }
  return await next(req);
};

export const transport = createConnectTransport({
  baseUrl: CONFIG.apiBaseUrl,
  interceptors: [authInterceptor],
});

export const authRpc = createClient(AuthService, transport);
export const restaurantRpc = createClient(RestaurantService, transport);
export const menuRpc = createClient(MenuService, transport);
export const tableRpc = createClient(TableService, transport);
export const orderRpc = createClient(OrderService, transport);
export const inventoryRpc = createClient(InventoryService, transport);
export const adminRpc = createClient(AdminService, transport);
