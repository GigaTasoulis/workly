-- Migration number: 0004 	 2025-08-13T10:31:53.247Z
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS auth_users (
  id TEXT PRIMARY KEY,              -- uuid
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

/* sessions table already exists; we keep using it */
