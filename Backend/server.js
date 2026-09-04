/* ============================================================
 * VittaSetu backend entry point
 * ============================================================ */

require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth");
const transactionRoutes = require("./routes/transactions");
const loanRoutes = require("./routes/loan");
const chatRoutes = require("./routes/chat");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Basic protection against brute-force / abuse on auth + chat endpoints.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });
const chatLimiter = rateLimit({ windowMs: 60 * 1000, max: 20 });

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/loan", loanRoutes);
app.use("/api/chat", chatLimiter, chatRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true, service: "vittasetu-backend" }));

// Serve the frontend (the /public folder from the previous step).
const FRONTEND_DIR = path.join(__dirname, "..", "public");
app.use(express.static(FRONTEND_DIR));

// Fallback 404 for unknown API routes.
app.use("/api", (req, res) => res.status(404).json({ error: "Not found." }));

app.listen(PORT, () => {
  console.log(`VittaSetu backend running at http://localhost:${PORT}`);
});
