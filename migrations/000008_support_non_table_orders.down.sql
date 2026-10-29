-- 000008_support_non_table_orders.down.sql

DROP INDEX IF EXISTS idx_orders_rest_order_type;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_type_table_consistency;

ALTER TABLE orders ALTER COLUMN table_id SET NOT NULL;

ALTER TABLE orders ALTER COLUMN table_name SET NOT NULL;

ALTER TABLE orders DROP COLUMN IF EXISTS order_type;
