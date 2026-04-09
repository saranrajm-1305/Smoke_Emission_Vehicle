#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <SoftwareSerial.h>

const char* WIFI_SSID = "rika";
const char* WIFI_PASSWORD = "Sharu1234";
const char* SERVER_URL = "https://smokeemissionvehicle-production.up.railway.app/api/sensor-data";
const char* API_KEY = "veh_emission_2026_secure_9xK4pQ";
const char* DEVICE_ID = "ESP_001";

const uint8_t UNO_RX_PIN = D6;
const uint8_t UNO_TX_PIN = D5;

SoftwareSerial unoSerial(UNO_RX_PIN, UNO_TX_PIN);

String serialLine;
unsigned long lastWifiRetry = 0;
const unsigned long WIFI_RETRY_INTERVAL = 5000;
const unsigned long WIFI_CONNECT_TIMEOUT = 20000;

const char* wifiStatusToText(wl_status_t status) {
  switch (status) {
    case WL_IDLE_STATUS: return "IDLE";
    case WL_NO_SSID_AVAIL: return "NO_SSID";
    case WL_SCAN_COMPLETED: return "SCAN_DONE";
    case WL_CONNECTED: return "CONNECTED";
    case WL_CONNECT_FAILED: return "CONNECT_FAILED";
    case WL_CONNECTION_LOST: return "CONNECTION_LOST";
    case WL_DISCONNECTED: return "DISCONNECTED";
    default: return "UNKNOWN";
  }
}

bool parseDataLine(const String& line, float& coPpm, float& co2Ppm, float& temperature) {
  if (!line.startsWith("DATA,")) {
    return false;
  }

  int p1 = line.indexOf(',');
  int p2 = line.indexOf(',', p1 + 1);
  int p3 = line.indexOf(',', p2 + 1);

  if (p1 < 0 || p2 < 0 || p3 < 0) {
    return false;
  }

  String coStr = line.substring(p1 + 1, p2);
  String co2Str = line.substring(p2 + 1, p3);
  String tempStr = line.substring(p3 + 1);

  coPpm = coStr.toFloat();
  co2Ppm = co2Str.toFloat();
  temperature = tempStr.toFloat();

  return true;
}

bool connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.persistent(false);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("[WIFI] Connecting to: ");
  Serial.println(WIFI_SSID);
  Serial.print("[WIFI] Connecting");
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - start > WIFI_CONNECT_TIMEOUT) {
      Serial.println();
      Serial.print("[WIFI] Timeout. Status: ");
      Serial.println(wifiStatusToText((wl_status_t)WiFi.status()));
      return false;
    }
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("[WIFI] Connected IP: ");
  Serial.println(WiFi.localIP());
  return true;
}

void postSensorData(float coPpm, float co2Ppm, float temperature) {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  http.begin(client, SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-KEY", API_KEY);

  String payload = String("{\"device_id\":\"") + DEVICE_ID +
                   "\",\"co_ppm\":" + String(coPpm, 2) +
                   ",\"co2_ppm\":" + String(co2Ppm, 2) +
                   ",\"temperature\":" + String(temperature, 1) + "}";

  int httpCode = http.POST(payload);
  String response = http.getString();

  Serial.print("[HTTP] Code: ");
  Serial.println(httpCode);
  Serial.print("[HTTP] Response: ");
  Serial.println(response);

  if (httpCode < 0) {
    Serial.print("[HTTP] Error: ");
    Serial.println(http.errorToString(httpCode));
  }

  http.end();
}

void setup() {
  Serial.begin(74880);
  unoSerial.begin(9600);

  Serial.println();
  Serial.println("[BOOT] ESP8266 Uno bridge starting...");
  connectWiFi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    unsigned long now = millis();
    if (now - lastWifiRetry >= WIFI_RETRY_INTERVAL) {
      lastWifiRetry = now;
      Serial.println("[WIFI] Reconnecting...");
      WiFi.disconnect();
      connectWiFi();
    }
    delay(50);
    return;
  }

  while (unoSerial.available()) {
    char c = (char)unoSerial.read();

    if (c == '\r') {
      continue;
    }

    if (c == '\n') {
      if (serialLine.length() > 0) {
        float coPpm = 0;
        float co2Ppm = 0;
        float temperature = 0;

        Serial.print("[UART] ");
        Serial.println(serialLine);

        if (parseDataLine(serialLine, coPpm, co2Ppm, temperature)) {
          postSensorData(coPpm, co2Ppm, temperature);
        } else {
          Serial.println("[UART] Invalid line format");
        }

        serialLine = "";
      }
    } else {
      serialLine += c;
      if (serialLine.length() > 120) {
        serialLine = "";
      }
    }
  }
}
