-- Workplaces (per user)
CREATE TABLE IF NOT EXISTS workplaces (
  id         TEXT PRIMARY KEY,                         -- crypto.randomUUID().replace(/-/g, "")
  user_id    TEXT NOT NULL,                            -- from session
  name       TEXT NOT NULL,
  address    TEXT,
  city       TEXT,
  state      TEXT,
  zip_code   TEXT,
  capacity   TEXT,
  notes      TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workplaces_user_created
  ON workplaces(user_id, created_at DESC);
