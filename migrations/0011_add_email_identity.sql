ALTER TABLE forms ADD COLUMN public_site_name TEXT;
ALTER TABLE forms ADD COLUMN from_name TEXT;
ALTER TABLE forms ADD COLUMN from_email TEXT;
ALTER TABLE forms ADD COLUMN notification_to_email TEXT;

ALTER TABLE settings ADD COLUMN public_site_name TEXT;
ALTER TABLE settings ADD COLUMN from_name TEXT;
ALTER TABLE settings ADD COLUMN from_email TEXT;
ALTER TABLE settings ADD COLUMN notification_to_email TEXT;
