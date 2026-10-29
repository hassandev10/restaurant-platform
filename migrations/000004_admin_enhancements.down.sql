-- Migration 000004: Admin Client Enhancements (Settings, Promotions, Analytics Indexes)
-- Down Migration

DROP INDEX IF EXISTS idx_menu_categories_restaurant_order;
DROP INDEX IF EXISTS idx_menu_products_restaurant_avail;
DROP INDEX IF EXISTS idx_orders_restaurant_status_created;
DROP INDEX IF EXISTS idx_orders_restaurant_created_at;

DROP TABLE IF EXISTS promotions;

ALTER TABLE restaurants DROP COLUMN IF EXISTS service_fee_rate;
ALTER TABLE restaurants DROP COLUMN IF EXISTS tax_rate;
ALTER TABLE restaurants DROP COLUMN IF EXISTS opening_hours;
ALTER TABLE restaurants DROP COLUMN IF EXISTS address;
ALTER TABLE restaurants DROP COLUMN IF EXISTS phone;
