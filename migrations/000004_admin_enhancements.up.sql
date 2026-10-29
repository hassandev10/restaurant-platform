-- Migration 000004: Admin Client Enhancements (Settings, Promotions, Analytics Indexes)
-- Up Migration

-- 1. Extend restaurants table with business contact, hours, and tax settings
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS phone VARCHAR(64);
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS opening_hours TEXT;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS service_fee_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00;

-- 2. Promotions table
CREATE TABLE IF NOT EXISTS promotions (
    id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    code VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    discount_type VARCHAR(16) NOT NULL DEFAULT 'PERCENTAGE', -- 'PERCENTAGE' | 'FIXED'
    discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value >= 0),
    min_order_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (min_order_amount >= 0),
    max_discount_amount NUMERIC(10, 2),
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    usage_limit INT,
    times_used INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_restaurant_promo_code UNIQUE(restaurant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_promotions_restaurant ON promotions(restaurant_id, is_active);

-- 3. Composite indexes to optimize Admin analytics and order reporting
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_created_at ON orders(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_status_created ON orders(restaurant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_menu_products_restaurant_avail ON menu_products(restaurant_id, is_available);
CREATE INDEX IF NOT EXISTS idx_menu_categories_restaurant_order ON menu_categories(restaurant_id, display_order ASC);
