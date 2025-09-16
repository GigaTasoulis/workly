PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

CREATE TABLE customer_payments__new (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id        TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  customer_id    TEXT NOT NULL,
  product_name   TEXT,
  payment_amount REAL NOT NULL DEFAULT 0,
  payment_date   TEXT NOT NULL, -- YYYY-MM-DD
  notes          TEXT,
  entry_type     TEXT NOT NULL DEFAULT 'payment' CHECK (entry_type IN ('payment','debt')),
  created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY(transaction_id) REFERENCES customer_transactions(id) ON DELETE CASCADE,
  FOREIGN KEY(customer_id)    REFERENCES customers(id)            ON DELETE CASCADE
);

INSERT INTO customer_payments__new
  (id, user_id, transaction_id, customer_id, product_name, payment_amount, payment_date, notes, created_at)
SELECT
  id, user_id, transaction_id, customer_id, product_name, payment_amount, payment_date, notes, created_at
FROM customer_payments;

DROP TABLE customer_payments;
ALTER TABLE customer_payments__new RENAME TO customer_payments;

CREATE INDEX IF NOT EXISTS idx_pay_user_date  ON customer_payments(user_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_pay_customer   ON customer_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_pay_tx         ON customer_payments(transaction_id);

COMMIT;
PRAGMA foreign_keys=ON;
