-- Migration 000003: Table Validation, QR Tokens & Global Uniqueness
-- Down Migration

DROP INDEX IF EXISTS idx_dining_tables_restaurant_table_num;
DROP INDEX IF EXISTS uq_dining_tables_token_global;
ALTER TABLE dining_tables DROP COLUMN IF EXISTS is_active;
