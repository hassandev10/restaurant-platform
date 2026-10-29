import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { restaurantRepository } from "../src/repositories/restaurant-repository";
import { menuRepository } from "../src/repositories/menu-repository";
import { orderRepository } from "../src/repositories/order-repository";

describe("Customer Direct Entry & Ordering Integration Tests", () => {
  const CLIENT_BASE_URL = "http://localhost:3000";

  it("1. Root URL (/) opens restaurant menu directly without QR gate", async () => {
    const res = await fetch(`${CLIENT_BASE_URL}/`, { cache: "no-store" });
    assert.equal(res.status, 200, "Root URL should return HTTP 200");

    const html = await res.text();
    assert.ok(html.includes("الزيتونة"), "HTML must contain restaurant name (الزيتونة)");
    assert.ok(html.includes("المشويات") || html.includes("طواجن"), "HTML must contain menu categories");
    assert.ok(!html.includes("وجّه كاميرا موبايلك"), "HTML must not contain mandatory QR camera instructions");
  });

  it("2. Direct restaurant URL (/r/demo-restaurant) opens menu directly", async () => {
    const res = await fetch(`${CLIENT_BASE_URL}/r/demo-restaurant`, { cache: "no-store" });
    assert.equal(res.status, 200, "Restaurant direct URL should return HTTP 200");

    const html = await res.text();
    assert.ok(html.includes("الزيتونة"), "HTML must contain restaurant name");
    assert.ok(!html.includes("وجّه كاميرا موبايلك"), "HTML must not contain mandatory QR camera instructions");
  });

  it("3. Direct cart URL (/r/demo-restaurant/cart) opens cart without error", async () => {
    const res = await fetch(`${CLIENT_BASE_URL}/r/demo-restaurant/cart`, { cache: "no-store" });
    assert.equal(res.status, 200, "Cart URL should return HTTP 200");

    const html = await res.text();
    assert.ok(html.includes("سلة الطلبات"), "HTML must contain cart title (سلة الطلبات)");
  });

  it("4. Table route (/r/demo-restaurant/table) redirects cleanly to direct menu", async () => {
    const res = await fetch(`${CLIENT_BASE_URL}/r/demo-restaurant/table`, {
      redirect: "manual",
    });
    assert.equal(res.status, 307, "Old table route should redirect (HTTP 307)");
    assert.equal(res.headers.get("location"), "/r/demo-restaurant");
  });

  it("5. Existing table QR URL (/r/demo-restaurant/t/demo-table-token) preserves table context", async () => {
    const res = await fetch(`${CLIENT_BASE_URL}/r/demo-restaurant/t/demo-table-token`, { cache: "no-store" });
    assert.equal(res.status, 200, "Table QR URL should return HTTP 200");

    const html = await res.text();
    assert.ok(html.includes("طاولة 4"), "HTML must contain table name (طاولة 4)");
  });

  it("6. Table validation: validates real tables and rejects fake or missing tables", async () => {
    // Valid table
    const validResult = await restaurantRepository.validateTable("demo-restaurant", "4");
    assert.equal(validResult.valid, true, "Table 4 should be valid");
    if (validResult.valid) {
      assert.ok(validResult.table.name.includes("4"));
      assert.ok(validResult.token);
    }

    // Invalid table number
    const invalidResult = await restaurantRepository.validateTable("demo-restaurant", "999");
    assert.equal(invalidResult.valid, false, "Table 999 should be rejected");

    // Empty input
    const emptyResult = await restaurantRepository.validateTable("demo-restaurant", "   ");
    assert.equal(emptyResult.valid, false, "Empty input should be rejected");
  });

  it("7. Repository integration: Categories and products load without table context", async () => {
    const categories = await menuRepository.getCategories("demo-restaurant");
    assert.ok(categories.length > 0, "Categories must be loaded");

    const products = await menuRepository.getProducts("demo-restaurant");
    assert.ok(products.length > 0, "Products must be loaded");

    const grillProduct = products.find((p) => p.nameAr.includes("مشكل") || p.nameAr.includes("كباب"));
    assert.ok(grillProduct, "Must find sample menu item");
    assert.ok(grillProduct.price > 0, "Price must be positive");
  });
});
