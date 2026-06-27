-- Add tags column to variables table for filtering/scoping
ALTER TABLE variables ADD COLUMN tags text[] NOT NULL DEFAULT '{}';
CREATE INDEX idx_variables_tags ON variables USING GIN (tags);
