/* ============================================================
 * Loan calculator page logic.
 * Depends on app-shell.js being loaded first.
 * ============================================================ */

(function () {
  "use strict";

  const loanForm = document.getElementById("loanForm");
  const loanError = document.getElementById("loanError");
  const resultBox = document.getElementById("loanResult");
  const applyBtn = document.getElementById("applyLoanBtn");
  const applyStatus = document.getElementById("applyStatus");

  let lastCalculation = null;

  loanForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    loanError.textContent = "";
    applyStatus.textContent = "";

    const data = Object.fromEntries(new FormData(loanForm).entries());

    try {
      const res = await AppShell.authFetch("/loan/calculate", {
        method: "POST",
        body: JSON.stringify({
          principal: Number(data.principal),
          rate: Number(data.rate),
          tenureMonths: Number(data.tenureMonths),
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        loanError.textContent = result.error || "Could not calculate the EMI.";
        resultBox.hidden = true;
        return;
      }

      lastCalculation = { ...result, principal: Number(data.principal), rate: Number(data.rate), tenureMonths: Number(data.tenureMonths) };
      renderResult(result);
    } catch (err) {
      loanError.textContent = "Could not reach the server. Please try again.";
    }
  });

  function renderResult(result) {
    document.getElementById("resultEmi").textContent = AppShell.formatCurrency(result.emi);
    document.getElementById("resultInterest").textContent = AppShell.formatCurrency(result.totalInterest);
    document.getElementById("resultTotal").textContent = AppShell.formatCurrency(result.totalPayment);

    const body = document.getElementById("scheduleBody");
    body.innerHTML = "";
    result.schedule.forEach(function (row) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.month}</td>
        <td>${AppShell.formatCurrency(row.emi)}</td>
        <td>${AppShell.formatCurrency(row.principalPortion)}</td>
        <td>${AppShell.formatCurrency(row.interestPortion)}</td>
        <td>${AppShell.formatCurrency(row.balance)}</td>
      `;
      body.appendChild(tr);
    });

    resultBox.hidden = false;
  }

  applyBtn.addEventListener("click", async function () {
    if (!lastCalculation) return;
    applyBtn.disabled = true;
    applyStatus.textContent = "Submitting your application…";

    try {
      const res = await AppShell.authFetch("/loan/apply", {
        method: "POST",
        body: JSON.stringify({
          amount: lastCalculation.principal,
          rate: lastCalculation.rate,
          tenureMonths: lastCalculation.tenureMonths,
          purpose: document.getElementById("loanPurpose").value,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        applyStatus.textContent = result.error || "Could not submit the application.";
        return;
      }
      applyStatus.textContent = "Status: " + result.status.toUpperCase() + " — " + result.note;
    } catch (err) {
      applyStatus.textContent = "Could not reach the server. Please try again.";
    } finally {
      applyBtn.disabled = false;
    }
  });
})();
