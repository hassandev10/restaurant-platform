import test from "node:test";
import assert from "node:assert/strict";
import { MenuService } from "../src/services/menu-service";

test("Menu Service & Contracts Unit Tests (Real Go Backend Integration)", async (t) => {
  const menuService = new MenuService();

  await t.test("Fetch menu returns real restaurant, categories, and products", async () => {
    const menu = await menuService.getMenu();
    assert.ok(menu.restaurant, "Restaurant object must be present");
    assert.ok(Array.isArray(menu.categories), "Categories must be array");
    assert.ok(Array.isArray(menu.products), "Products must be array");

    if (menu.products.length > 0) {
      const prod = menu.products[0];
      assert.ok(prod.id, "Product must have ID");
      assert.ok(prod.nameAr, "Product must have Arabic name");
      assert.ok(typeof prod.price === "number", "Price must be number");
      assert.ok(typeof prod.isAvailable === "boolean", "Availability must be boolean");
    }
  });

  await t.test("Fetch categories returns valid category list", async () => {
    const categories = await menuService.getCategories();
    assert.ok(Array.isArray(categories));
    if (categories.length > 0) {
      assert.ok(categories[0].nameAr, "Category must have nameAr");
    }
  });

  await t.test("Typed createProduct contract marks isContractLive correctly", async () => {
    const res = await menuService.createProduct({
      categoryId: "cat-01",
      nameAr: "صنف تجريبي اختباري",
      price: 150,
      description: "وصف اختباري",
      isAvailable: true,
    });

    assert.ok(res.success, "Mutation must return success");
    assert.equal(typeof res.isContractLive, "boolean", "Contract flag must be boolean");
    assert.equal(res.product.nameAr, "صنف تجريبي اختباري");
  });
});
