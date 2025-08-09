-- Add indexes for better performance
CREATE INDEX idx_issues_user_id ON issues(userId);
CREATE INDEX idx_issues_created_at ON issues(createdAt DESC);
CREATE INDEX idx_issues_title_search ON issues USING gin(to_tsvector('english', title));