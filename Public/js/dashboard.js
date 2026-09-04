/* ============================================================
 * Dashboard (passbook) page logic.
 * Depends on app-shell.js being loaded first.
 * ============================================================ */

(function () {
  "use strict";

  let currentFilter = "all";

  const txnForm = document.getElementById("txnForm");
  const txnTypeGroup = document.getElementById("txnType");
  const txnTypeValue = document.getElementById("txnTypeValue");
  const txnError = document.getElementById("txnError");
  const ledgerBody = document.getElementById("ledgerBody");
  const ledgerEmpty = document.getElementById("ledgerEmpty");
  const filterTabs = document.getElementById("filterTabs");

  document.getElementById("txnDate").valueAsDate = new Date();

  /* ---------- Entry type toggle (credit / debit) ---------- */
  txnTypeGroup.addEventListener("click", function (e) {
    const opt = e.target.closest(".segmented__opt");
    if (!opt) return;
    txnTypeGroup.querySelectorAll(".segmented__opt").forEach(function (o) {
      o.classList.remove("is-selected");
      o.setAttribute("aria-checked", "false");
    });
    opt.classList.add("is-selected");
    opt.setAttribute("aria-checked", "true");
    txnTypeValue.value = opt.getAttribute("data-value");
  });

  /* ---------- Filter tabs ---------- */
  filterTabs.addEventListener("click", function (e) {
    const opt = e.target.closest(".filter-tabs__opt");
    if (!opt) return;
    filterTabs.querySelectorAll(".filter-tabs__opt").forEach(function (o) { o.classList.remove("is-selected"); });
    opt.classList.add("is-selected");
    currentFilter = opt.getAttribute("data-filter");
    loadTransactions();
  });

  /* ---------- Add transaction ---------- */
  txnForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    txnError.textContent = "";

    const data = Object.fromEntries(new FormData(txnForm).entries());
    const amount = Number(data.amount);

    if (!amount || amount <= 0) {
      txnError.textContent = "Enter an amount greater than zero.";
      return;
    }

    try {
      const res = await AppShell.authFetch("/transactions", {
        method: "POST",
        body: JSON.stringify({
          type: txnTypeValue.value,
          amount,
          category: data.category,
          note: data.note,
          date: data.date,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        txnError.textContent = result.error || "Could not record this entry.";
        return;
      }
      txnForm.reset();
      document.getElementById("txnDate").valueAsDate = new Date();
      await Promise.all([loadSummary(), loadTransactions()]);
    } catch (err) {
      txnError.textContent = "Could not reach the server. Please try again.";
    }
  });

  /* ---------- Summary strip ---------- */
  async function loadSummary() {
    const res = await AppShell.authFetch("/transactions/summary");
    const summary = await res.json();
    document.getElementById("statBalance").textContent = AppShell.formatCurrency(summary.balance);
    document.getElementById("statCredit").textContent = AppShell.formatCurrency(summary.totalCredit);
    document.getElementById("statDebit").textContent = AppShell.formatCurrency(summary.totalDebit);
    document.getElementById("statCount").textContent = summary.count;
  }

  /* ---------- Ledger list ---------- */
  async function loadTransactions() {
    const query = currentFilter === "all" ? "" : "?type=" + currentFilter;
    const res = await AppShell.authFetch("/transactions" + query);
    const { transactions } = await res.json();

    ledgerBody.innerHTML = "";
    ledgerEmpty.hidden = transactions.length > 0;

    // Running balance shown newest-first, so compute from the oldest entry forward.
    const chronological = [...transactions].reverse();
    let running = 0;
    const balances = {};
    chronological.forEach(function (t) {
      running += t.type === "credit" ? t.amount : -t.amount;
      balances[t.id] = running;
    });

    transactions.forEach(function (t) {
      const row = document.createElement("div");
      row.className = "ledger__row";
      row.innerHTML = `
        <span class="ledger__date">${formatDate(t.date)}</span>
        <span>${escapeHtml(t.note) || "—"}</span>
        <span class="ledger__category">${escapeHtml(t.category)}</span>
        <span class="ledger__debit">${t.type === "debit" ? AppShell.formatCurrency(t.amount) : ""}</span>
        <span class="ledger__credit">${t.type === "credit" ? AppShell.formatCurrency(t.amount) : ""}</span>
        <button class="ledger__delete" title="Delete entry" data-id="${t.id}" aria-label="Delete entry">×</button>
      `;
      ledgerBody.appendChild(row);
    });
  }

  ledgerBody.addEventListener("click", async function (e) {
    const btn = e.target.closest(".ledger__delete");
    if (!btn) return;
    const id = btn.getAttribute("data-id");
    await AppShell.authFetch("/transactions/" + id, { method: "DELETE" });
    await Promise.all([loadSummary(), loadTransactions()]);
  });

  function formatDate(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str || "";
    return div.innerHTML;
  }

  loadSummary();
  loadTransactions();
})();
