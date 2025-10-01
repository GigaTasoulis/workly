-- Enforce unique usernames without altering existing columns
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_users_username_unique
  ON auth_users (username);
