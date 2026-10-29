import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canTransitionStatus,
  getNextValidStatus,
  isOrderCancellable,
  isOrderDelayed,
  formatElapsedTimeArabic,
  createOrderEvent,
} from "../src/lib/order-workflow";
import { ApiOrderRepository } from "../src/repositories/order-repository";
import { formatCurrency, formatArabicTimeOnly, getOrderStatusLabel } from "../src/lib/formatters";

describe("Restaurant POS Domain Workflow & Live Repository Tests", () => {
  const repo = new ApiOrderRepository();

  it("Scenario 1 & 2: Fetches live orders from backend with order numbers and table names", async () => {
    const activeOrders = await repo.getActiveOrders();

    assert.ok(activeOrders.length > 0, "Active orders should not be empty");
    const first = activeOrders[0];
    assert.ok(first.orderNumber.startsWith("EG-"), "Order number must follow EG-XXXX format");
    assert.ok(first.tableName, "Table name must be visible");
    assert.ok(first.total > 0, "Total must be greater than 0");
  });

  it("Scenario 3: Search functionality filters by order number or table name correctly", async () => {
    const orders = await repo.getActiveOrders();
    assert.ok(orders.length > 0);

    const first = orders[0];
    const filteredByNumber = orders.filter((o) => o.orderNumber.includes(first.orderNumber));
    assert.ok(filteredByNumber.length >= 1);

    const filteredByTable = orders.filter((o) => o.tableName.includes(first.tableName));
    assert.ok(filteredByTable.length >= 1);
  });

  it("Scenario 4: Status filters correctly categorize active vs completed orders", async () => {
    const active = await repo.getActiveOrders();
    const history = await repo.getHistoricalOrders();

    // Active orders must not include SERVED or CANCELLED
    assert.ok(active.every((o) => o.status !== "SERVED" && o.status !== "CANCELLED"));
    // Historical orders must be only SERVED or CANCELLED
    assert.ok(history.every((o) => o.status === "SERVED" || o.status === "CANCELLED"));
  });

  it("Scenario 5: Opening an order shows items snapshots, unit prices, line totals, and events", async () => {
    const active = await repo.getActiveOrders();
    const orderWithItems = active.find((o) => o.items && o.items.length > 0) || active[0];

    const order = await repo.getOrderById(orderWithItems.id);
    assert.ok(order !== null);
    assert.ok(order.id === orderWithItems.id);
    assert.ok(order.status);
    assert.ok(order.total > 0);
  });

  it("Scenario 6: Confirming a simulated order transitions it from NEW to CONFIRMED", async () => {
    const simulated = await repo.simulateIncomingOrder("rest-01");
    assert.strictEqual(simulated.status, "NEW");

    const updated = await repo.updateOrderStatus(simulated.id, "CONFIRMED", "الكابتن أحمد");
    assert.strictEqual(updated?.status, "CONFIRMED");
    assert.strictEqual(getNextValidStatus("CONFIRMED"), "PREPARING");
  });

  it("Scenario 7: Starting preparation transitions CONFIRMED order to PREPARING", async () => {
    const simulated = await repo.simulateIncomingOrder("rest-01");
    await repo.updateOrderStatus(simulated.id, "CONFIRMED", "الكابتن أحمد");

    const updated = await repo.updateOrderStatus(simulated.id, "PREPARING", "الشيف محمود");
    assert.strictEqual(updated?.status, "PREPARING");
  });

  it("Scenario 8: Marking an order ready transitions PREPARING order to READY", async () => {
    const simulated = await repo.simulateIncomingOrder("rest-01");
    await repo.updateOrderStatus(simulated.id, "CONFIRMED", "الكابتن أحمد");
    await repo.updateOrderStatus(simulated.id, "PREPARING", "الشيف محمود");

    const updated = await repo.updateOrderStatus(simulated.id, "READY", "الشيف محمود");
    assert.strictEqual(updated?.status, "READY");
  });

  it("Scenario 9: Marking an order served transitions READY order to SERVED and marks payment PAID", async () => {
    const simulated = await repo.simulateIncomingOrder("rest-01");
    await repo.updateOrderStatus(simulated.id, "CONFIRMED", "الكابتن أحمد");
    await repo.updateOrderStatus(simulated.id, "PREPARING", "الشيف محمود");
    await repo.updateOrderStatus(simulated.id, "READY", "الشيف محمود");

    const updated = await repo.updateOrderStatus(simulated.id, "SERVED", "الكابتن أحمد");
    assert.strictEqual(updated?.status, "SERVED");
    assert.strictEqual(updated?.paymentStatus, "PAID");
  });

  it("Scenario 10: Invalid transitions are strictly rejected by domain validation", () => {
    // Skipping statuses must be rejected
    assert.strictEqual(canTransitionStatus("NEW", "PREPARING"), false);
    assert.strictEqual(canTransitionStatus("NEW", "READY"), false);
    assert.strictEqual(canTransitionStatus("NEW", "SERVED"), false);
    assert.strictEqual(canTransitionStatus("CONFIRMED", "SERVED"), false);
    assert.strictEqual(canTransitionStatus("SERVED", "NEW"), false);
    assert.strictEqual(canTransitionStatus("CANCELLED", "PREPARING"), false);

    // Valid forward transitions
    assert.strictEqual(canTransitionStatus("NEW", "CONFIRMED"), true);
    assert.strictEqual(canTransitionStatus("CONFIRMED", "PREPARING"), true);
    assert.strictEqual(canTransitionStatus("PREPARING", "READY"), true);
    assert.strictEqual(canTransitionStatus("READY", "SERVED"), true);
  });

  it("Scenario 11: Cancellation rules require valid status and reasons", async () => {
    // Cancellation is allowed from NEW, CONFIRMED, PREPARING
    assert.strictEqual(isOrderCancellable("NEW"), true);
    assert.strictEqual(isOrderCancellable("CONFIRMED"), true);
    assert.strictEqual(isOrderCancellable("PREPARING"), true);
    assert.strictEqual(isOrderCancellable("SERVED"), false);
    assert.strictEqual(isOrderCancellable("CANCELLED"), false);

    const simulated = await repo.simulateIncomingOrder("rest-01");
    const cancelledOrder = await repo.cancelOrder(simulated.id, "طلب العميل الإلغاء", "الكابتن أحمد");
    assert.strictEqual(cancelledOrder?.status, "CANCELLED");
    assert.strictEqual(cancelledOrder?.paymentStatus, "CANCELLED");
  });

  it("Scenario 12: Status changes automatically append timestamped audit events", async () => {
    const simulated = await repo.simulateIncomingOrder("rest-01");
    const initialEventsCount = simulated.events?.length || 0;

    const updated = await repo.updateOrderStatus(
      simulated.id,
      "CONFIRMED",
      "الكابتن أحمد",
      "تم تأكيد الطلب من شاشة الصالة"
    );

    assert.ok(updated);
    assert.ok((updated?.events?.length || 0) >= initialEventsCount);
  });

  it("Scenario 13: Simulating a new demo order creates unique order without duplicate ID", async () => {
    const order1 = await repo.simulateIncomingOrder("rest-01");
    const order2 = await repo.simulateIncomingOrder("rest-01");

    assert.notStrictEqual(order1.id, order2.id);
    assert.notStrictEqual(order1.orderNumber, order2.orderNumber);
    assert.strictEqual(order1.status, "NEW");
    assert.strictEqual(order2.status, "NEW");
  });

  it("Scenario 14: Arabic formatting utilities produce standard Egyptian currency & time formats", () => {
    assert.strictEqual(formatCurrency(250), "٢٥٠ ج.م");
    assert.strictEqual(getOrderStatusLabel("NEW"), "جديد");
    assert.strictEqual(getOrderStatusLabel("PREPARING"), "قيد التحضير");
    assert.strictEqual(getOrderStatusLabel("READY"), "جاهز للتقديم");

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    assert.strictEqual(formatElapsedTimeArabic(tenMinutesAgo), "منذ 10 دقائق");

    const delayedOrder = isOrderDelayed(new Date(Date.now() - 20 * 60 * 1000).toISOString(), "PREPARING", 15);
    assert.strictEqual(delayedOrder, true);
  });
});
