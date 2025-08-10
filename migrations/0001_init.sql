PRAGMA foreign_keys = ON;

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email       TEXT NOT NULL UNIQUE,
  name        TEXT,
  image_url   TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- SESSIONS
CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id     ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at  ON sessions(expires_at);

-- CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name        TEXT NOT NULL,
  phone       TEXT,
  afm         TEXT,
  tractor     TEXT,
  owner_id    TEXT NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(owner_id, afm)   -- avoid duplicate AFM within the same owner/tenant
);
CREATE INDEX IF NOT EXISTS idx_customers_owner      ON customers(owner_id);
CREATE INDEX IF NOT EXISTS idx_customers_name       ON customers(name);

-- EMPLOYEES
CREATE TABLE IF NOT EXISTS employees (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name        TEXT NOT NULL,
  phone       TEXT,
  role        TEXT,
  owner_id    TEXT NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_employees_owner      ON employees(owner_id);
CREATE INDEX IF NOT EXISTS idx_employees_name       ON employees(name);

-- SUPPLIERS
CREATE TABLE IF NOT EXISTS suppliers (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name        TEXT NOT NULL,
  phone       TEXT,
  vat         TEXT,
  owner_id    TEXT NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_suppliers_owner      ON suppliers(owner_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_name       ON suppliers(name);

-- WORKPLACES
CREATE TABLE IF NOT EXISTS workplaces (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name        TEXT NOT NULL,
  address     TEXT,
  owner_id    TEXT NOT NULL,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_workplaces_owner     ON workplaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workplaces_name      ON workplaces(name);

-- TRANSACTIONS
CREATE TABLE IF NOT EXISTS transactions (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  customer_id   TEXT NOT NULL,
  amount        REAL NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('income','expense')),
  ts            INTEGER NOT NULL DEFAULT (unixepoch()),
  note          TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_tx_customer          ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_tx_ts                ON transactions(ts DESC);
CREATE INDEX IF NOT EXISTS idx_tx_type              ON transactions(type);

-- ACTIVITIES (audit log)
CREATE TABLE IF NOT EXISTS activities (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id     TEXT NOT NULL,
  action      TEXT NOT NULL,
  entity      TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  ts          INTEGER NOT NULL DEFAULT (unixepoch()),
  meta        TEXT, -- JSON string; enforce validity below
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  CHECK (meta IS NULL OR json_valid(meta))
);
CREATE INDEX IF NOT EXISTS idx_activities_user_ts   ON activities(user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_activities_entity    ON activities(entity, entity_id);
