-- customer-facing transactions (separate from supplier_transactions)
CREATE TABLE IF NOT EXISTS transactions (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id       TEXT NOT NULL,
  customer_id   TEXT NOT NULL,
  product_name  TEXT NOT NULL,
  amount        REAL NOT NULL DEFAULT 0,
  amount_paid   REAL NOT NULL DEFAULT 0,
  date          TEXT NOT NULL, -- YYYY-MM-DD
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('paid','pending','cancelled')),
  notes         TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tx_customer ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_tx_ts       ON transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_tx_status   ON transactions(status);
