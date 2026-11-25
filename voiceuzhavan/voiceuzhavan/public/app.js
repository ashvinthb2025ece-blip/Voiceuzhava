const $ = s => document.querySelector(s);
const LOC = { ta: "ta-IN", hi: "hi-IN", ml: "ml-IN", te: "te-IN", en: "en-IN" };
const EXAMPLES = {
  ta: "என் நெற்பயிருக்கு தண்ணீர் விடலாமா?", hi: "क्या आज खेत में पानी देना चाहिए?",
  ml: "ഇന്ന് കൃഷിക്ക് വെള്ളം നൽകണോ?", te: "ఈ రోజు పంటకు నీరు పెట్టాలా?", en: "Should I irrigate my field today?" };

// ---------- pages ----------
function route() {
  const id = (location.hash || "#home").slice(1);
  document.querySelectorAll(".page").forEach(p => p.classList.toggle("on", p.id === id));
  if (id === "history") renderHistory();
  if (id === "dashboard") pollSensors();
}
addEventListener("hashchange", route); route();

// ---------- chat state ----------
let msgs = [], lastAnswer = "", speaking = false;
const lang = () => $("#lang").value;
function show(role, text) {
  $("#chat .empty")?.remove();
  const d = document.createElement("div"); d.className = "msg " + role; d.textContent = text;
  $("#chat").append(d); $("#chat").scrollTop = 1e9;
}
function notice(t, err) { const n = $("#notice"); n.hidden = !t; n.textContent = t || ""; n.className = "notice" + (err ? " err" : ""); }
function setStatus(t) { $("#status").textContent = t; }
function save() {
  const all = JSON.parse(localStorage.getItem("vu_hist") || "[]");
  all.push({ at: new Date().toLocaleString(), lang: lang(), msgs: msgs.slice(-2) });
  localStorage.setItem("vu_hist", JSON.stringify(all.slice(-200)));
}

async function ask(text) {
  text = text.trim(); if (!text) return;
  msgs.push({ role: "user", content: text }); show("user", text); setStatus("Thinking…");
  try {
    const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: msgs, lang: lang(), sensors: liveSensors() }) });
    const j = await r.json();
    if (!r.ok) {
      msgs.pop();
      notice(j.error === "NO_API_KEY" ? "The AI key is not set on the server. Add GEMINI_API_KEY to the .env file and restart."
        : "AI is not reachable right now (" + (j.detail || j.error) + "). Check internet and try again.", true);
      return setStatus("Ready");
    }
    notice(""); msgs.push({ role: "assistant", content: j.reply }); show("ai", j.reply);
    lastAnswer = j.reply; $("#replay").disabled = false; save(); speak(j.reply);
  } catch (e) { msgs.pop(); notice("Cannot reach the VoiceUzhavan server. Is it running?", true); setStatus("Ready"); }
}

// ---------- text to speech ----------
function speak(t) {
  if (!("speechSynthesis" in window)) return setStatus("Ready (no speech output in this browser)");
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(t), want = LOC[lang()];
  const v = speechSynthesis.getVoices().find(v => v.lang.replace("_", "-").toLowerCase() === want.toLowerCase())
    || speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith(lang()));
  if (!v && lang() !== "en") notice("This device has no " + $("#lang").selectedOptions[0].text + " voice installed. Install one in your phone/PC language settings. The answer is shown as text.");
  if (v) u.voice = v; u.lang = want;
  u.onstart = () => setStatus("Speaking…"); u.onend = u.onerror = () => setStatus("Ready");
  speechSynthesis.speak(u);
}
speechSynthesis?.addEventListener?.("voiceschanged", () => {});
$("#replay").onclick = () => lastAnswer && speak(lastAnswer);

// ---------- speech to text ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, listening = false;
if (!SR) { notice("Voice input is not supported in this browser. Use Chrome or Edge, or type your question below."); $("#mic").disabled = true; }
function startListen() {
  speechSynthesis?.cancel(); rec = new SR(); rec.lang = LOC[lang()]; rec.interimResults = true; rec.maxAlternatives = 1;
  let finalText = "";
  rec.onstart = () => { listening = true; $("#mic").classList.add("on"); $("#wave").classList.add("on"); setStatus("Listening… speak now"); notice(""); };
  rec.onresult = e => { let t = ""; for (const r of e.results) { t += r[0].transcript; if (r.isFinal) finalText = t; } $("#heard").textContent = t; };
  rec.onerror = e => {
    const m = { "not-allowed": "Microphone is blocked. Click the lock icon near the address bar and allow the microphone.",
      "service-not-allowed": "Speech service is blocked in this browser.",
      "no-speech": "I heard nothing. Move closer, reduce background noise and try again.",
      "audio-capture": "No microphone found. Plug one in or check your device.",
      "network": "Speech recognition needs internet. Check your connection.",
      "language-not-supported": "This browser cannot recognise the chosen language. Try Chrome, or type the question." };
    notice(m[e.error] || "Could not understand. Please speak clearly and try again.", true);
  };
  rec.onend = () => { listening = false; $("#mic").classList.remove("on"); $("#wave").classList.remove("on");
    const t = finalText || $("#heard").textContent; $("#heard").textContent = "";
    if (t.trim()) ask(t); else setStatus("Ready"); };
  try { rec.start(); } catch (e) {}
}
$("#mic").onclick = () => listening ? rec.stop() : startListen();
$("#textform").onsubmit = e => { e.preventDefault(); const v = $("#textin").value; $("#textin").value = ""; ask(v); };
$("#clear").onclick = () => { msgs = []; lastAnswer = ""; $("#replay").disabled = true; speechSynthesis?.cancel();
  $("#chat").innerHTML = '<p class="empty">Press the microphone and ask a question.</p>'; notice(""); };
function hint() { $("#examples").textContent = "Try: " + EXAMPLES[lang()]; }
$("#lang").onchange = () => { hint(); notice(""); if (listening) rec.stop(); }; hint();

// ---------- history ----------
function renderHistory() {
  const all = JSON.parse(localStorage.getItem("vu_hist") || "[]").reverse();
  $("#hlist").innerHTML = all.length ? "" : "<p class='empty'>Nothing yet.</p>";
  all.forEach(h => { const d = document.createElement("div"); d.className = "card";
    d.textContent = h.at + " [" + h.lang + "]  Q: " + h.msgs[0]?.content + "  A: " + (h.msgs[1]?.content || ""); $("#hlist").append(d); });
}
$("#h-clear").onclick = () => { localStorage.removeItem("vu_hist"); renderHistory(); };

// ---------- dashboard ----------
const FIELDS = [["soilMoisture", "Soil moisture", "%", 100], ["soilTemp", "Soil temperature", "°C", 50],
  ["ph", "Soil pH", "", 14], ["airTemp", "Air temperature", "°C", 50], ["humidity", "Humidity", "%", 100]];
let sensor = { status: "waiting" }, sim = { soilMoisture: 45, soilTemp: 27, ph: 6.6, airTemp: 31, humidity: 62 }, trend = [];
const liveSensors = () => sensor.status === "connected" ? { live: true, values: sensor.values } : { live: false };
async function pollSensors() {
  try { sensor = await (await fetch("/api/sensors")).json(); } catch { sensor = { status: "disconnected" }; }
  const live = sensor.status === "connected";
  if (!live) FIELDS.forEach(([k, , , max]) => sim[k] = Math.min(max, Math.max(0, sim[k] + (Math.random() - .5) * max * .02)));
  const v = live ? sensor.values : sim;
  const label = { connected: "ESP32 connected", disconnected: "ESP32 disconnected", waiting: "Waiting for ESP32 data" }[sensor.status];
  $("#conn").textContent = label; $("#conn").className = "pill " + (live ? "ok" : sensor.status === "waiting" ? "warn" : "bad");
  $("#simtag").textContent = live ? "" : "SIMULATED readings — not real"; $("#simtag").hidden = live;
  $("#tiles").innerHTML = FIELDS.map(([k, n, u, max]) => v[k] == null ? `<div class="tile">${n}<b>–</b>no sensor</div>` :
    `<div class="tile">${n}<b>${v[k].toFixed(1)}${u}</b><div class="meter"><i style="width:${v[k] / max * 100}%"></i></div></div>`).join("");
  if (v.soilMoisture != null) { trend.push(v.soilMoisture); trend = trend.slice(-40); drawChart(); }
  $("#cropinfo").textContent = localStorage.getItem("vu_crop") || "not set — choose one on the Irrigation page";
}
function drawChart() {
  const c = $("#chart"), g = c.getContext("2d"); g.clearRect(0, 0, c.width, c.height);
  g.strokeStyle = "#7fa650"; g.lineWidth = 3; g.beginPath();
  trend.forEach((y, i) => { const px = i / Math.max(1, trend.length - 1) * (c.width - 20) + 10, py = c.height - 15 - y / 100 * (c.height - 30); i ? g.lineTo(px, py) : g.moveTo(px, py); });
  g.stroke();
}
setInterval(() => { if (location.hash === "#dashboard") pollSensors(); }, 5000);

// ---------- irrigation calculator ----------
const CROPS = { Rice: [1.15, "Keeps fields flooded or very wet in the growing stage; avoid drying at flowering."],
  Maize: [1.1, "Needs steady moisture at tasselling and grain fill; waterlogging harms roots."],
  Groundnut: [1.0, "Light, well-drained soil; avoid water stress at pegging and pod filling."],
  Tomato: [1.05, "Even moisture prevents fruit cracking; drip works well; watch leaf spots in humid weather."],
  Cotton: [1.05, "Deep roots; most sensitive to water stress at flowering and boll formation."],
  Sugarcane: [1.2, "High water need through the long growing season; reduce water before harvest."] };
$("#c-crop").innerHTML = Object.keys(CROPS).map(c => `<option>${c}</option>`).join("");
$("#c-go").onclick = () => {
  const crop = $("#c-crop").value, A = +$("#c-area").value, et = +$("#c-et").value, rain = +$("#c-rain").value, eff = +$("#c-eff").value;
  const mm = Math.max(0, et * CROPS[crop][0] - rain), litres = mm * A / eff;
  localStorage.setItem("vu_crop", crop);
  $("#c-out").textContent = litres <= 0 ? "Rain covers today's need. No irrigation." :
    `About ${Math.round(litres).toLocaleString()} litres today (${mm.toFixed(1)} mm net, ${Math.round(eff * 100)}% efficient). Estimate only.`;
};

// ---------- crop guidance ----------
$("#cropcards").innerHTML = Object.entries(CROPS).map(([n, [, tip]]) =>
  `<div class="card"><b>${n}</b><p>${tip}</p><button class="ghost" data-crop="${n}">Ask by voice</button></div>`).join("");
$("#cropcards").onclick = e => { const c = e.target.dataset.crop; if (!c) return;
  location.hash = "#voice"; ask("Give me simple cultivation guidance for " + c + ". Ask me my growth stage if needed."); };
