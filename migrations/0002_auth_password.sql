-- migrations/0002_auth_password.sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS auth_credentials (
  user_id     TEXT PRIMARY KEY,
  -- format: "pbkdf2:sha256:<iterations>$<salt_hex>$<hash_hex>"
  password    TEXT NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
