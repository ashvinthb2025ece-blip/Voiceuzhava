// ESP32 -> VoiceUzhavan (HTTP). Install board "esp32" in Arduino IDE.
// Replace the YOUR_* values. SERVER = your PC's IP on the same Wi-Fi, e.g. http://192.168.1.10:3000
#include <WiFi.h>
#include <HTTPClient.h>
const char* SSID = "YOUR_WIFI";
const char* PASS = "YOUR_PASSWORD";
const char* SERVER = "http://YOUR_PC_IP:3000/api/sensors";
const char* DEVICE_KEY = "change-this-secret";   // same as DEVICE_KEY in .env
const int SOIL_PIN = 34;                          // soil moisture AO
const int DRY = 3200, WET = 1400;                 // calibrate: raw value in dry air / in water

void setup() { Serial.begin(115200); WiFi.begin(SSID, PASS);
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); } }

void loop() {
  int raw = analogRead(SOIL_PIN);
  float moist = constrain((float)(DRY - raw) * 100.0 / (DRY - WET), 0, 100);
  // Only send sensors you really have. Add DS18B20/DHT22/pH fields here once wired and tested.
  String body = "{\"soilMoisture\":" + String(moist, 1) + "}";
  HTTPClient http; http.begin(SERVER);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_KEY);
  Serial.println(http.POST(body)); http.end();
  delay(10000);
}
