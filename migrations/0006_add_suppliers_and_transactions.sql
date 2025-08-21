-- 0006_add_suppliers_and_transactions.sql
PRAGMA foreign_keys=ON;

-- SUPPLIERS (per user)
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,                    -- uuid (hex, no dashes is fine)
  user_id TEXT NOT NULL,                  -- FK -> auth_users(id)
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_user_name
  ON suppliers(user_id, name);
CREATE INDEX IF NOT EXISTS idx_suppliers_user
  ON suppliers(user_id);

CREATE TRIGGER IF NOT EXISTS trg_suppliers_touch_mtime
AFTER UPDATE ON suppliers
FOR EACH ROW
BEGIN
  UPDATE suppliers SET updated_at = strftime('%s','now') WHERE id = NEW.id;
END;

-- SUPPLIER TRANSACTIONS (per user)
CREATE TABLE IF NOT EXISTS supplier_transactions (
  id TEXT PRIMARY KEY,                    -- uuid
  user_id TEXT NOT NULL,                  -- FK -> auth_users(id) (for scoping)
  supplier_id TEXT NOT NULL,              -- FK -> suppliers(id)
  product_name TEXT NOT NULL,
  amount REAL NOT NULL,                   -- gross amount
  amount_paid REAL NOT NULL DEFAULT 0,    -- paid so far
  date TEXT NOT NULL,                     -- 'YYYY-MM-DD'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'paid' | 'cancelled'
  notes TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  CHECK (status IN ('pending','paid','cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_sup_tx_user_supplier
  ON supplier_transactions(user_id, supplier_id);
CREATE INDEX IF NOT EXISTS idx_sup_tx_user_date
  ON supplier_transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_sup_tx_user_status
  ON supplier_transactions(user_id, status);

CREATE TRIGGER IF NOT EXISTS trg_sup_tx_touch_mtime
AFTER UPDATE ON supplier_transactions
FOR EACH ROW
BEGIN
  UPDATE supplier_transactions SET updated_at = strftime('%s','now') WHERE id = NEW.id;
END;
