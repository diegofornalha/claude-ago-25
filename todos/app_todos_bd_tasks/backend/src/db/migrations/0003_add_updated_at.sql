-- Add updatedAt column to issues table
ALTER TABLE issues ADD COLUMN "updatedAt" timestamp with time zone;

-- Create trigger to automatically update updatedAt
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_issues_updated_at BEFORE UPDATE ON issues
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();