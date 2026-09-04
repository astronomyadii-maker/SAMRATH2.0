/* ============================================================
 * /api/transactions — record and review credits/debits
 * ============================================================ */

const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

function publicTxn(row) {
  return {
    id: row.id,
    type: row.type,
    amount: row.amount,
    category: row.category,
    note: row.note,
    date: row.txn_date,
    createdAt: row.created_at,
  };
}

/* ---------- POST /api/transactions — add a credit or debit ---------- */
router.post("/", (req, res) => {
  const { type, amount, category, note, date } = req.body || {};

  if (!["credit", "debit"].includes(type)) {
    return res.status(400).json({ error: "Type must be 'credit' or 'debit'." });
  }
  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ error: "Enter an amount greater than zero." });
  }
  const txnDate = date || new Date().toISOString().slice(0, 10);

  const info = db.prepare(`
    INSERT INTO transactions (user_id, type, amount, category, note, txn_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.user.id, type, numAmount, (category || "general").trim(), (note || "").trim(), txnDate);

  const row = db.prepare("SELECT * FROM transactions WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json({ transaction: publicTxn(row) });
});

/* ---------- GET /api/transactions — list, newest first, optional filters ---------- */
router.get("/", (req, res) => {
  const { type, from, to, limit } = req.query;

  let sql = "SELECT * FROM transactions WHERE user_id = ?";
  const params = [req.user.id];

  if (type === "credit" || type === "debit") {
    sql += " AND type = ?";
    params.push(type);
  }
  if (from) {
    sql += " AND txn_date >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND txn_date <= ?";
    params.push(to);
  }
  sql += " ORDER BY txn_date DESC, id DESC";
  if (limit) {
    sql += " LIMIT ?";
    params.push(Number(limit));
  }

  const rows = db.prepare(sql).all(...params);
  res.json({ transactions: rows.map(publicTxn) });
});

/* ---------- GET /api/transactions/summary — totals for the dashboard ---------- */
router.get("/summary", (req, res) => {
  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) AS totalCredit,
      COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) AS totalDebit,
      COUNT(*) AS count
    FROM transactions WHERE user_id = ?
  `).get(req.user.id);

  res.json({
    totalCredit: totals.totalCredit,
    totalDebit: totals.totalDebit,
    balance: totals.totalCredit - totals.totalDebit,
    count: totals.count,
  });
});

/* ---------- DELETE /api/transactions/:id ---------- */
router.delete("/:id", (req, res) => {
  const info = db.prepare("DELETE FROM transactions WHERE id = ? AND user_id = ?")
    .run(req.params.id, req.user.id);
  if (info.changes === 0) return res.status(404).json({ error: "Transaction not found." });
  res.json({ ok: true });
});

module.exports = router;
