-- Migration 000005: Inventory Management Module (Items, Balances, Movements, Receipts, Recipes, Alerts)
-- Up Migration

-- 1. Inventory Items Table
CREATE TABLE IF NOT EXISTS inventory_items (
    id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    sku VARCHAR(64),
    name VARCHAR(255) NOT NULL,
    name_en VARCHAR(255),
    description TEXT,
    item_type VARCHAR(32) NOT NULL DEFAULT 'RAW_INGREDIENT', -- 'RAW_INGREDIENT' | 'FINISHED_GOOD'
    base_unit VARCHAR(32) NOT NULL DEFAULT 'KG',             -- 'KG', 'G', 'L', 'ML', 'PCS', 'PORTION'
    minimum_stock_quantity NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    cost_per_base_unit NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_restaurant_item_name UNIQUE(restaurant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_inventory_items_restaurant ON inventory_items(restaurant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_inventory_items_type ON inventory_items(restaurant_id, item_type);

-- 2. Inventory Balances Table (One balance record per item)
CREATE TABLE IF NOT EXISTS inventory_balances (
    inventory_item_id VARCHAR(64) PRIMARY KEY REFERENCES inventory_items(id) ON DELETE CASCADE,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    quantity_on_hand NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_balances_restaurant ON inventory_balances(restaurant_id);

-- 3. Immutable Movement Ledger Table
CREATE TABLE IF NOT EXISTS inventory_movements (
    id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    inventory_item_id VARCHAR(64) NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    movement_type VARCHAR(32) NOT NULL, -- 'PURCHASE_RECEIPT', 'ORDER_CONSUMPTION', 'MANUAL_CONSUMPTION', 'WASTE', 'STOCK_ADJUSTMENT', 'REVERSAL'
    quantity_delta NUMERIC(12, 4) NOT NULL,
    balance_before NUMERIC(12, 4) NOT NULL,
    balance_after NUMERIC(12, 4) NOT NULL,
    unit_cost NUMERIC(10, 4) NOT NULL DEFAULT 0.0000,
    total_cost NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    source_type VARCHAR(64) NOT NULL,   -- 'PURCHASE_RECEIPT', 'ORDER', 'MANUAL', 'STOCK_COUNT', 'WASTE_REPORT'
    source_id VARCHAR(64),
    idempotency_key VARCHAR(128),
    reason TEXT,
    actor_user_id VARCHAR(64),
    actor_name VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_movement_idempotency 
    ON inventory_movements(restaurant_id, idempotency_key) 
    WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_item ON inventory_movements(inventory_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_restaurant ON inventory_movements(restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON inventory_movements(restaurant_id, movement_type);

-- 4. Purchase Receipts & Line Items
CREATE TABLE IF NOT EXISTS purchase_receipts (
    id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    receipt_reference VARCHAR(64) NOT NULL,
    supplier_name VARCHAR(255),
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT', -- 'DRAFT' | 'CONFIRMED'
    total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_by VARCHAR(64) REFERENCES staff_users(id) ON DELETE SET NULL,
    confirmed_by VARCHAR(64) REFERENCES staff_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    CONSTRAINT uq_restaurant_receipt_ref UNIQUE(restaurant_id, receipt_reference)
);

CREATE INDEX IF NOT EXISTS idx_purchase_receipts_restaurant ON purchase_receipts(restaurant_id, status);

CREATE TABLE IF NOT EXISTS purchase_receipt_items (
    id VARCHAR(64) PRIMARY KEY,
    purchase_receipt_id VARCHAR(64) NOT NULL REFERENCES purchase_receipts(id) ON DELETE CASCADE,
    inventory_item_id VARCHAR(64) NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    purchase_quantity NUMERIC(12, 4) NOT NULL CHECK (purchase_quantity > 0),
    purchase_unit VARCHAR(32) NOT NULL,
    conversion_factor NUMERIC(12, 4) NOT NULL DEFAULT 1.0000 CHECK (conversion_factor > 0),
    base_quantity NUMERIC(12, 4) NOT NULL CHECK (base_quantity > 0),
    unit_cost NUMERIC(10, 4) NOT NULL DEFAULT 0.0000 CHECK (unit_cost >= 0),
    line_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (line_total >= 0)
);

CREATE INDEX IF NOT EXISTS idx_purchase_receipt_items_receipt ON purchase_receipt_items(purchase_receipt_id);

-- 5. Menu Item Recipes & Recipe Ingredients
CREATE TABLE IF NOT EXISTS menu_item_recipes (
    id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    menu_product_id VARCHAR(64) NOT NULL REFERENCES menu_products(id) ON DELETE CASCADE,
    version INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    instructions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_product_recipe UNIQUE(restaurant_id, menu_product_id)
);

CREATE INDEX IF NOT EXISTS idx_menu_recipes_restaurant ON menu_item_recipes(restaurant_id);

CREATE TABLE IF NOT EXISTS menu_item_recipe_ingredients (
    id VARCHAR(64) PRIMARY KEY,
    recipe_id VARCHAR(64) NOT NULL REFERENCES menu_item_recipes(id) ON DELETE CASCADE,
    inventory_item_id VARCHAR(64) NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    quantity_required NUMERIC(12, 4) NOT NULL CHECK (quantity_required > 0),
    unit VARCHAR(32) NOT NULL,
    applicable_option_id VARCHAR(64) REFERENCES product_options(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON menu_item_recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_item ON menu_item_recipe_ingredients(inventory_item_id);

-- 6. Inventory Alerts Table
CREATE TABLE IF NOT EXISTS inventory_alerts (
    id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    inventory_item_id VARCHAR(64) NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    alert_type VARCHAR(32) NOT NULL, -- 'LOW_STOCK', 'OUT_OF_STOCK', 'NEGATIVE_STOCK'
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'
    threshold_quantity NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    current_quantity NUMERIC(12, 4) NOT NULL DEFAULT 0.0000,
    message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by VARCHAR(64),
    resolved_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_item_alert 
    ON inventory_alerts(restaurant_id, inventory_item_id, alert_type) 
    WHERE status IN ('ACTIVE', 'ACKNOWLEDGED');

CREATE INDEX IF NOT EXISTS idx_inventory_alerts_restaurant ON inventory_alerts(restaurant_id, status);
