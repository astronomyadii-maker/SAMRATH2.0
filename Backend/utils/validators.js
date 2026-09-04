/* ============================================================
 * Shared validation rules.
 * The frontend (public/js/validators.js) mirrors these exact
 * rules so users see the same errors before AND after submit.
 * ============================================================ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^[6-9]\d{9}$/; // Indian mobile numbers: 10 digits, starts 6-9

function isValidEmail(value) {
  return typeof value === "string" && EMAIL_RE.test(value.trim());
}

function isValidMobile(value) {
  return typeof value === "string" && MOBILE_RE.test(value.trim());
}

/**
 * Password strength: at least 8 characters, one letter, one number,
 * one special character.
 * Returns { valid: boolean, reasons: string[] }
 */
function checkPasswordStrength(password) {
  const reasons = [];
  if (!password || password.length < 8) reasons.push("at least 8 characters");
  if (!/[A-Za-z]/.test(password || "")) reasons.push("at least one letter");
  if (!/[0-9]/.test(password || "")) reasons.push("at least one number");
  if (!/[^A-Za-z0-9]/.test(password || "")) reasons.push("at least one special character");
  return { valid: reasons.length === 0, reasons };
}

function isAdult(dobString) {
  if (!dobString) return false;
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age >= 18;
}

const VALID_BUSINESS_TYPES = ["sole-proprietor", "partnership", "pvt-ltd", "llp"];
const VALID_ACCOUNT_TYPES = ["savings", "current", "business"];

module.exports = {
  isValidEmail,
  isValidMobile,
  checkPasswordStrength,
  isAdult,
  VALID_BUSINESS_TYPES,
  VALID_ACCOUNT_TYPES,
};
