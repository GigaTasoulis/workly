PRAGMA foreign_keys = ON;

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_users_username ON auth_users(username);

-- password_hash already exists from earlier work; make this a no-op
-- ALTER TABLE auth_users ADD COLUMN password_hash TEXT;

ALTER TABLE auth_users ADD COLUMN email TEXT;
