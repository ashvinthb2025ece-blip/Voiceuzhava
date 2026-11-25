require("dotenv").config();
const express = require("express");
const path = require("path");
const app = express();
app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

const LANGS = { ta: "Tamil", hi: "Hindi", ml: "Malayalam", te: "Telugu", en: "English" };

// ---------- AI chat (API key stays here, never in the browser) ----------
app.post("/api/chat", async (req, res) => {
  const clean = v => (v || "").trim().replace(/^["']|["']$/g, "");   // removes spaces/quotes pasted by mistake
  const gKey = clean(process.env.GEMINI_API_KEY), aKey = clean(process.env.ANTHROPIC_API_KEY);
  const ok = k => k && !k.startsWith("paste_");
  if (!ok(gKey) && !ok(aKey)) return res.status(503).json({ error: "NO_API_KEY" });
  const { messages = [], lang = "en", sensors = null } = req.body || {};
  const language = LANGS[lang] || "English";
  const live = sensors && sensors.live
    ? "Live ESP32 readings (real): " + JSON.stringify(sensors.values)
    : "No real sensor data is connected. Do not state any soil or weather readings.";
  const system = `You are VoiceUzhavan, a friendly farming assistant for Indian farmers.
Reply ONLY in ${language}, in simple spoken words, max 4 short sentences, no markdown, no lists, no emojis (your answer is read aloud).
Topics: irrigation, soil, crop diseases, fertilizer, weather, cultivation, government schemes, market prices.
Rules: never invent sensor readings, weather forecasts or market prices; if asked, say you cannot see live data and tell where to check (local mandi, IMD, Agmarknet, KVK).
Ask one follow-up question if you need crop, stage, soil type or location. For serious disease or pesticide doses, advise a local agriculture officer.
${live}`;
  const hist = messages.slice(-12).map(m => ({ role: m.role, content: String(m.content).slice(0, 1000) }));
  try {
    let r, data, reply;
    if (ok(gKey)) {   // FREE option: Google Gemini (key from aistudio.google.com)
      const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": gKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: hist.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
          generationConfig: { maxOutputTokens: 1000 } })
      });
      data = await r.json();
      reply = data.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("");
      if (r.ok && !reply) return res.status(502).json({ error: "AI_ERROR", detail: "empty answer, try again" });
    } else {          // Paid option: Anthropic
      r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "content-type": "application/json", "x-api-key": aKey, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6", max_tokens: 500, system, messages: hist })
      });
      data = await r.json();
      reply = data.content?.map(c => c.text || "").join("");
    }
    if (!r.ok) {
      const detail = r.status === 429 ? "free limit reached, wait a minute and try again"
        : r.status === 400 && /key/i.test((data.error && data.error.message) || "") ? "Gemini rejected the key: copy it again from aistudio.google.com/apikey into .env (no spaces or quotes) and restart the server"
        : data.error && data.error.message;
      return res.status(502).json({ error: "AI_ERROR", detail });
    }
    res.json({ reply });
  } catch (e) { res.status(502).json({ error: "NETWORK", detail: e.message }); }
});

// ---------- ESP32 over HTTP ----------
let latest = null; // { values, at }
app.post("/api/sensors", (req, res) => {
  if (req.get("x-device-key") !== process.env.DEVICE_KEY) return res.status(401).json({ error: "bad key" });
  const b = req.body || {};
  const num = k => (typeof b[k] === "number" && isFinite(b[k]) ? b[k] : null);
  latest = { at: Date.now(), values: {
    soilMoisture: num("soilMoisture"), soilTemp: num("soilTemp"), ph: num("ph"),
    airTemp: num("airTemp"), humidity: num("humidity") } };
  res.json({ ok: true });
});
app.get("/api/sensors", (req, res) => {
  let status = "waiting";
  if (latest) status = Date.now() - latest.at < 30000 ? "connected" : "disconnected";
  res.json({ status, ...(latest || {}) });
});

app.listen(process.env.PORT || 3000, () =>
  console.log("VoiceUzhavan running: http://localhost:" + (process.env.PORT || 3000)));
