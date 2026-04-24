-- Add Ollama-specific columns to logs table
-- Created: 2026-04-24

ALTER TABLE logs ADD COLUMN ollama_options TEXT;
ALTER TABLE logs ADD COLUMN ollama_keep_alive TEXT;
ALTER TABLE logs ADD COLUMN ollama_format TEXT;
