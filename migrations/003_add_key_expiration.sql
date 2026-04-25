-- Add API key expiration support
-- Created: 2026-04-25

ALTER TABLE api_keys ADD COLUMN expires_at INTEGER;
