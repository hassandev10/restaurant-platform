-- Migration 000006: Down
DROP INDEX IF EXISTS idx_orders_rest_order_number;
DROP INDEX IF EXISTS idx_orders_rest_updated_at;
DROP INDEX IF EXISTS idx_orders_rest_total;
