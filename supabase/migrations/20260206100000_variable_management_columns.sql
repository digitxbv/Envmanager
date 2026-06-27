-- Migration: Variable Management — Columns on Existing Tables
-- PRDs: 04 (Version History), 06 (Fallback Values), 01 (Bulk Updates)

-- 1. Add columns to variables table
ALTER TABLE variables ADD COLUMN IF NOT EXISTS fallback_value TEXT;
ALTER TABLE variables ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Add columns to variable_audit_log table
ALTER TABLE variable_audit_log ADD COLUMN IF NOT EXISTS variable_key TEXT;
ALTER TABLE variable_audit_log ADD COLUMN IF NOT EXISTS change_reason TEXT;
ALTER TABLE variable_audit_log ADD COLUMN IF NOT EXISTS version_number INTEGER;
ALTER TABLE variable_audit_log ADD COLUMN IF NOT EXISTS batch_id UUID;
