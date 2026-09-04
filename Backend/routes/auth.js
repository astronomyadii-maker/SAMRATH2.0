/* ============================================================
 * /api/auth — signup, login, current-user
 * ============================================================ */

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const {
  isValidEmail,
  isValidMobile,
  checkPasswordStrength,
  isAdult,
  VALID_BUSINESS_TYPES,
  VALID_ACCOUNT_TYPES,
} = require("../utils/validators");

const router = express.Router();

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

function publicUser(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    mobile: row.mobile,
    dob: row.dob,
    businessType: row.business_type,
    businessName: row.business_name,
    accountType: row.account_type,
    address: row.address,
    createdAt: row.created_at,
  };
}

/* ---------- POST /api/auth/signup ---------- */
router.post("/signup", (req, res) => {
  const {
    fullName, email, mobile, password, dob,
    businessType, businessName, accountType, address,
  } = req.body || {};

  const errors = {};

  if (!fullName || fullName.trim().length < 3) errors.fullName = "Enter your full name.";
  if (!isValidEmail(email)) errors.email = "Enter a valid email address.";
  if (!isValidMobile(mobile)) errors.mobile = "Enter a valid 10-digit mobile number.";
  if (!dob || !isAdult(dob)) errors.dob = "You must be 18 or older to open an account.";

  const pwCheck = checkPasswordStrength(password);
  if (!pwCheck.valid) errors.password = "Password needs " + pwCheck.reasons.join(", ") + ".";

  if (!VALID_BUSINESS_TYPES.includes(businessType)) errors.businessType = "Select a valid business type.";
  if (!businessName || businessName.trim().length < 2) errors.businessName = "Enter your business name.";
  if (!VALID_ACCOUNT_TYPES.includes(accountType)) errors.accountType = "Select a valid account type.";
  if (!address || address.trim().length < 8) errors.address = "Enter your registered address.";

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ error: "Please fix the highlighted fields.", fields: errors });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ? OR mobile = ?").get(email, mobile);
  if (existing) {
    return res.status(409).json({ error: "An account with this email or mobile number already exists." });
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  const info = db.prepare(`
    INSERT INTO users (full_name, email, mobile, password_hash, dob, business_type, business_name, account_type, address)
    VALUES (@fullName, @email, @mobile, @passwordHash, @dob, @businessType, @businessName, @accountType, @address)
  `).run({
    fullName: fullName.trim(),
    email: email.trim().toLowerCase(),
    mobile: mobile.trim(),
    passwordHash,
    dob,
    businessType,
    businessName: businessName.trim(),
    accountType,
    address: address.trim(),
  });

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(info.lastInsertRowid);
  const token = signToken(user);

  res.status(201).json({ token, user: publicUser(user) });
});

/* ---------- POST /api/auth/login ---------- */
router.post("/login", (req, res) => {
  const { loginId, password } = req.body || {};

  if (!loginId || !password) {
    return res.status(400).json({ error: "Enter your email/mobile and password." });
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ? OR mobile = ?")
    .get(loginId.trim().toLowerCase(), loginId.trim());

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Incorrect email/mobile or password." });
  }

  const token = signToken(user);
  res.json({ token, user: publicUser(user) });
});

/* ---------- GET /api/auth/me ---------- */
router.get("/me", requireAuth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found." });
  res.json({ user: publicUser(user) });
});

module.exports = router;
