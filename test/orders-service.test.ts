import test from "node:test";
import assert from "node:assert/strict";
import { OrdersService } from "../src/services/orders-service";
import { AnalyticsService } from "../src/services/analytics-service";
import { Order } from "../src/types/order";
import { RestaurantTable } from "../src/types/table";

test("Orders & Derived Analytics Tests (Real Go Backend Integration)", async (t) => {
  const ordersService = new OrdersService();
  const analyticsService = new AnalyticsService();

  await t.test("Fetch active and historical orders from Go backend", async () => {
    const all = await ordersService.getAllOrders();
    assert.ok(Array.isArray(all), "Orders must be an array");

    if (all.length > 0) {
      const order = all[0];
      assert.ok(order.id, "Order ID required");
      assert.ok(order.orderNumber, "Order number required");
      assert.ok(typeof order.total === "number", "Total must be number");
      assert.ok(
        ["NEW", "CONFIRMED", "PREPARING", "READY", "SERVED", "CANCELLED"].includes(order.status),
        `Status ${order.status} must be valid OrderStatus`
      );
    }
  });

  await t.test("Analytics deriveLiveMetrics calculates correct financial invariants", () => {
    const mockOrders: Order[] = [
      {
        id: "ord-1",
        orderNumber: "101",
        restaurantId: "rest-01",
        branchId: "branch-01",
        tableId: "tbl-1",
        tableName: "طاولة 1",
        status: "SERVED",
        paymentStatus: "PAID",
        subtotal: 200,
        total: 200,
        createdAt: "2026-10-27T12:00:00Z",
        updatedAt: "2026-10-27T12:30:00Z",
        items: [
          {
            id: "item-1",
            productId: "prod-1",
            productNameSnapshot: "شاورما دجاج",
            unitPriceSnapshot: 100,
            quantity: 2,
            lineTotal: 200,
          },
        ],
      },
      {
        id: "ord-2",
        orderNumber: "102",
        restaurantId: "rest-01",
        branchId: "branch-01",
        tableId: "tbl-2",
        tableName: "طاولة 2",
        status: "CANCELLED",
        paymentStatus: "CANCELLED",
        subtotal: 100,
        total: 100,
        createdAt: "2026-10-27T13:00:00Z",
        updatedAt: "2026-10-27T13:05:00Z",
        items: [],
      },
    ];

    const mockTables: RestaurantTable[] = [
      {
        id: "tbl-1",
        restaurantId: "rest-01",
        tableNumber: "T1",
        displayName: "طاولة 1",
        capacity: 4,
        token: "tok-1",
        status: "OCCUPIED",
        isActive: true,
        createdAt: "2026-10-27T10:00:00Z",
        updatedAt: "2026-10-27T10:00:00Z",
      },
      {
        id: "tbl-2",
        restaurantId: "rest-01",
        tableNumber: "T2",
        displayName: "طاولة 2",
        capacity: 4,
        token: "tok-2",
        status: "AVAILABLE",
        isActive: true,
        createdAt: "2026-10-27T10:00:00Z",
        updatedAt: "2026-10-27T10:00:00Z",
      },
    ];

    const metrics = analyticsService.deriveLiveMetrics(mockOrders, mockTables);
    assert.equal(metrics.totalSales, 200, "Total sales should only sum SERVED orders");
    assert.equal(metrics.completedOrdersCount, 1);
    assert.equal(metrics.cancelledOrdersCount, 1);
    assert.equal(metrics.averageOrderValue, 200);
    assert.equal(metrics.tableOccupancyRate, 50, "1 out of 2 tables occupied is 50%");
    assert.equal(metrics.topSellingItems.length, 1);
    assert.equal(metrics.topSellingItems[0].name, "شاورما دجاج");
    assert.equal(metrics.topSellingItems[0].quantity, 2);
  });
});
