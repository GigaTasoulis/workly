CREATE TABLE IF NOT EXISTS supplier_payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  amount REAL NOT NULL,
  date TEXT NOT NULL,
  notes TEXT,
  type TEXT NOT NULL DEFAULT 'payment' CHECK (type IN ('payment','debt')),
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  FOREIGN KEY (transaction_id) REFERENCES supplier_transactions(id)
);
