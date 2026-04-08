-- Add submission status fields for enterprise workflow
ALTER TABLE submissions ADD COLUMN is_read INTEGER NOT NULL DEFAULT 0;
ALTER TABLE submissions ADD COLUMN is_starred INTEGER NOT NULL DEFAULT 0;
ALTER TABLE submissions ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0;

-- Add IP address for rate limiting spam protection
ALTER TABLE submissions ADD COLUMN ip_address TEXT;
CREATE INDEX idx_submissions_ip_rate ON submissions(form_id, created_at, ip_address);
