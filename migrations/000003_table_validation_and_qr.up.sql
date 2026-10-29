-- Migration 000003: Table Validation, QR Tokens & Global Uniqueness
-- Up Migration

-- 1. Add is_active column to dining_tables to support soft disabling of tables
ALTER TABLE dining_tables ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 2. Enforce global uniqueness on table tokens across all restaurants
CREATE UNIQUE INDEX IF NOT EXISTS uq_dining_tables_token_global ON dining_tables(token);

-- 3. High-performance composite index for table validation lookups by restaurant and table number
CREATE INDEX IF NOT EXISTS idx_dining_tables_restaurant_table_num ON dining_tables(restaurant_id, LOWER(table_number));
