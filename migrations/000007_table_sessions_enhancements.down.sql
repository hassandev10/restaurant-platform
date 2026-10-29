-- 000007_table_sessions_enhancements.down.sql

DROP INDEX IF EXISTS idx_orders_session_created;
DROP INDEX IF EXISTS idx_table_sessions_opened_at;
DROP INDEX IF EXISTS idx_table_sessions_lookup;
ALTER TABLE table_sessions DROP COLUMN IF EXISTS closed_by;
