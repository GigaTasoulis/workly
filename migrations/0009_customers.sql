-- customers table (multi-tenant via user_id)
CREATE TABLE IF NOT EXISTS customers (
  id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id      TEXT NOT NULL,
  name         TEXT NOT NULL,
  contact_person TEXT,
  email        TEXT,
  phone        TEXT,
  address      TEXT,
  afm          TEXT,
  tractor      TEXT,
  notes        TEXT,
  created_at   INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_customers_owner ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_name  ON customers(name);

