-- 000007_table_sessions_enhancements.up.sql

-- 1. Add closed_by column to table_sessions to track staff who closed the session
ALTER TABLE table_sessions ADD COLUMN IF NOT EXISTS closed_by VARCHAR(64) REFERENCES staff_users(id) ON DELETE SET NULL;

-- 2. Performance indexes for session lookups and orders per session
CREATE INDEX IF NOT EXISTS idx_table_sessions_lookup ON table_sessions(table_id, status);
CREATE INDEX IF NOT EXISTS idx_table_sessions_opened_at ON table_sessions(restaurant_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_session_created ON orders(session_id, created_at DESC);
