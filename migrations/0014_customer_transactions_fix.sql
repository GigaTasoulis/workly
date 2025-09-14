-- 0014_customer_transactions_fix.sql

-- Create the canonical table used by the app
CREATE TABLE IF NOT EXISTS customer_transactions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  customer_id   TEXT NOT NULL,
  product_name  TEXT,
  amount        REAL NOT NULL DEFAULT 0,
  amount_paid   REAL NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','cancelled')),
  date          TEXT,
  notes         TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

-- If you had a legacy 'transactions' table with the same columns, copy rows over
INSERT INTO customer_transactions (id, user_id, customer_id, product_name, amount, amount_paid, status, date, notes, created_at)
SELECT t.id, t.user_id, t.customer_id, t.product_name, t.amount, t.amount_paid, t.status, t.date, t.notes, t.created_at
FROM transactions t
WHERE NOT EXISTS (
  SELECT 1 FROM customer_transactions ct WHERE ct.id = t.id
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_ct_user           ON customer_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_ct_user_status    ON customer_transactions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ct_user_customer  ON customer_transactions(user_id, customer_id);
