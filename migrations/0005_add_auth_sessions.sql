PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,          -- uuid (session token)
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,  -- unix seconds
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions(expires_at);
