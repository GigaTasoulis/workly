-- payments applied to customer transactions
CREATE TABLE IF NOT EXISTS customer_payments (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id        TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  customer_id    TEXT NOT NULL,
  product_name   TEXT,
  payment_amount REAL NOT NULL DEFAULT 0,
  payment_date   TEXT NOT NULL, -- YYYY-MM-DD
  notes          TEXT,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY(transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
  FOREIGN KEY(customer_id)    REFERENCES customers(id)    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_pay_user_date  ON customer_payments(user_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_pay_customer   ON customer_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_pay_tx         ON customer_payments(transaction_id);
