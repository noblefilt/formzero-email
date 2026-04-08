-- Add per-form notification email columns to forms table
ALTER TABLE forms ADD COLUMN notification_email TEXT;
ALTER TABLE forms ADD COLUMN notification_email_password TEXT;
ALTER TABLE forms ADD COLUMN smtp_host TEXT;
ALTER TABLE forms ADD COLUMN smtp_port INTEGER;
