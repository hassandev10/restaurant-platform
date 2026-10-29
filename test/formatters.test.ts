import test from "node:test";
import assert from "node:assert/strict";
import {
  formatCurrency,
  formatArabicDateTime,
  getOrderStatusConfig,
  getTableStatusConfig,
} from "../src/lib/formatters";

test("Formatters and Status Configs Unit Tests", async (t) => {
  await t.test("formatCurrency formats correctly with EGP", () => {
    const formatted = formatCurrency(250.5);
    assert.ok(formatted.includes("ج.م"), `Expected Egyptian currency suffix, got: ${formatted}`);
  });

  await t.test("formatArabicDateTime formats ISO date to valid string", () => {
    const formatted = formatArabicDateTime("2026-10-27T14:30:00Z");
    assert.ok(formatted.length > 5);
  });

  await t.test("getOrderStatusConfig covers all known order statuses", () => {
    const statuses = ["NEW", "CONFIRMED", "PREPARING", "READY", "SERVED", "CANCELLED"] as const;
    for (const status of statuses) {
      const config = getOrderStatusConfig(status);
      assert.ok(config.label, `Label for ${status} required`);
      assert.ok(config.bgClass, `bgClass for ${status} required`);
      assert.ok(config.textClass, `textClass for ${status} required`);
    }
  });

  await t.test("getTableStatusConfig covers all known table statuses", () => {
    const statuses = ["AVAILABLE", "OCCUPIED", "RESERVED", "CLEANING", "OUT_OF_SERVICE"] as const;
    for (const status of statuses) {
      const config = getTableStatusConfig(status);
      assert.ok(config.label, `Label for ${status} required`);
      assert.ok(config.bgClass, `bgClass for ${status} required`);
    }
  });
});
