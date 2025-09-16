-- Standardize FK to customer_transactions(id)
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

-- Rebuild table with the correct FK targets
CREATE TABLE customer_payments__new (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id        TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  customer_id    TEXT NOT NULL,
  product_name   TEXT,
  payment_amount REAL NOT NULL DEFAULT 0,
  payment_date   TEXT NOT NULL, -- YYYY-MM-DD
  notes          TEXT,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY(transaction_id) REFERENCES customer_transactions(id) ON DELETE CASCADE,
  FOREIGN KEY(customer_id)    REFERENCES customers(id)            ON DELETE CASCADE
);

-- Migrate only rows whose transaction_id actually exists in customer_transactions
INSERT INTO customer_payments__new
  (id, user_id, transaction_id, customer_id, product_name, payment_amount, payment_date, notes, created_at)
SELECT
  p.id, p.user_id, p.transaction_id, p.customer_id, p.product_name,
  p.payment_amount, p.payment_date, p.notes, p.created_at
FROM customer_payments p
WHERE EXISTS (SELECT 1 FROM customer_transactions t WHERE t.id = p.transaction_id);

DROP TABLE customer_payments;
ALTER TABLE customer_payments__new RENAME TO customer_payments;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_pay_user_date  ON customer_payments(user_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_pay_customer   ON customer_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_pay_tx         ON customer_payments(transaction_id);

COMMIT;
PRAGMA foreign_keys=ON;
