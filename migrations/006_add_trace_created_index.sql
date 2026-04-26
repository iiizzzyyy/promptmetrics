-- Add created_at index on traces table for pagination performance
-- Created: 2026-04-26

CREATE INDEX IF NOT EXISTS idx_traces_created ON traces(created_at);
