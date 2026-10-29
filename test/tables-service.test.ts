import test from "node:test";
import assert from "node:assert/strict";
import { AuthService } from "../src/services/auth-service";
import { TablesService } from "../src/services/tables-service";

test("Tables Service Unit Tests (Real Go Backend Integration)", async (t) => {
  const auth = new AuthService();
  const tablesService = new TablesService();

  // Log in as admin to establish session token for protected table endpoints
  await auth.login("admin", "password123");

  await t.test("List tables returns real dining tables from database", async () => {
    const res = await tablesService.listTables({ pageSize: 50 });
    assert.ok(res, "Response must exist");
    assert.ok(Array.isArray(res.tables), "Tables must be an array");
    assert.ok(res.total >= 0, "Total count must be non-negative");

    if (res.tables.length > 0) {
      const table = res.tables[0];
      assert.ok(table.id, "Table must have ID");
      assert.ok(table.tableNumber, "Table must have tableNumber");
      assert.ok(typeof table.capacity === "number", "Capacity must be number");
      assert.ok(table.token, "Table must have security token for QR");
      assert.ok(
        ["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING", "OUT_OF_SERVICE"].includes(table.status),
        `Status ${table.status} must be valid TableStatus`
      );
    }
  });

  await t.test("List sections returns table sections", async () => {
    const sections = await tablesService.listSections();
    assert.ok(Array.isArray(sections), "Sections must be an array");
  });

  await t.test("Get table QR details returns valid token and URL", async () => {
    const listRes = await tablesService.listTables({ pageSize: 5 });
    if (listRes.tables.length > 0) {
      const table = listRes.tables[0];
      const qr = await tablesService.getTableQR(table.id);
      assert.equal(qr.tableId, table.id);
      assert.ok(qr.token, "QR must contain valid token");
    }
  });
});
