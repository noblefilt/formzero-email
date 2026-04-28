ALTER TABLE submissions ADD COLUMN is_spam INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_submissions_spam_created
  ON submissions (is_spam, created_at DESC);

CREATE INDEX idx_submissions_form_spam_created
  ON submissions (form_id, is_spam, created_at DESC);
