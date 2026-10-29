import test from "node:test";
import assert from "node:assert/strict";
import { ApiTableRepository } from "../src/repositories/table-repository";

test("Restaurant Tables Management Live Repository & Domain Tests", async (t) => {
  const tableRepo = new ApiTableRepository();

  await t.test("Scenario 1: Loads real Cairo restaurant tables across sections from backend", async () => {
    const tables = await tableRepo.getTables();
    assert.ok(tables.length >= 4, "Should have tables in the database");

    const sections = new Set(tables.map((t) => t.section));
    assert.ok(sections.has("MAIN_HALL") || sections.has("TERRACE") || sections.has("VIP"));

    const table02 = tables.find((t) => t.tableNumber === 2 || t.name.includes("2"));
    assert.ok(table02, "Table 2 should exist");
  });

  await t.test("Scenario 2: Table statistics reflect accurate counts for overview cards", async () => {
    const stats = await tableRepo.getTableStats();
    assert.ok(stats.total >= 4);
    assert.equal(
      stats.total,
      stats.available + stats.occupied + stats.reserved + stats.cleaning + stats.outOfService
    );
  });

  await t.test("Scenario 3: Filters by status work accurately against backend", async () => {
    const allTables = await tableRepo.getTables();
    assert.ok(allTables.length > 0);

    const availableTables = await tableRepo.getTables({ status: "AVAILABLE" });
    availableTables.forEach((t) => assert.equal(t.status, "AVAILABLE"));
  });

  await t.test("Scenario 4: Search filters by table number or name", async () => {
    const byNum = await tableRepo.getTables({ query: "2" });
    assert.ok(byNum.length >= 1);
    assert.ok(byNum.some((t) => t.tableNumber === 2 || t.name.includes("2")));

    const byName = await tableRepo.getTables({ query: "طاولة" });
    assert.ok(byName.length >= 1);
  });

  await t.test("Scenario 5: SAFETY GUARD: Cannot close/release a table while an active order remains", async () => {
    const tables = await tableRepo.getTables();
    const tableWithOrder = tables.find((t) => t.currentOrderId) || tables[0];
    assert.ok(tableWithOrder.currentOrderId, "Must find a table with active order");

    await assert.rejects(
      async () => {
        await tableRepo.closeTableSession(tableWithOrder.id);
      },
      (err: Error) => {
        return err.message.includes("لا يمكن إنهاء الجلسة أو تحرير الطاولة لوجود طلب نشط");
      }
    );
  });

  await t.test("Scenario 6: Updating table status transitions status cleanly on available table", async () => {
    const tables = await tableRepo.getTables();
    const freeTable = tables.find((t) => !t.currentOrderId && t.status === "AVAILABLE") || tables[0];

    const updated = await tableRepo.updateTableStatus(freeTable.id, "CLEANING", "بانتظار التعقيم");
    assert.equal(updated.status, "CLEANING");

    // Restore to AVAILABLE
    const restored = await tableRepo.updateTableStatus(freeTable.id, "AVAILABLE");
    assert.equal(restored.status, "AVAILABLE");
  });

  await t.test("Scenario 7: Table reservation can be booked and cancelled on available table", async () => {
    const tables = await tableRepo.getTables();
    const freeTable = tables.find((t) => !t.currentOrderId && t.status === "AVAILABLE") || tables[0];

    const reserved = await tableRepo.reserveTable(freeTable.id, {
      guestName: "أحمد ممدوح",
      guestPhone: "01011223344",
      guestCount: 4,
      reservedTime: new Date(Date.now() + 3600000).toISOString(),
      notes: "طاولة عشاء عائلية",
    });

    assert.equal(reserved.status, "RESERVED");

    // Cancel reservation
    const cancelled = await tableRepo.cancelReservation(freeTable.id);
    assert.equal(cancelled.status, "AVAILABLE");
  });

  await t.test("Scenario 8: Real-time table detail retrieves matching active order with items snapshot", async () => {
    const { table, activeOrder } = await tableRepo.getTableWithActiveOrder("table-04");
    assert.ok(table);
    assert.ok(activeOrder, "Should retrieve active order for table 4");
    assert.equal(activeOrder?.tableName, "طاولة 4");
    assert.ok(activeOrder?.items.length > 0);
    assert.ok(activeOrder?.total > 0);
  });
});
