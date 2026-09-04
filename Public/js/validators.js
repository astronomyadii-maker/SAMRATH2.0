/* ============================================================
 * Frontend validation — mirrors backend/utils/validators.js
 * so users see the same rules before AND after submitting.
 * ============================================================ */

const Validators = (function () {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const MOBILE_RE = /^[6-9]\d{9}$/;

  function isValidEmail(value) {
    return typeof value === "string" && EMAIL_RE.test(value.trim());
  }

  function isValidMobile(value) {
    return typeof value === "string" && MOBILE_RE.test(value.trim());
  }

  function checkPasswordStrength(password) {
    const reasons = [];
    if (!password || password.length < 8) reasons.push("at least 8 characters");
    if (!/[A-Za-z]/.test(password || "")) reasons.push("at least one letter");
    if (!/[0-9]/.test(password || "")) reasons.push("at least one number");
    if (!/[^A-Za-z0-9]/.test(password || "")) reasons.push("at least one special character");
    return { valid: reasons.length === 0, reasons };
  }

  function isAdult(dobValue) {
    if (!dobValue) return false;
    const dob = new Date(dobValue);
    if (isNaN(dob.getTime())) return false;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age >= 18;
  }

  return { isValidEmail, isValidMobile, checkPasswordStrength, isAdult };
})();
