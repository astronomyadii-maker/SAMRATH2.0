/* ============================================================
 * Shared app shell: auth guard, nav user info, logout,
 * authenticated fetch helper. Loaded on every logged-in page.
 * ============================================================ */

const AppShell = (function () {
  const API_BASE = "/api";

  const token = localStorage.getItem("vittasetu_token");
  const userJson = localStorage.getItem("vittasetu_user");

  // No session? Send the user back to sign up / log in.
  if (!token || !userJson) {
    window.location.href = "index.html";
  }

  const user = userJson ? JSON.parse(userJson) : null;

  function paintNav() {
    const nameEl = document.getElementById("navUserName");
    const badgeEl = document.getElementById("navUserBadge");
    if (nameEl && user) nameEl.textContent = user.businessName;
    if (badgeEl && user) badgeEl.textContent = user.accountType.charAt(0).toUpperCase() + user.accountType.slice(1) + " account";
  }

  function logout() {
    localStorage.removeItem("vittasetu_token");
    localStorage.removeItem("vittasetu_user");
    window.location.href = "index.html";
  }

  document.addEventListener("DOMContentLoaded", function () {
    paintNav();
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.addEventListener("click", logout);
  });

  /** fetch() wrapper that attaches the Bearer token and handles 401s. */
  async function authFetch(path, options) {
    options = options || {};
    options.headers = Object.assign({}, options.headers, {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    });
    const res = await fetch(API_BASE + path, options);
    if (res.status === 401) {
      logout();
      throw new Error("Session expired");
    }
    return res;
  }

  function formatCurrency(amount) {
    return "₹" + Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return { user, authFetch, formatCurrency, logout };
})();
