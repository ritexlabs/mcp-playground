import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env") });

const app               = express();
const PORT              = process.env.PORT || 8080;
const MCP_GATEWAY_URL   = (process.env.MCP_GATEWAY_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const GATEWAY_API_TOKEN = process.env.GATEWAY_API_TOKEN || "";
const DASHBOARD_ORIGIN  = process.env.DASHBOARD_ORIGIN || "http://localhost:8080";

app.use(cors({ origin: DASHBOARD_ORIGIN }));
app.use(express.json());

const DIST_DIR   = path.join(__dirname, "dist");
const PUBLIC_DIR = path.join(__dirname, "public");

// Auto-build the React app if dist/ is missing so the server always serves
// the latest UI without requiring a manual "npm run build" step after a fresh clone.
if (!fs.existsSync(path.join(DIST_DIR, "index.html"))) {
  console.log("[server] dist/ not found — running npm run build...");
  try {
    execSync("npm run build", { cwd: __dirname, stdio: "inherit" });
    console.log("[server] build complete.");
  } catch (e) {
    console.error("[server] build failed — falling back to public/", e.message);
  }
}

const SERVE_DIR = fs.existsSync(path.join(DIST_DIR, "index.html")) ? DIST_DIR : PUBLIC_DIR;
app.use(express.static(SERVE_DIR));

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// ── Local endpoints (not proxied) ─────────────────────────────────────────────

app.get("/api/status", async (_req, res) => {
  try {
    const r = await fetch(`${MCP_GATEWAY_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    res.json({ connected: r.ok, gatewayUrl: MCP_GATEWAY_URL, timestamp: new Date().toISOString() });
  } catch {
    res.json({ connected: false, gatewayUrl: MCP_GATEWAY_URL, timestamp: new Date().toISOString() });
  }
});

app.get("/api/config/gateway-url", (_req, res) => {
  res.json({ url: MCP_GATEWAY_URL });
});

// ── LLM wish generation (local — uses API key from dashboard .env) ────────────

const LLM_DEFAULT_MODELS = {
  openai:    "gpt-4o-mini",
  anthropic: "claude-haiku-4-5-20251001",
  custom:    "gpt-4o-mini",
};

app.get("/api/config/llm/env-status", (_req, res) => {
  const configured = !!(process.env.LLM_API_KEY || process.env.LLM_BASE_URL);
  res.json({ configured, provider: process.env.LLM_PROVIDER || null });
});

app.post("/api/wishes/generate", async (req, res) => {
  const { name, type, subType, llmConfig } = req.body || {};
  const provider = llmConfig?.provider || process.env.LLM_PROVIDER || "openai";
  const apiKey   = llmConfig?.apiKey   || process.env.LLM_API_KEY  || "";
  const model    = llmConfig?.model    || process.env.LLM_MODEL    || LLM_DEFAULT_MODELS[provider] || "gpt-4o-mini";
  const baseUrl  = llmConfig?.baseUrl  || process.env.LLM_BASE_URL || "";

  if (!apiKey && !baseUrl) {
    return res.json({ messages: null, source: "none", reason: "No LLM configured" });
  }

  const celebType =
    type === "birthday"            ? "birthday" :
    subType === "work-anniversary" ? "work anniversary" : "anniversary";

  const prompt =
    `Write 3 distinct, heartfelt ${celebType} messages for ${name}.\n` +
    `Requirements:\n` +
    `- Each message 2–4 sentences, warm and personal\n` +
    `- Include relevant emojis\n` +
    `- Make each message clearly different in tone: one emotional/heartfelt, one fun/celebratory, one inspirational\n` +
    `Return ONLY valid JSON with no extra text: {"messages":["msg1","msg2","msg3"]}`;

  try {
    let messages;
    if (provider === "anthropic") {
      messages = await _llmAnthropic(apiKey, model, prompt);
    } else {
      const url = baseUrl
        ? `${baseUrl.replace(/\/$/, "")}/chat/completions`
        : "https://api.openai.com/v1/chat/completions";
      messages = await _llmOpenAI(url, apiKey, model, prompt);
    }
    res.json({ messages, source: "ai" });
  } catch (err) {
    console.error("LLM wish generation failed:", err.message);
    res.json({ messages: null, source: "error", reason: err.message });
  }
});

async function _llmOpenAI(url, apiKey, model, prompt) {
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  const r = await fetch(url, {
    method: "POST", headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You are a warm, thoughtful assistant. Always respond with valid JSON only — no markdown, no extra text." },
        { role: "user",   content: prompt },
      ],
      temperature: 0.85, max_tokens: 900,
    }),
  });
  if (!r.ok) throw new Error(`LLM API ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return _parseMessages((await r.json()).choices?.[0]?.message?.content || "");
}

async function _llmAnthropic(apiKey, model, prompt) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 900, messages: [{ role: "user", content: prompt }] }),
  });
  if (!r.ok) throw new Error(`Anthropic API ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return _parseMessages((await r.json()).content?.[0]?.text || "");
}

function _parseMessages(text) {
  const match = text.match(/\{[\s\S]*"messages"[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in LLM response");
  const parsed = JSON.parse(match[0]);
  if (!Array.isArray(parsed.messages) || !parsed.messages.length)
    throw new Error("messages array missing or empty");
  return parsed.messages.slice(0, 3).filter(m => typeof m === "string" && m.trim());
}

// ── MCP Gateway proxy ─────────────────────────────────────────────────────────
// All /api/* routes not handled above are forwarded to the MCP gateway.

function _gwHeaders() {
  const h = { "Content-Type": "application/json" };
  if (GATEWAY_API_TOKEN) h["Authorization"] = `Bearer ${GATEWAY_API_TOKEN}`;
  return h;
}

async function _proxy(req, res, gwPath, method, body) {
  try {
    const r = await fetch(`${MCP_GATEWAY_URL}${gwPath}`, {
      method: method || req.method,
      headers: _gwHeaders(),
      body,
      signal: AbortSignal.timeout(30000),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    res.status(503).json({ error: "Gateway unreachable", details: err.message });
  }
}

// Data endpoints
app.get("/api/weather",      (req, res) => _proxy(req, res, `/api/weather?${new URLSearchParams(req.query)}`));
app.get("/api/calendar",     (req, res) => _proxy(req, res, `/api/calendar?${new URLSearchParams(req.query)}`));
app.get("/api/gmail",        (req, res) => _proxy(req, res, `/api/gmail?${new URLSearchParams(req.query)}`));
app.get("/api/stocks",       (req, res) => _proxy(req, res, `/api/stocks?${new URLSearchParams(req.query)}`));
app.get("/api/celebrations", (req, res) => _proxy(req, res, "/api/celebrations"));

// IndMoney
app.get("/api/indmoney",          (req, res) => _proxy(req, res, "/api/indmoney"));
app.get("/api/indmoney/overview", (req, res) => _proxy(req, res, "/api/indmoney/overview"));

// WhatsApp
app.get("/api/whatsapp/status",       (req, res) => _proxy(req, res, "/api/whatsapp/status"));
app.get("/api/whatsapp/messages",     (req, res) => _proxy(req, res, "/api/whatsapp/messages"));
app.post("/api/whatsapp/reply",       (req, res) => _proxy(req, res, "/api/whatsapp/reply",     "POST", JSON.stringify(req.body)));
app.post("/api/whatsapp/mark-read",   (req, res) => _proxy(req, res, "/api/whatsapp/mark-read", "POST", JSON.stringify(req.body)));

// Tunnel
app.get("/api/tunnel/status",    (req, res) => _proxy(req, res, "/api/tunnel/status"));
app.post("/api/tunnel/start",    (req, res) => _proxy(req, res, "/api/tunnel/start", "POST"));
app.post("/api/tunnel/stop",     (req, res) => _proxy(req, res, "/api/tunnel/stop",  "POST"));

// Auth (proxied so frontend doesn't need to know the gateway URL directly)
app.get("/api/config/auth/status",       (req, res) => _proxy(req, res, "/auth/status"));
app.delete("/api/config/auth/token",     (req, res) => _proxy(req, res, "/auth/token", "DELETE"));
app.get("/api/config/sheets",            (req, res) => _proxy(req, res, "/config/sheets"));
app.post("/api/config/sheets/:id",       (req, res) => _proxy(req, res, `/config/sheets/${req.params.id}`, "POST"));
app.get("/api/config/indmoney/status",   (req, res) => _proxy(req, res, "/config/indmoney/status"));
app.post("/api/config/indmoney/save",    (req, res) => _proxy(req, res, "/config/indmoney/save", "POST", JSON.stringify(req.body)));
app.delete("/api/config/indmoney/token", (req, res) => _proxy(req, res, "/auth/indmoney/token", "DELETE"));

// ── SPA fallback ──────────────────────────────────────────────────────────────

app.get("*", (_req, res) => {
  res.sendFile(path.join(SERVE_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 Daily Briefing Dashboard → http://localhost:${PORT}`);
  console.log(`   MCP Gateway              → ${MCP_GATEWAY_URL}`);
});
