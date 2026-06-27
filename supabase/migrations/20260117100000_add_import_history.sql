-- =====================================================
-- Import History Table
-- =====================================================
-- Tracks file imports for audit and analytics purposes

CREATE TABLE import_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    environment_id UUID NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    variables_imported INTEGER NOT NULL DEFAULT 0,
    variables_skipped INTEGER NOT NULL DEFAULT 0,
    variables_overwritten INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_import_history_organization_id ON import_history(organization_id);
CREATE INDEX idx_import_history_environment_id ON import_history(environment_id);
CREATE INDEX idx_import_history_user_id ON import_history(user_id);
CREATE INDEX idx_import_history_created_at ON import_history(created_at DESC);

-- Enable RLS
ALTER TABLE import_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view import history for their organizations"
    ON import_history FOR SELECT
    TO authenticated
    USING (organization_id IN (SELECT get_user_organization_ids()));

CREATE POLICY "Users can insert import history for their organizations"
    ON import_history FOR INSERT
    TO authenticated
    WITH CHECK (
        organization_id IN (SELECT get_user_organization_ids())
        AND environment_id IN (SELECT get_user_environment_ids())
    );

-- Grants
GRANT SELECT, INSERT ON import_history TO authenticated;
