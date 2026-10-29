-- Migration 000006: Indexes for Order Pagination, Sorting, and Search
CREATE INDEX IF NOT EXISTS idx_orders_rest_order_number ON orders(restaurant_id, order_number);
CREATE INDEX IF NOT EXISTS idx_orders_rest_updated_at ON orders(restaurant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_rest_total ON orders(restaurant_id, total DESC);
