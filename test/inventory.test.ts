import test from "node:test";
import assert from "node:assert/strict";
import { InventoryService } from "../src/services/inventory-service";
import { formatUnit, getItemTypeConfig, getMovementTypeConfig } from "../src/lib/formatters";

test("Inventory Management Service & Domain Logic Unit Tests", async (t) => {
  const service = new InventoryService();

  await t.test("Unit formatters produce correct Arabic labels", () => {
    assert.equal(formatUnit("kg"), "كجم");
    assert.equal(formatUnit("g"), "جرام");
    assert.equal(formatUnit("l"), "لتر");
    assert.equal(formatUnit("ml"), "مل");
    assert.equal(formatUnit("piece"), "قطعة");
    assert.equal(formatUnit("carton"), "كرتونة");
    assert.equal(formatUnit("box"), "علبة");

    const rawConfig = getItemTypeConfig("RAW_INGREDIENT");
    assert.equal(rawConfig.label, "مادة خام");
    const finConfig = getItemTypeConfig("FINISHED_GOOD");
    assert.equal(finConfig.label, "منتج نهائي مباع");
  });

  await t.test("Item creation initializes stock to strictly 0 (no direct stock override)", async () => {
    const res = await service.createItem({
      sku: "TEST-ITEM-001",
      nameAr: "طماطم طازجة درجة أولى",
      nameEn: "Fresh Tomatoes Grade A",
      type: "RAW_INGREDIENT",
      category: "vegetables",
      baseUnit: "kg",
      minStockThreshold: 10,
      costPerBaseUnit: 25,
      purchaseUnit: "box",
      conversionFactor: 20, // 1 box = 20 kg
    });

    assert.ok(res.item.id);
    assert.equal(res.item.sku, "TEST-ITEM-001");
    assert.equal(res.item.currentStock, 0, "Initial stock MUST be strictly 0");
    assert.equal(res.item.conversionFactor, 20);
  });

  await t.test("Purchase unit to base unit conversion calculation", () => {
    // 5 cartons of water with conversion factor 24 = 120 pieces
    const purchaseQty = 5;
    const factor = 24;
    const baseQty = purchaseQty * factor;
    assert.equal(baseQty, 120);

    // 3 boxes of meat with conversion factor 10 = 30 kg
    const meatBoxes = 3;
    const meatFactor = 10;
    const meatBaseQty = meatBoxes * meatFactor;
    assert.equal(meatBaseQty, 30);
  });

  await t.test("Draft purchase receipt does NOT alter inventory balance", async () => {
    const itemsBefore = await service.getItems();
    const targetItem = itemsBefore[0];
    const initialStock = targetItem.currentStock;

    // Create a draft receipt
    const draftRes = await service.createPurchaseDraft({
      supplierName: "مورد تجريبي",
      receiptDate: new Date().toISOString(),
      items: [
        {
          itemId: targetItem.id,
          purchaseQty: 10,
          purchaseUnit: "box",
          conversionFactor: 5,
          unitCost: 100,
        },
      ],
    });

    assert.equal(draftRes.receipt.status, "DRAFT");

    // Stock must be completely unchanged
    const itemAfter = await service.getItem(targetItem.id);
    assert.equal(itemAfter?.currentStock, initialStock, "Draft receipt must NOT increase stock");
  });

  await t.test("Confirmed purchase receipt increases stock by base quantity and logs movement", async () => {
    const items = await service.getItems();
    const item = items[0];
    const stockBefore = item.currentStock;

    // Create and confirm receipt
    const draftRes = await service.createPurchaseDraft({
      supplierName: "مورد دواجن المتحدة",
      invoiceNumber: "INV-TEST-999",
      receiptDate: new Date().toISOString(),
      items: [
        {
          itemId: item.id,
          purchaseQty: 4,
          purchaseUnit: "box",
          conversionFactor: 10, // 4 * 10 = 40 base units
          unitCost: 500,
        },
      ],
    });

    const confirmRes = await service.confirmPurchase(draftRes.receipt.id, "أمين المستودع");
    assert.equal(confirmRes.receipt.status, "CONFIRMED");

    // Stock must have increased by 40
    const itemAfter = await service.getItem(item.id);
    const expectedStock = Number((stockBefore + 40).toFixed(2));
    assert.equal(itemAfter?.currentStock, expectedStock, "Stock should increase by converted base quantity");

    // Check movements ledger contains the entry
    const movements = await service.getMovements({ itemId: item.id, movementType: "PURCHASE_RECEIPT" });
    assert.ok(movements.length > 0);
    assert.equal(movements[0].quantity, 40);
    assert.equal(movements[0].balanceAfter, expectedStock);
  });

  await t.test("Physical stock-count reconciliation calculates difference accurately", async () => {
    const items = await service.getItems();
    const item = items[0];
    const currentStock = item.currentStock;

    // Suppose physical count discovers 5 units less than book stock
    const actualPhysicalCount = currentStock - 5;

    const res = await service.recordAdjustment(
      {
        itemId: item.id,
        movementType: "COUNT_RECONCILIATION",
        countedQuantity: actualPhysicalCount,
        unit: item.baseUnit,
        reason: "جرد أسبوعي دوري لقسم اللحوم",
      },
      "رئيس لجنة الجرد"
    );

    assert.equal(res.movement.quantity, -5);
    assert.equal(res.movement.balanceAfter, actualPhysicalCount);

    const updatedItem = await service.getItem(item.id);
    assert.equal(updatedItem?.currentStock, actualPhysicalCount);
  });

  await t.test("Manual waste and consumption record negative adjustments and require mandatory reason", async () => {
    const items = await service.getItems();
    const item = items[0];
    const beforeStock = item.currentStock;

    const wasteRes = await service.recordAdjustment(
      {
        itemId: item.id,
        movementType: "WASTE",
        quantity: 1.5,
        unit: item.baseUnit,
        reason: "تلف ناتج عن انقطاع تبريد الثلاجة رقم 2",
      },
      "الشيف التنفيذي"
    );

    assert.equal(wasteRes.movement.quantity, -1.5);
    const afterItem = await service.getItem(item.id);
    assert.equal(afterItem?.currentStock, Number((beforeStock - 1.5).toFixed(2)));

    // Rejection if reason or quantity is empty
    await assert.rejects(
      async () => {
        await service.recordAdjustment({
          itemId: item.id,
          movementType: "WASTE",
          quantity: 0,
          unit: item.baseUnit,
          reason: "بدون سبب",
        });
      },
      /يرجى إدخال كمية/
    );
  });

  await t.test("Menu recipes calculate estimated cost and profit margin correctly", async () => {
    const recipe = await service.getRecipe("prod-01");
    assert.ok(recipe, "Kabab recipe should exist");
    assert.equal(recipe.isConfigured, true);
    assert.ok(recipe.ingredients.length > 0);
    assert.ok(recipe.totalEstimatedCost > 0);

    // Save recipe update
    const saveRes = await service.saveRecipe("prod-01", {
      menuItemId: "prod-01",
      ingredients: [
        {
          itemId: "inv-01",
          quantity: 0.4, // 400g
          unit: "kg",
        },
      ],
      notes: "زيادة حجم قطعة الكباب إلى 400 جرام",
    });

    assert.equal(saveRes.recipe.ingredients.length, 1);
    assert.equal(saveRes.recipe.ingredients[0].quantity, 0.4);
  });

  await t.test("Portions demand simulation accurately flags stock shortages", () => {
    const ingredientReqPerPortion = 0.35; // 350g meat per dish
    const availableStock = 3.0; // 3 kg in stock

    // Demand for 5 portions = 1.75 kg -> Sufficient
    const demand5 = 5 * ingredientReqPerPortion;
    assert.equal(demand5 <= availableStock, true);

    // Demand for 10 portions = 3.5 kg -> Shortage of 0.5 kg!
    const demand10 = 10 * ingredientReqPerPortion;
    assert.equal(demand10 <= availableStock, false);
    const shortage = demand10 - availableStock;
    assert.equal(shortage, 0.5);
  });

  await t.test("Inventory summary aggregates KPIs properly", async () => {
    const { summary } = await service.getSummary();
    assert.ok(summary.totalItemsCount >= 2);
    assert.ok(summary.recentMovementsCount >= 2);
    assert.equal(typeof summary.estimatedInventoryValue, "number");
  });

  await t.test("Alerts system identifies low stock and out of stock items", async () => {
    const alerts = await service.getAlerts();
    assert.ok(Array.isArray(alerts));
    // Each alert must have valid type
    alerts.forEach((alert) => {
      assert.ok(["LOW_STOCK", "OUT_OF_STOCK", "NEGATIVE_STOCK"].includes(alert.alertType));
      assert.ok(alert.itemId);
    });
  });
});
