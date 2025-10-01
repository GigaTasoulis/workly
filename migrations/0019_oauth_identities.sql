-- 0019_oauth_identities.sql

-- Stores external identities (e.g., Google) linked to our local users.
CREATE TABLE IF NOT EXISTS auth_identities (
  user_id     TEXT NOT NULL,                           -- FK to auth_users.id
  provider    TEXT NOT NULL,                           -- "google"
  provider_id TEXT NOT NULL,                           -- Google's "sub"
  email       TEXT,
  name        TEXT,
  picture     TEXT,
  created_at  INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  UNIQUE(provider, provider_id)
  -- (Optional) If you want hard FK checks, create auth_users first and add:
  -- , FOREIGN KEY (user_id) REFERENCES auth_users(id)
);

-- Helpful index if you want quick lookups by email later:
CREATE INDEX IF NOT EXISTS idx_auth_identities_email ON auth_identities(email);
