-- Add version column for optimistic locking
ALTER TABLE variables ADD COLUMN version INTEGER NOT NULL DEFAULT 1;

-- Add updated_by to track who made the last change
ALTER TABLE variables ADD COLUMN updated_by UUID REFERENCES auth.users(id);

-- Trigger to auto-increment version on update
CREATE OR REPLACE FUNCTION increment_variable_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER variable_version_increment
  BEFORE UPDATE ON variables
  FOR EACH ROW
  EXECUTE FUNCTION increment_variable_version();
