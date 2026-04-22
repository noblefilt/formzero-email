ALTER TABLE forms ADD COLUMN webhook_url TEXT;
ALTER TABLE forms ADD COLUMN webhook_secret TEXT;
ALTER TABLE forms ADD COLUMN server_token_hash TEXT;

ALTER TABLE submissions ADD COLUMN idempotency_key TEXT;
ALTER TABLE submissions ADD COLUMN request_origin TEXT;
ALTER TABLE submissions ADD COLUMN request_source TEXT NOT NULL DEFAULT 'unknown';

CREATE UNIQUE INDEX idx_submissions_form_idempotency
  ON submissions(form_id, idempotency_key);

CREATE TABLE webhook_deliveries (
  id TEXT PRIMARY KEY,
  form_id TEXT NOT NULL,
  submission_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  target_url TEXT NOT NULL,
  request_body TEXT NOT NULL,
  request_signature TEXT NOT NULL,
  request_timestamp TEXT NOT NULL,
  status TEXT NOT NULL,
  status_code INTEGER,
  response_body TEXT,
  error_message TEXT,
  attempt_number INTEGER NOT NULL,
  replayed_from_delivery_id TEXT REFERENCES webhook_deliveries(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  delivered_at INTEGER,
  FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
);

CREATE INDEX idx_webhook_deliveries_form_created
  ON webhook_deliveries(form_id, created_at DESC);

CREATE INDEX idx_webhook_deliveries_submission_created
  ON webhook_deliveries(submission_id, created_at DESC);
