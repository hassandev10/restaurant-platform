-- Migration 000005: Inventory Management Module
-- Down Migration

DROP TABLE IF EXISTS inventory_alerts;
DROP TABLE IF EXISTS menu_item_recipe_ingredients;
DROP TABLE IF EXISTS menu_item_recipes;
DROP TABLE IF EXISTS purchase_receipt_items;
DROP TABLE IF EXISTS purchase_receipts;
DROP TABLE IF EXISTS inventory_movements;
DROP TABLE IF EXISTS inventory_balances;
DROP TABLE IF EXISTS inventory_items;
