/* ============================================================
 * /api/loan — EMI calculator + loan application intake
 *
 * The approval logic here is a simple, transparent rule engine
 * (based on the applicant's own recorded transaction history).
 * Swap runApprovalCheck() for a real model/API call when your
 * AI risk-scoring component is ready — the request/response
 * shape below is designed to stay the same either way.
 * ============================================================ */

const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

/** Standard reducing-balance EMI formula. */
function calculateEmi(principal, annualRatePercent, tenureMonths) {
  const monthlyRate = annualRatePercent / 12 / 100;
  if (monthlyRate === 0) {
    const emi = principal / tenureMonths;
    return { emi, totalPayment: principal, totalInterest: 0 };
  }
  const factor = Math.pow(1 + monthlyRate, tenureMonths);
  const emi = (principal * monthlyRate * factor) / (factor - 1);
  const totalPayment = emi * tenureMonths;
  const totalInterest = totalPayment - principal;
  return { emi, totalPayment, totalInterest };
}

function buildSchedule(principal, annualRatePercent, tenureMonths, emi) {
  const monthlyRate = annualRatePercent / 12 / 100;
  let balance = principal;
  const schedule = [];
  for (let month = 1; month <= tenureMonths; month++) {
    const interestPortion = balance * monthlyRate;
    const principalPortion = Math.min(emi - interestPortion, balance);
    balance = Math.max(balance - principalPortion, 0);
    schedule.push({
      month,
      emi: Math.round(emi * 100) / 100,
      principalPortion: Math.round(principalPortion * 100) / 100,
      interestPortion: Math.round(interestPortion * 100) / 100,
      balance: Math.round(balance * 100) / 100,
    });
  }
  return schedule;
}

/* ---------- POST /api/loan/calculate — public, no login needed ---------- */
router.post("/calculate", (req, res) => {
  const principal = Number(req.body.principal);
  const rate = Number(req.body.rate);
  const tenureMonths = Number(req.body.tenureMonths);

  if (!principal || principal <= 0) return res.status(400).json({ error: "Enter a loan amount greater than zero." });
  if (rate === undefined || rate < 0) return res.status(400).json({ error: "Enter a valid annual interest rate." });
  if (!tenureMonths || tenureMonths <= 0) return res.status(400).json({ error: "Enter a tenure in months, greater than zero." });

  const { emi, totalPayment, totalInterest } = calculateEmi(principal, rate, tenureMonths);
  const schedule = buildSchedule(principal, rate, tenureMonths, emi);

  res.json({
    emi: Math.round(emi * 100) / 100,
    totalPayment: Math.round(totalPayment * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    schedule,
  });
});

/**
 * Placeholder rule-based check, run against the applicant's own
 * transaction history. Replace the body of this function with a
 * call to your AI/ML scoring service — keep the return shape.
 */
function runApprovalCheck(userId, amount, emi) {
  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) AS totalCredit,
      COALESCE(SUM(CASE WHEN type = 'debit' THEN amount ELSE 0 END), 0) AS totalDebit,
      COUNT(*) AS count
    FROM transactions WHERE user_id = ?
  `).get(userId);

  const avgMonthlyInflow = totals.count > 0 ? totals.totalCredit / Math.max(1, totals.count / 30) : 0;

  if (totals.count < 5) {
    return { status: "pending", note: "Needs manual review — not enough transaction history yet." };
  }
  if (emi > avgMonthlyInflow * 0.5) {
    return { status: "rejected", note: "Requested EMI exceeds 50% of average recorded inflow." };
  }
  return { status: "approved", note: "Requested EMI is within a healthy range of recorded inflow." };
}

/* ---------- POST /api/loan/apply — logged-in users only ---------- */
router.post("/apply", requireAuth, (req, res) => {
  const amount = Number(req.body.amount);
  const rate = Number(req.body.rate) || 12;
  const tenureMonths = Number(req.body.tenureMonths);
  const purpose = (req.body.purpose || "").trim();

  if (!amount || amount <= 0) return res.status(400).json({ error: "Enter a loan amount greater than zero." });
  if (!tenureMonths || tenureMonths <= 0) return res.status(400).json({ error: "Enter a valid tenure." });

  const { emi } = calculateEmi(amount, rate, tenureMonths);
  const decision = runApprovalCheck(req.user.id, amount, emi);

  const info = db.prepare(`
    INSERT INTO loan_applications (user_id, amount, purpose, tenure_months, interest_rate, emi, status, decision_note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, amount, purpose, tenureMonths, rate, emi, decision.status, decision.note);

  res.status(201).json({
    id: info.lastInsertRowid,
    amount,
    tenureMonths,
    rate,
    emi: Math.round(emi * 100) / 100,
    status: decision.status,
    note: decision.note,
  });
});

/* ---------- GET /api/loan/apply — this user's past applications ---------- */
router.get("/apply", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM loan_applications WHERE user_id = ? ORDER BY created_at DESC").all(req.user.id);
  res.json({ applications: rows });
});

module.exports = router;
