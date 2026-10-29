import { createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";

import { RestaurantService } from "@/gen/restaurant/v1/restaurant_pb";
import { MenuService } from "@/gen/restaurant/v1/menu_pb";
import { TableService } from "@/gen/restaurant/v1/table_pb";
import { OrderService } from "@/gen/restaurant/v1/order_pb";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

export const transport = createConnectTransport({
  baseUrl,
});

export const restaurantRpc = createClient(RestaurantService, transport);
export const menuRpc = createClient(MenuService, transport);
export const tableRpc = createClient(TableService, transport);
export const orderRpc = createClient(OrderService, transport);
