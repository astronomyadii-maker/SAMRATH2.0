/* ============================================================
 * Samarth — floating chatbot widget.
 * Depends on app-shell.js (for AppShell.authFetch) being
 * loaded first. Injects its own markup into #chatbotRoot.
 * ============================================================ */

(function () {
  "use strict";

  const root = document.getElementById("chatbotRoot");
  if (!root) return;

  root.innerHTML = `
    <button class="samarth-toggle" id="samarthToggle" aria-label="Open Samarth assistant">S</button>
    <div class="samarth-panel" id="samarthPanel" hidden>
      <div class="samarth-panel__header">
        <div class="samarth-panel__title">
          <strong>Samarth</strong>
          <span>Your VittaSetu assistant</span>
        </div>
        <button class="samarth-panel__close" id="samarthClose" aria-label="Close">×</button>
      </div>
      <div class="samarth-panel__messages" id="samarthMessages"></div>
      <form class="samarth-panel__form" id="samarthForm">
        <input type="text" id="samarthInput" placeholder="Ask about loans, EMIs, your account…" autocomplete="off">
        <button type="submit">Send</button>
      </form>
    </div>
  `;

  const toggle = document.getElementById("samarthToggle");
  const panel = document.getElementById("samarthPanel");
  const closeBtn = document.getElementById("samarthClose");
  const messagesEl = document.getElementById("samarthMessages");
  const form = document.getElementById("samarthForm");
  const input = document.getElementById("samarthInput");

  const history = [];
  let opened = false;

  toggle.addEventListener("click", function () {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) {
      input.focus();
      if (!opened) {
        opened = true;
        addMessage("assistant", "Hi, I'm Samarth. Ask me about your transactions, EMI calculations, or how VittaSetu works.");
      }
    }
  });
  closeBtn.addEventListener("click", function () { panel.hidden = true; });

  function addMessage(role, text) {
    const el = document.createElement("div");
    el.className = "samarth-msg samarth-msg--" + role;
    el.textContent = text;
    messagesEl.appendChild(el);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return el;
  }

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;

    addMessage("user", text);
    history.push({ role: "user", content: text });
    input.value = "";

    const typingEl = document.createElement("div");
    typingEl.className = "samarth-msg samarth-msg--typing";
    typingEl.textContent = "Samarth is typing…";
    messagesEl.appendChild(typingEl);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    try {
      const res = await AppShell.authFetch("/chat", {
        method: "POST",
        body: JSON.stringify({ message: text, history }),
      });
      const result = await res.json();
      typingEl.remove();

      if (!res.ok) {
        addMessage("assistant", result.error || "Sorry, something went wrong.");
        return;
      }
      addMessage("assistant", result.reply);
      history.push({ role: "assistant", content: result.reply });
    } catch (err) {
      typingEl.remove();
      addMessage("assistant", "Could not reach Samarth right now. Please try again.");
    }
  });
})();
