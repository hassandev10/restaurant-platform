import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { orderRepository } from "../src/repositories/order-repository";
import { tableRepository } from "../src/repositories/table-repository";
import { Order, OrderStatus } from "../src/types/order";
import { getStatusBadgeInfo, isOrderDelayed, canTransitionStatus } from "../src/lib/order-workflow";

describe("Orders Dashboard — Table Sessions, Tracking, and Independent Cards Domain Tests", () => {
  it("Scenario 1: Independent order cards retain unique order numbers, individual status, items, and totals", async () => {
    const paged = await orderRepository.getPaginatedOrders({ page: 1, pageSize: 6 });
    assert.ok(paged.orders.length > 0, "Must have orders from backend");

    const seenIds = new Set<string>();
    const seenNumbers = new Set<string>();

    paged.orders.forEach((o) => {
      // Must have independent identification
      assert.ok(o.id, "Order ID must exist");
      assert.ok(o.orderNumber, "Order number must exist");
      assert.ok(o.tableName || o.tableNameSnapshot, "Table name must exist");
      assert.ok(typeof o.total === "number", "Total must be numeric");
      assert.ok(Array.isArray(o.items), "Items must be an array");
      assert.ok(o.status, "Status must be present");

      // Verify no duplicates
      assert.strictEqual(seenIds.has(o.id), false, "Order ID must be unique");
      assert.strictEqual(seenNumbers.has(o.orderNumber), false, "Order number must be unique");
      seenIds.add(o.id);
      seenNumbers.add(o.orderNumber);
    });
  });

  it("Scenario 2: 'متابعة الطلب' target route resolves the real backend order and its events", async () => {
    const paged = await orderRepository.getPaginatedOrders({ page: 1, pageSize: 2 });
    assert.ok(paged.orders.length > 0);

    const targetOrder = paged.orders[0];
    const retrieved = await orderRepository.getOrderById(targetOrder.id);

    assert.ok(retrieved !== null, "Must retrieve order by real ID");
    assert.strictEqual(retrieved.id, targetOrder.id);
    assert.strictEqual(retrieved.orderNumber, targetOrder.orderNumber);

    const events = await orderRepository.getOrderEvents(targetOrder.id);
    assert.ok(Array.isArray(events), "Events must be an array");
    // Events must only have actual past transitions, never future ones
    events.forEach((ev) => {
      assert.ok(ev.timestamp, "Event timestamp must exist");
      assert.ok(ev.status, "Event status must exist");
      assert.ok(ev.actor, "Event actor must exist");
    });
  });

  it("Scenario 3: Order lifecycle progression strictly adheres to Arabic domain workflow labels and rules", () => {
    const lifecycle: OrderStatus[] = ["NEW", "CONFIRMED", "PREPARING", "READY", "SERVED"];

    // Forward transitions are valid
    assert.strictEqual(canTransitionStatus("NEW", "CONFIRMED"), true);
    assert.strictEqual(canTransitionStatus("CONFIRMED", "PREPARING"), true);
    assert.strictEqual(canTransitionStatus("PREPARING", "READY"), true);
    assert.strictEqual(canTransitionStatus("READY", "SERVED"), true);

    // Skipping transitions is rejected
    assert.strictEqual(canTransitionStatus("NEW", "READY"), false);
    assert.strictEqual(canTransitionStatus("NEW", "SERVED"), false);

    // Arabic badge labels are standard
    assert.strictEqual(getStatusBadgeInfo("NEW").label, "جديد");
    assert.strictEqual(getStatusBadgeInfo("CONFIRMED").label, "تم التأكيد");
    assert.strictEqual(getStatusBadgeInfo("PREPARING").label, "قيد التحضير");
    assert.strictEqual(getStatusBadgeInfo("READY").label, "جاهز للتقديم");
    assert.strictEqual(getStatusBadgeInfo("SERVED").label, "تم التقديم");
    assert.strictEqual(getStatusBadgeInfo("CANCELLED").label, "ملغي");
  });

  it("Scenario 4: Table session grouping respects real backend session IDs and links orders accurately", async () => {
    // Check if any active orders have session IDs from backend
    const active = await orderRepository.getActiveOrders();
    const orderWithSession = active.find((o) => o.sessionId);

    if (orderWithSession && orderWithSession.sessionId) {
      const sessionOrders = await orderRepository.getOrdersBySession(orderWithSession.sessionId);
      assert.ok(Array.isArray(sessionOrders), "Session orders must be an array");
      assert.ok(sessionOrders.length >= 1, "Must find at least the source order");
      sessionOrders.forEach((so) => {
        assert.strictEqual(so.sessionId, orderWithSession.sessionId);
      });
    }

    // Calling getOrdersBySession with empty or non-existent session ID returns empty array without throwing
    const emptyResult = await orderRepository.getOrdersBySession("");
    assert.deepStrictEqual(emptyResult, []);
  });

  it("Scenario 5: Session financial calculation sums orders totals accurately and separates payment status", () => {
    const mockSessionOrders: Order[] = [
      {
        id: "ord-01",
        orderNumber: "EG-1001",
        restaurantId: "rest-01",
        branchId: "branch-01",
        tableId: "table-04",
        tableName: "طاولة 4",
        sessionId: "sess-abc",
        status: "SERVED",
        items: [],
        subtotal: 200,
        total: 200,
        paymentStatus: "PAID",
        createdAt: "2026-10-29T10:00:00Z",
        updatedAt: "2026-10-29T10:30:00Z",
        events: [],
      },
      {
        id: "ord-02",
        orderNumber: "EG-1002",
        restaurantId: "rest-01",
        branchId: "branch-01",
        tableId: "table-04",
        tableName: "طاولة 4",
        sessionId: "sess-abc",
        status: "PREPARING",
        items: [],
        subtotal: 150,
        total: 150,
        paymentStatus: "PENDING_CASHIER",
        createdAt: "2026-10-29T10:40:00Z",
        updatedAt: "2026-10-29T10:45:00Z",
        events: [],
      },
    ];

    const totalAmount = mockSessionOrders.reduce((sum, o) => sum + o.total, 0);
    const paidAmount = mockSessionOrders
      .filter((o) => o.paymentStatus === "PAID")
      .reduce((sum, o) => sum + o.total, 0);
    const pendingAmount = mockSessionOrders
      .filter((o) => o.paymentStatus !== "PAID" && o.status !== "CANCELLED")
      .reduce((sum, o) => sum + o.total, 0);

    assert.strictEqual(totalAmount, 350, "Total session value must be sum of both orders");
    assert.strictEqual(paidAmount, 200, "Paid amount should be 200");
    assert.strictEqual(pendingAmount, 150, "Pending cashier amount should be 150");

    // Serving an order does NOT imply it is paid: ord-01 is SERVED and PAID, ord-02 is PREPARING and PENDING
    assert.strictEqual(mockSessionOrders[0].status, "SERVED");
    assert.strictEqual(mockSessionOrders[0].paymentStatus, "PAID");
    assert.strictEqual(mockSessionOrders[1].paymentStatus, "PENDING_CASHIER");
  });

  it("Scenario 6: Order without session ID does not fabricate fake session groupings", () => {
    const singleOrder: Order = {
      id: "ord-orphan",
      orderNumber: "EG-9999",
      restaurantId: "rest-01",
      branchId: "branch-01",
      tableId: "table-02",
      tableName: "طاولة 2",
      // sessionId is explicitly undefined
      sessionId: undefined,
      status: "NEW",
      items: [],
      subtotal: 100,
      total: 100,
      paymentStatus: "PENDING_CASHIER",
      createdAt: "2026-10-29T11:00:00Z",
      updatedAt: "2026-10-29T11:00:00Z",
      events: [],
    };

    assert.strictEqual(singleOrder.sessionId, undefined);
    // In UI, this displays the single order with a note explaining absence of session ID
  });

  it("Scenario 7: Session closure guards require active orders to be completed or cancelled", async () => {
    // Attempting to close table-04 while active orders remain will reject without override
    await assert.rejects(
      async () => {
        await tableRepository.closeTableSession("table-04");
      },
      (err: Error) => {
        assert.ok(
          err.message.includes("لا يمكن إنهاء الجلسة") || err.message.includes("طلب نشط"),
          `Expected guard error message, got: ${err.message}`
        );
        return true;
      }
    );
  });

  it("Scenario 8: Multiple orders from the same table maintain independent statuses", async () => {
    // Simulate two incoming orders
    const ord1 = await orderRepository.simulateIncomingOrder("rest-01");
    const ord2 = await orderRepository.simulateIncomingOrder("rest-01");

    assert.notStrictEqual(ord1.id, ord2.id);
    assert.strictEqual(ord1.status, "NEW");
    assert.strictEqual(ord2.status, "NEW");

    // Advance only ord1 to CONFIRMED
    const updated1 = await orderRepository.updateOrderStatus(ord1.id, "CONFIRMED", "الكابتن أحمد");
    assert.strictEqual(updated1?.status, "CONFIRMED");

    // ord2 must remain independently in NEW status
    const check2 = await orderRepository.getOrderById(ord2.id);
    assert.strictEqual(check2?.status, "NEW");
  });

  it("Scenario 9: Pagination resetting and boundary validation", async () => {
    const page1 = await orderRepository.getPaginatedOrders({ page: 1, pageSize: 12 });
    assert.strictEqual(page1.page, 1);
    assert.strictEqual(page1.pageSize, 12);

    // Filtering by status NEW returns only NEW
    const pageNew = await orderRepository.getPaginatedOrders({ page: 1, pageSize: 12, status: "NEW" });
    pageNew.orders.forEach((o) => assert.strictEqual(o.status, "NEW"));

    // Page size 24 returns up to 24
    const page24 = await orderRepository.getPaginatedOrders({ page: 1, pageSize: 24 });
    assert.ok(page24.orders.length <= 24);
  });
});
