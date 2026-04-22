-- Add per-form allowed browser origins for submission endpoints
ALTER TABLE forms ADD COLUMN allowed_origins TEXT;
