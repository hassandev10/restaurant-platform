-- 000008_support_non_table_orders.up.sql

-- 1. Add order_type column to orders table with default 'DINE_IN'
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_type VARCHAR(32) NOT NULL DEFAULT 'DINE_IN';

-- 2. Allow table_id to be NULL for non-table orders (such as TAKEAWAY)
ALTER TABLE orders ALTER COLUMN table_id DROP NOT NULL;

-- 3. Allow table_name to be NULL or default to 'طلب سفري' for non-table orders
ALTER TABLE orders ALTER COLUMN table_name DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN table_name SET DEFAULT 'طلب سفري';

-- 4. Enforce consistency constraint:
-- DINE_IN orders must have a non-null table_id.
-- TAKEAWAY orders must NOT have a table_id or session_id.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_orders_type_table_consistency'
    ) THEN
        ALTER TABLE orders ADD CONSTRAINT chk_orders_type_table_consistency
        CHECK (
            (order_type = 'DINE_IN' AND table_id IS NOT NULL)
            OR
            (order_type = 'TAKEAWAY' AND table_id IS NULL AND session_id IS NULL)
        );
    END IF;
END $$;

-- 5. Performance index on order_type
CREATE INDEX IF NOT EXISTS idx_orders_rest_order_type ON orders(restaurant_id, order_type);
