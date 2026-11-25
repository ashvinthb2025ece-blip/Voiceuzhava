# VoiceUzhavan – setup (beginner steps)

1. Install **Node.js (LTS)** from nodejs.org. Install **VS Code** from code.visualstudio.com.
2. In VS Code: File > Open Folder > choose this `voiceuzhavan` folder.
3. Open the terminal: Terminal > New Terminal. Run: `npm install`
4. Copy `.env.example` to `.env` (right-click > Copy, Paste, rename). Get a FREE Gemini key at aistudio.google.com/apikey and paste it after `GEMINI_API_KEY=`. Change DEVICE_KEY to your own secret.
5. Run: `npm start`, then open http://localhost:3000 in **Chrome or Edge**.

## What needs what
- Voice input (microphone): Chrome/Edge + internet (the browser sends audio to Google). Allow microphone when asked. Works on localhost.
- Spoken answers: a voice for the language must exist on your device (Android/Windows language settings). Without it you get text only; the app tells you.
- AI answers: internet + free Gemini key. Free tier has per-minute/per-day limits that Google changes; if you see "free limit reached", wait and retry. If the model name stops working, change GEMINI_MODEL in .env to another Flash model listed in AI Studio. Free tier may be unavailable in some countries.
- Dashboard: SIMULATED (labelled) until an ESP32 posts real data.
- ESP32: open `esp32/esp32_http.ino` in Arduino IDE, fill Wi-Fi and your PC's IP, same DEVICE_KEY. Only soil moisture is sent; add other sensors only after you test each one.

## Not included yet
MQTT, database (Firebase/Supabase), cloud speech-to-text for languages Chrome can't recognise, live weather/market prices (by design, nothing is invented).
