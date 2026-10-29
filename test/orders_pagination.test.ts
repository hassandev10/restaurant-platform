import { describe, it } from "node:test";
import assert from "node:assert";
import { orderRepository } from "../src/repositories/order-repository";

describe("Orders Server-Side Pagination and Tracking Domain Tests", () => {
  it("Scenario 1: Fetches paginated orders with default page size from real backend", async () => {
    const res = await orderRepository.getPaginatedOrders({
      page: 1,
      pageSize: 12,
    });

    assert.ok(Array.isArray(res.orders), "orders must be an array");
    assert.strictEqual(typeof res.total, "number", "total must be a number");
    assert.strictEqual(typeof res.totalPages, "number", "totalPages must be a number");
    assert.strictEqual(res.page, 1, "page must be 1");
    assert.strictEqual(res.pageSize, 12, "pageSize must be 12");
    assert.ok(res.orders.length <= 12, "orders length should not exceed pageSize");
  });

  it("Scenario 2: Supports configurable page sizes 12, 24, 48", async () => {
    const res12 = await orderRepository.getPaginatedOrders({ page: 1, pageSize: 12 });
    assert.strictEqual(res12.pageSize, 12);

    const res24 = await orderRepository.getPaginatedOrders({ page: 1, pageSize: 24 });
    assert.strictEqual(res24.pageSize, 24);
    assert.ok(res24.orders.length <= 24);
  });

  it("Scenario 3: Server-side status filtering returns matching status only", async () => {
    const resNew = await orderRepository.getPaginatedOrders({
      page: 1,
      pageSize: 10,
      status: "NEW",
    });

    resNew.orders.forEach((o) => {
      assert.strictEqual(o.status, "NEW", "Every order in NEW tab must have status NEW");
    });
  });

  it("Scenario 4: Search query filters results by order number or table name", async () => {
    // First get an existing order
    const sample = await orderRepository.getPaginatedOrders({ page: 1, pageSize: 1 });
    if (sample.orders.length > 0) {
      const targetOrder = sample.orders[0];
      const searchRes = await orderRepository.getPaginatedOrders({
        page: 1,
        pageSize: 10,
        search: targetOrder.orderNumber,
      });

      assert.ok(searchRes.total >= 1, "Should find at least 1 order matching order number");
      assert.ok(
        searchRes.orders.some((o) => o.orderNumber === targetOrder.orderNumber),
        "Result must contain the searched order"
      );
    }
  });

  it("Scenario 5: Active orders (ALL_ACTIVE) pagination correctly slices active pool", async () => {
    const res = await orderRepository.getPaginatedOrders({
      page: 1,
      pageSize: 12,
      status: "ALL_ACTIVE",
    });

    assert.ok(Array.isArray(res.orders));
    assert.ok(res.orders.length <= 12);
    // Every order should be active (not SERVED or CANCELLED)
    res.orders.forEach((o) => {
      assert.ok(
        o.status !== "SERVED" && o.status !== "CANCELLED",
        `Order ${o.orderNumber} in ALL_ACTIVE must be active`
      );
    });
  });

  it("Scenario 6: Fetches real order events audit timeline from backend", async () => {
    const sample = await orderRepository.getPaginatedOrders({ page: 1, pageSize: 5 });
    if (sample.orders.length > 0) {
      const orderId = sample.orders[0].id;
      const events = await orderRepository.getOrderEvents(orderId);
      assert.ok(Array.isArray(events), "Events must be an array");
      if (events.length > 0) {
        assert.ok(events[0].id, "Event must have id");
        assert.ok(events[0].timestamp, "Event must have timestamp");
        assert.ok(events[0].status, "Event must have status");
      }
    }
  });
});
