-- Payroll transactions (one row per worklog)
CREATE TABLE IF NOT EXISTS payroll_transactions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  employee_id  TEXT NOT NULL,
  worklog_id   TEXT NOT NULL,             -- tie to worklogs.id
  amount       REAL NOT NULL DEFAULT 0,   -- total due for the worklog
  amount_paid  REAL NOT NULL DEFAULT 0,   -- running total of payments
  date         TEXT NOT NULL,             -- 'YYYY-MM-DD' (we'll use worklog date)
  status       TEXT NOT NULL DEFAULT 'pending', -- 'pending'|'paid'|'cancelled'
  notes        TEXT,
  created_at   INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at   INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payroll_tx_user_worklog ON payroll_transactions(user_id, worklog_id);
CREATE INDEX IF NOT EXISTS idx_payroll_tx_user_status  ON payroll_transactions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_payroll_tx_user_month   ON payroll_transactions(user_id, substr(date,1,7));

-- Optional audit trail of payments
CREATE TABLE IF NOT EXISTS payroll_payments (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL,
  transaction_id  TEXT NOT NULL,
  worklog_id      TEXT NOT NULL,
  employee_id     TEXT NOT NULL,
  amount          REAL NOT NULL,          -- single payment amount
  date            TEXT NOT NULL,          -- 'YYYY-MM-DD' (when the payment happened)
  note            TEXT,
  created_at      INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE INDEX IF NOT EXISTS idx_payroll_pay_user_tx ON payroll_payments(user_id, transaction_id);
