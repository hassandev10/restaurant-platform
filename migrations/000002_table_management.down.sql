-- 000002_table_management.down.sql

ALTER TABLE orders DROP COLUMN IF EXISTS session_id;
DROP TABLE IF EXISTS table_sessions;
ALTER TABLE dining_tables DROP CONSTRAINT IF EXISTS uq_restaurant_table_number;
ALTER TABLE dining_tables DROP COLUMN IF EXISTS updated_at;
ALTER TABLE dining_tables DROP COLUMN IF EXISTS section_id;
ALTER TABLE dining_tables DROP COLUMN IF EXISTS capacity;
ALTER TABLE dining_tables DROP COLUMN IF EXISTS display_name;
ALTER TABLE dining_tables DROP COLUMN IF EXISTS table_number;
DROP TABLE IF EXISTS table_sections;
