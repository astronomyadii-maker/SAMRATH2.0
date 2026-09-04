/* ============================================================
 * SQLite database setup.
 * Uses better-sqlite3 — a file-based DB, no separate server
 * needed. Good fit for a hackathon build; swap for Postgres/
 * MySQL later by re-implementing this module with the same
 * exported function names.
 * ============================================================ */

const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const DB_PATH = process.env.DB_PATH || "./data/vittasetu.db";

// Make sure the folder for the DB file exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name      TEXT NOT NULL,
    email          TEXT NOT NULL UNIQUE,
    mobile         TEXT NOT NULL UNIQUE,
    password_hash  TEXT NOT NULL,
    dob            TEXT NOT NULL,
    business_type  TEXT NOT NULL,
    business_name  TEXT NOT NULL,
    account_type   TEXT NOT NULL,
    address        TEXT NOT NULL,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK (type IN ('credit', 'debit')),
    amount      REAL NOT NULL CHECK (amount > 0),
    category    TEXT NOT NULL DEFAULT 'general',
    note        TEXT,
    txn_date    TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS loan_applications (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount         REAL NOT NULL,
    purpose        TEXT,
    tenure_months  INTEGER NOT NULL,
    interest_rate  REAL NOT NULL,
    emi            REAL NOT NULL,
    status         TEXT NOT NULL DEFAULT 'pending',
    decision_note  TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS chat_messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content     TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id, txn_date);
  CREATE INDEX IF NOT EXISTS idx_loans_user ON loan_applications(user_id);
  CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_messages(user_id);
`);

module.exports = db;
