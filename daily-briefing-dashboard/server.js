import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { execFile } from "child_process";
import { fileURLToPath } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 8080;

const MCP_GATEWAY_URL = process.env.MCP_GATEWAY_URL || "http://127.0.0.1:8000";

const DASHBOARD_ORIGIN = process.env.DASHBOARD_ORIGIN || "http://localhost:8080";

app.use(cors({ origin: DASHBOARD_ORIGIN }));
app.use(express.json());
// Serve the React build (dist/) when available, fall back to the legacy public/ folder.
const DIST_DIR   = path.join(__dirname, "dist");
const PUBLIC_DIR = path.join(__dirname, "public");
const SERVE_DIR  = fs.existsSync(path.join(DIST_DIR, "index.html")) ? DIST_DIR : PUBLIC_DIR;
app.use(express.static(SERVE_DIR));

// Security headers
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

let mcpClient = null;
let isConnected = false;

async function initMcpClient() {
  try {
    console.log(`Connecting to MCP Gateway at ${MCP_GATEWAY_URL} ...`);

    const transport = new SSEClientTransport(new URL(`${MCP_GATEWAY_URL}/sse`));

    mcpClient = new Client(
      { name: "briefing-dashboard-client", version: "1.0.0" },
      { capabilities: {} }
    );

    await mcpClient.connect(transport);
    isConnected = true;
    console.log("✅ Connected to MCP Gateway via SSE");
  } catch (error) {
    console.error("❌ Failed to connect to MCP Gateway:", error.message);
    isConnected = false;
    setTimeout(initMcpClient, 5000);
  }
}

initMcpClient();

// API Endpoints

app.get("/api/status", (req, res) => {
  res.json({
    connected: isConnected,
    gatewayUrl: MCP_GATEWAY_URL,
    timestamp: new Date().toISOString(),
  });
});

// Expose gateway URL to the frontend (so the Google auth redirect can target the gateway directly)
app.get("/api/config/gateway-url", (req, res) => {
  res.json({ url: MCP_GATEWAY_URL });
});

app.get("/api/weather", async (req, res) => {
  if (!isConnected || !mcpClient) {
    return res.status(503).json({ error: "MCP Gateway not connected" });
  }

  const location = req.query.location || "Bengaluru";

  try {
    const response = await mcpClient.callTool({
      name: "get_weather",
      arguments: { location },
    });

    if (response.isError) {
      const directData = await fetchWttrInDirect(location);
      return res.json(directData);
    }

    res.json(response);
  } catch (error) {
    console.error("MCP weather error, falling back to direct wttr.in:", error.message);
    try {
      const directData = await fetchWttrInDirect(location);
      res.json(directData);
    } catch (fallbackErr) {
      res.status(500).json({ error: "Failed to fetch weather", details: fallbackErr.message });
    }
  }
});

function fetchWttrInDirect(location) {
  return new Promise((resolve, reject) => {
    const query = encodeURIComponent(location);
    const url = `https://wttr.in/${query}?format=j1`;

    execFile(
      "curl",
      ["-s", "--max-time", "12", "-H", "Accept: application/json", "-A", "curl/7.88.1", url],
      { timeout: 15000 },
      (err, stdout) => {
        if (err) return reject(new Error(`curl failed: ${err.message}`));
        try {
          const data = JSON.parse(stdout);
          const current = data.current_condition?.[0];
          const area = data.nearest_area?.[0];
          if (!current || !area) return reject(new Error("Invalid wttr.in response"));

          const areaName = area.areaName?.[0]?.value || "";
          const country = area.country?.[0]?.value || "";
          const resolvedName = `${areaName}${country ? ", " + country : ""}`.trim();

          const text =
            `\u{1F326}️ Weather for **${resolvedName}**:\n\n` +
            `• **Condition:** ${current.weatherDesc?.[0]?.value || "Unknown"}\n` +
            `• **Temperature:** ${current.temp_C}°C\n` +
            `• **Feels Like:** ${current.FeelsLikeC}°C\n` +
            `• **Humidity:** ${current.humidity}%\n` +
            `• **Precipitation:** ${current.precipMM} mm\n` +
            `• **Wind Speed:** ${current.windspeedKmph} km/h\n` +
            `• **Data Source:** wttr.in\n`;

          resolve({ content: [{ type: "text", text }], isError: false });
        } catch (parseErr) {
          reject(new Error(`Failed to parse wttr.in response: ${parseErr.message}`));
        }
      }
    );
  });
}

app.get("/api/calendar", async (req, res) => {
  if (!isConnected || !mcpClient) {
    return res.status(503).json({ error: "MCP Gateway not connected" });
  }

  try {
    const daysAhead = parseInt(req.query.daysAhead) || 1;
    const maxResults = parseInt(req.query.maxResults) || 15;

    const response = await mcpClient.callTool({
      name: "calendar_list_events",
      arguments: { days_ahead: daysAhead, max_results: maxResults, calendar_id: "primary" },
    });

    res.json(response);
  } catch (error) {
    console.error("Calendar MCP error:", error.message);
    res.status(500).json({ error: "Failed to fetch calendar events", details: error.message });
  }
});

app.get("/api/gmail", async (req, res) => {
  if (!isConnected || !mcpClient) {
    return res.status(503).json({ error: "MCP Gateway not connected" });
  }

  try {
    const maxResults = parseInt(req.query.maxResults) || 15;

    const response = await mcpClient.callTool({
      name: "gmail_list_latest",
      arguments: { max_results: maxResults },
    });

    res.json(response);
  } catch (error) {
    console.error("Gmail MCP error:", error.message);
    res.status(500).json({ error: "Failed to fetch emails", details: error.message });
  }
});

app.get("/api/stocks", async (req, res) => {
  if (!isConnected || !mcpClient) {
    return res.status(503).json({ error: "MCP Gateway not connected" });
  }

  try {
    const symbolsParam = req.query.symbols;
    const symbols = symbolsParam ? symbolsParam.split(",").map((s) => s.trim()) : undefined;

    const response = await mcpClient.callTool({
      name: "get_stocks",
      arguments: { symbols },
    });

    res.json(response);
  } catch (error) {
    console.error("Stocks MCP error:", error.message);
    res.status(500).json({ error: "Failed to fetch stocks", details: error.message });
  }
});

app.get("/api/celebrations", async (req, res) => {
  if (!isConnected || !mcpClient) {
    return res.status(503).json({ error: "MCP Gateway not connected" });
  }
  try {
    const response = await mcpClient.callTool({
      name: "calendar_list_events",
      arguments: { days_ahead: 2, max_results: 50, calendar_id: "primary" },
    });

    const text = response.content?.[0]?.text || "";
    const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time

    const celebrations = [];
    // Split on event bullets and process each block
    const blocks = text.split(/(?=•\s+\*\*)/);
    for (const block of blocks) {
      const titleMatch = block.match(/^•\s+\*\*(.+?)\*\*/);
      if (!titleMatch) continue;

      // Only include events whose start date is today
      const startMatch = block.match(/\*\*Start:\*\*\s*([\d-]+)/);
      if (startMatch) {
        const eventDate = startMatch[1].slice(0, 10); // YYYY-MM-DD
        if (eventDate !== todayStr) continue;
      }

      const eventTitle = titleMatch[1].trim();
      const tl = eventTitle.toLowerCase();

      let type = null;
      if (tl.includes("birthday")) type = "birthday";
      else if (tl.includes("anniversary")) type = "anniversary";
      if (!type) continue;

      const subType = tl.includes("work")
        ? "work-anniversary"
        : tl.includes("wedding")
          ? "wedding-anniversary"
          : type;

      const name =
        eventTitle
          .replace(/\b(happy|birthday|anniversary|work|wedding|celebration|day)\b/gi, "")
          .replace(/'s\s*/g, "")
          .replace(/[-–—:,!]/g, " ")
          .replace(/\s+/g, " ")
          .trim() || "Friend";

      celebrations.push({ name, type, subType, eventTitle });
    }
    res.json(celebrations);
  } catch (error) {
    console.error("Celebrations MCP error:", error.message);
    res.status(500).json({ error: "Failed to fetch celebrations", details: error.message });
  }
});

// ── Config / Auth proxy ────────────────────────────────────────────────────────

app.get("/api/config/auth/status", async (req, res) => {
  try {
    const r = await fetch(`${MCP_GATEWAY_URL}/auth/status`);
    res.status(r.status).json(await r.json());
  } catch (err) {
    res.status(503).json({ error: "Gateway unreachable", details: err.message });
  }
});

app.delete("/api/config/auth/token", async (req, res) => {
  try {
    const r = await fetch(`${MCP_GATEWAY_URL}/auth/token`, { method: "DELETE" });
    res.status(r.status).json(await r.json());
  } catch (err) {
    res.status(503).json({ error: "Gateway unreachable", details: err.message });
  }
});

app.get("/api/config/sheets", async (req, res) => {
  try {
    const r = await fetch(`${MCP_GATEWAY_URL}/config/sheets`);
    res.status(r.status).json(await r.json());
  } catch (err) {
    res.status(503).json({ error: "Gateway unreachable", details: err.message });
  }
});

app.post("/api/config/sheets/:id", async (req, res) => {
  try {
    const r = await fetch(`${MCP_GATEWAY_URL}/config/sheets/${req.params.id}`, {
      method: "POST",
    });
    res.status(r.status).json(await r.json());
  } catch (err) {
    res.status(503).json({ error: "Gateway unreachable", details: err.message });
  }
});

// ── IndMoney proxy ────────────────────────────────────────────────────────────

app.get("/api/indmoney", async (req, res) => {
  try {
    const r = await fetch(`${MCP_GATEWAY_URL}/indmoney/data`);
    res.status(r.status).json(await r.json());
  } catch (err) {
    res.status(503).json({ error: "Gateway unreachable", details: err.message });
  }
});

app.get("/api/indmoney/overview", async (req, res) => {
  try {
    const r = await fetch(`${MCP_GATEWAY_URL}/indmoney/overview`);
    res.status(r.status).json(await r.json());
  } catch (err) {
    res.status(503).json({ error: "Gateway unreachable", details: err.message });
  }
});

app.get("/api/config/indmoney/status", async (req, res) => {
  try {
    const r = await fetch(`${MCP_GATEWAY_URL}/config/indmoney/status`);
    res.status(r.status).json(await r.json());
  } catch (err) {
    res.status(503).json({ error: "Gateway unreachable", details: err.message });
  }
});

app.post("/api/config/indmoney/save", async (req, res) => {
  try {
    const r = await fetch(`${MCP_GATEWAY_URL}/config/indmoney/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    res.status(r.status).json(await r.json());
  } catch (err) {
    res.status(503).json({ error: "Gateway unreachable", details: err.message });
  }
});

app.delete("/api/config/indmoney/token", async (req, res) => {
  try {
    const r = await fetch(`${MCP_GATEWAY_URL}/auth/indmoney/token`, { method: "DELETE" });
    res.status(r.status).json(await r.json());
  } catch (err) {
    res.status(503).json({ error: "Gateway unreachable", details: err.message });
  }
});

// ── LLM wish generation ───────────────────────────────────────────────────────

const LLM_DEFAULT_MODELS = {
  openai:    'gpt-4o-mini',
  anthropic: 'claude-haiku-4-5-20251001',
  custom:    'gpt-4o-mini',
}

// Returns configured state from env without exposing the key
app.get('/api/config/llm/env-status', (req, res) => {
  const configured = !!(process.env.LLM_API_KEY || process.env.LLM_BASE_URL)
  res.json({ configured, provider: process.env.LLM_PROVIDER || null })
})

// POST { name, type, subType, llmConfig?: { provider, apiKey, model, baseUrl } }
// llmConfig from request takes precedence over .env values
app.post('/api/wishes/generate', async (req, res) => {
  const { name, type, subType, llmConfig } = req.body || {}

  const provider = llmConfig?.provider || process.env.LLM_PROVIDER || 'openai'
  const apiKey   = llmConfig?.apiKey   || process.env.LLM_API_KEY  || ''
  const model    = llmConfig?.model    || process.env.LLM_MODEL    || LLM_DEFAULT_MODELS[provider] || 'gpt-4o-mini'
  const baseUrl  = llmConfig?.baseUrl  || process.env.LLM_BASE_URL || ''

  if (!apiKey && !baseUrl) {
    return res.json({ messages: null, source: 'none', reason: 'No LLM configured' })
  }

  const celebType =
    type === 'birthday'             ? 'birthday' :
    subType === 'work-anniversary'  ? 'work anniversary' : 'anniversary'

  const prompt =
    `Write 3 distinct, heartfelt ${celebType} messages for ${name}.\n` +
    `Requirements:\n` +
    `- Each message 2–4 sentences, warm and personal\n` +
    `- Include relevant emojis\n` +
    `- Make each message clearly different in tone: one emotional/heartfelt, one fun/celebratory, one inspirational\n` +
    `Return ONLY valid JSON with no extra text: {"messages":["msg1","msg2","msg3"]}`

  try {
    let messages
    if (provider === 'anthropic') {
      messages = await llmCallAnthropic(apiKey, model, prompt)
    } else {
      const url = baseUrl
        ? `${baseUrl.replace(/\/$/, '')}/chat/completions`
        : 'https://api.openai.com/v1/chat/completions'
      messages = await llmCallOpenAI(url, apiKey, model, prompt)
    }
    res.json({ messages, source: 'ai' })
  } catch (err) {
    console.error('LLM wish generation failed:', err.message)
    res.json({ messages: null, source: 'error', reason: err.message })
  }
})

async function llmCallOpenAI(url, apiKey, model, prompt) {
  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  const r = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'You are a warm, thoughtful assistant. Always respond with valid JSON only — no markdown, no extra text.' },
        { role: 'user',   content: prompt },
      ],
      temperature: 0.85,
      max_tokens: 900,
    }),
  })
  if (!r.ok) {
    const body = await r.text()
    throw new Error(`LLM API ${r.status}: ${body.slice(0, 200)}`)
  }
  const d = await r.json()
  return llmParseMessages(d.choices?.[0]?.message?.content || '')
}

async function llmCallAnthropic(apiKey, model, prompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!r.ok) {
    const body = await r.text()
    throw new Error(`Anthropic API ${r.status}: ${body.slice(0, 200)}`)
  }
  const d = await r.json()
  return llmParseMessages(d.content?.[0]?.text || '')
}

function llmParseMessages(text) {
  const match = text.match(/\{[\s\S]*"messages"[\s\S]*\}/)
  if (!match) throw new Error('No JSON object found in LLM response')
  const parsed = JSON.parse(match[0])
  if (!Array.isArray(parsed.messages) || !parsed.messages.length)
    throw new Error('messages array missing or empty')
  return parsed.messages.slice(0, 3).filter(m => typeof m === 'string' && m.trim())
}

app.get("*", (req, res) => {
  res.sendFile(path.join(SERVE_DIR, "index.html"));
});

app.listen(PORT, () => {
  console.log(`🚀 Daily Briefing Dashboard running at http://localhost:${PORT}`);
});
