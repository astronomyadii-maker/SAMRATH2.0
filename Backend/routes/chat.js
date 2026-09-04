/* ============================================================
 * /api/chat — "Samarth", the VittaSetu assistant
 *
 * Calls OpenRouter's chat-completions API SERVER-SIDE, using the
 * key from .env. The key is never sent to, or readable by, the
 * browser — the frontend only ever talks to this route.
 * ============================================================ */

const express = require("express");
const fetch = require("node-fetch");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT = `You are Samarth, the in-app assistant for VittaSetu, a banking platform for small
Indian enterprises (sole proprietors, partnerships, private limited companies, LLPs).
You help users understand their account, transactions, loan eligibility, and EMI
calculations, and you explain banking terms in plain language.
Keep replies short and practical. If asked for financial advice beyond what the app's
own data can support (e.g. legal or tax advice), say so plainly and suggest they
consult a qualified professional. Never invent account numbers, balances, or
transaction data — only use figures the user or the app has actually given you in
this conversation.`;

/* ---------- POST /api/chat — send a message, get Samarth's reply ---------- */
// requireAuth is optional here — swap the line below to require login if you want
// every chat tied to a signed-in user (needed to let Samarth see real account data).
router.post("/", requireAuth, async (req, res) => {
  const { message, history } = req.body || {};

  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Type a message first." });
  }
  if (!process.env.OPENROUTER_API_KEY) {
    return res.status(500).json({ error: "Samarth isn't configured yet — missing OPENROUTER_API_KEY." });
  }

  // Keep only the last few turns so requests stay small and cheap.
  const recentHistory = Array.isArray(history) ? history.slice(-8) : [];

  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...recentHistory
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
      .map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message.trim() },
  ];

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        // OpenRouter asks for these two for attribution; harmless to include.
        "HTTP-Referer": "https://vittasetu.local",
        "X-Title": "VittaSetu - Samarth Assistant",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
        messages,
        temperature: 0.4,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenRouter error:", response.status, errText);
      return res.status(502).json({ error: "Samarth is having trouble reaching the AI service right now." });
    }

    const data = await response.json();
    const reply = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : "Sorry, I couldn't generate a reply just now.";

    // Store the exchange so a transcript is available later.
    const insert = db.prepare(
      "INSERT INTO chat_messages (user_id, role, content) VALUES (?, ?, ?)"
    );
    insert.run(req.user.id, "user", message.trim());
    insert.run(req.user.id, "assistant", reply);

    res.json({ reply });
  } catch (err) {
    console.error("Chat route error:", err);
    res.status(500).json({ error: "Something went wrong talking to Samarth." });
  }
});

/* ---------- GET /api/chat/history — past messages for this user ---------- */
router.get("/history", requireAuth, (req, res) => {
  const rows = db.prepare(
    "SELECT role, content, created_at FROM chat_messages WHERE user_id = ? ORDER BY id ASC LIMIT 100"
  ).all(req.user.id);
  res.json({ messages: rows });
});

module.exports = router;
