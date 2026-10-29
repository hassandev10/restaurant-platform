-- 000002_table_management.up.sql

-- 1. Table Sections
CREATE TABLE IF NOT EXISTS table_sections (
    id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    branch_id VARCHAR(64) REFERENCES restaurant_branches(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_table_sections_restaurant ON table_sections(restaurant_id);

-- 2. Alter dining_tables to support full table management
ALTER TABLE dining_tables ADD COLUMN IF NOT EXISTS table_number VARCHAR(64);
ALTER TABLE dining_tables ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);
ALTER TABLE dining_tables ADD COLUMN IF NOT EXISTS capacity INT NOT NULL DEFAULT 4 CHECK (capacity > 0);
ALTER TABLE dining_tables ADD COLUMN IF NOT EXISTS section_id VARCHAR(64) REFERENCES table_sections(id) ON DELETE SET NULL;
ALTER TABLE dining_tables ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Populate existing tables with table_number and display_name
UPDATE dining_tables 
SET table_number = COALESCE(NULLIF(regexp_replace(name, '\D', '', 'g'), ''), id),
    display_name = name,
    status = CASE WHEN status = 'ACTIVE' THEN 'AVAILABLE' ELSE status END
WHERE table_number IS NULL;

ALTER TABLE dining_tables ALTER COLUMN table_number SET NOT NULL;

-- Enforce unique table number per restaurant
ALTER TABLE dining_tables DROP CONSTRAINT IF EXISTS uq_restaurant_table_number;
ALTER TABLE dining_tables ADD CONSTRAINT uq_restaurant_table_number UNIQUE(restaurant_id, table_number);

CREATE INDEX IF NOT EXISTS idx_dining_tables_section ON dining_tables(section_id);
CREATE INDEX IF NOT EXISTS idx_dining_tables_status ON dining_tables(restaurant_id, status);

-- 3. Table Sessions
CREATE TABLE IF NOT EXISTS table_sessions (
    id VARCHAR(64) PRIMARY KEY,
    restaurant_id VARCHAR(64) NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    branch_id VARCHAR(64) REFERENCES restaurant_branches(id) ON DELETE SET NULL,
    table_id VARCHAR(64) NOT NULL REFERENCES dining_tables(id) ON DELETE CASCADE,
    opened_by VARCHAR(64) REFERENCES staff_users(id) ON DELETE SET NULL,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN', -- 'OPEN' | 'CLOSED'
    notes TEXT
);

-- Partial unique index ensuring strictly ONE open session per table
CREATE UNIQUE INDEX IF NOT EXISTS uq_table_open_session ON table_sessions(table_id) WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS idx_table_sessions_restaurant ON table_sessions(restaurant_id, status);
CREATE INDEX IF NOT EXISTS idx_table_sessions_table ON table_sessions(table_id);

-- 4. Alter orders to associate with session
ALTER TABLE orders ADD COLUMN IF NOT EXISTS session_id VARCHAR(64) REFERENCES table_sessions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orders_session_id ON orders(session_id);

-- 5. Seed default sections for demo restaurant
INSERT INTO table_sections (id, restaurant_id, branch_id, name, display_order)
VALUES
('sec-main', 'rest-01', 'branch-01', 'الصالة الداخلية الرئيسية', 1),
('sec-terrace', 'rest-01', 'branch-01', 'التراس الخارجي المفتوح', 2),
('sec-vip', 'rest-01', 'branch-01', 'جناح الـ VIP العائلي', 3)
ON CONFLICT (id) DO NOTHING;

-- Map existing tables to sections
UPDATE dining_tables SET section_id = 'sec-main' WHERE id IN ('table-04', 'table-02') AND section_id IS NULL;
UPDATE dining_tables SET section_id = 'sec-terrace' WHERE id = 'table-07' AND section_id IS NULL;
UPDATE dining_tables SET section_id = 'sec-vip' WHERE id = 'table-12' AND section_id IS NULL;
