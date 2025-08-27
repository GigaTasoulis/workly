-- EMPLOYEES
CREATE TABLE IF NOT EXISTS employees (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL,
  email        TEXT,
  phone        TEXT,
  position     TEXT,
  department   TEXT,
  hire_date    TEXT,          -- YYYY-MM-DD
  workplace_id TEXT,          -- app-level FK to workplaces.id (same user)
  notes        TEXT,
  created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_employees_user_created
  ON employees(user_id, created_at DESC);

-- WORKLOGS
CREATE TABLE IF NOT EXISTS worklogs (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  employee_id   TEXT NOT NULL,  -- employees.id (same user)
  workplace_id  TEXT NOT NULL,  -- workplaces.id (same user)
  date          TEXT NOT NULL,  -- YYYY-MM-DD
  hours_worked  REAL NOT NULL DEFAULT 0,
  notes         TEXT,
  total_amount  REAL NOT NULL DEFAULT 0,
  amount_paid   REAL NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_worklogs_user_date
  ON worklogs(user_id, date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_worklogs_user_employee
  ON worklogs(user_id, employee_id, date DESC);
