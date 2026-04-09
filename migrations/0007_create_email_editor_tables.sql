CREATE TABLE email_templates (
  id TEXT NOT NULL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  summary TEXT NOT NULL,
  document_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE TABLE email_template_versions (
  id TEXT NOT NULL PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES email_templates (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  document_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_email_templates_user_updated
  ON email_templates (user_id, updated_at DESC);

CREATE INDEX idx_email_templates_user_active
  ON email_templates (user_id, deleted_at);

CREATE INDEX idx_email_template_versions_template_created
  ON email_template_versions (template_id, created_at DESC);

CREATE UNIQUE INDEX idx_email_template_versions_unique_number
  ON email_template_versions (template_id, version_number);
