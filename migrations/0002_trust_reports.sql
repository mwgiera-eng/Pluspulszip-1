CREATE TABLE IF NOT EXISTS trust_reports (
  id serial PRIMARY KEY,
  kind varchar(32) NOT NULL,
  message text NOT NULL,
  contact_email varchar(254),
  status varchar(24) NOT NULL DEFAULT 'new',
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS trust_reports_created_at_idx ON trust_reports (created_at DESC);
