#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <SoftwareSerial.h>

const char* WIFI_SSID = "rika";
const char* WIFI_PASSWORD = "Sharu1234";
const char* SERVER_URL = "http://192.168.37.164:3000/api/sensor-data";
const char* API_KEY = "veh_emission_2026_secure_9xK4pQ";
const char* DEVICE_ID = "ESP_001";

// UNO TX -> ESP8266 D6 (GPIO12) [RX]
// ESP8266 D5 (GPIO14) [TX] -> UNO RX (optional, currently unused)
const uint8_t UNO_RX_PIN = D6;
const uint8_t UNO_TX_PIN = D5;

SoftwareSerial unoSerial(UNO_RX_PIN, UNO_TX_PIN);

String serialLine;
unsigned long lastWifiRetry = 0;
const unsigned long WIFI_RETRY_INTERVAL = 5000;

bool parseDataLine(const String& line, float& coPpm, float& co2Ppm, float& temperature) {
  if (!line.startsWith("DATA,")) {
    return false;
  }

  int p1 = line.indexOf(',');
  int p2 = line.indexOf(',', p1 + 1);
  int p3 = line.indexOf(',', p2 + 1);

  if (p1 < 0 || p2 < 0) {
    return false;
  }

  String coStr = line.substring(p1 + 1, p2);
  String co2Str;
  String tempStr;

  if (p3 < 0) {
    // Backward compatibility with older UNO payload: DATA,CO_PPM,CO2_PPM
    co2Str = line.substring(p2 + 1);
    tempStr = "0";
  } else {
    co2Str = line.substring(p2 + 1, p3);
    tempStr = line.substring(p3 + 1);
  }

  coPpm = coStr.toFloat();
  co2Ppm = co2Str.toFloat();
  temperature = tempStr.toFloat();

  return true;
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  Serial.print("[WIFI] Connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.print("[WIFI] Connected IP: ");
  Serial.println(WiFi.localIP());
}

void postSensorData(float coPpm, float co2Ppm, float temperature) {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  WiFiClient client;
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
  Serial.begin(9600);
  unoSerial.begin(9600);

  Serial.println();
  Serial.println("[BOOT] ESP8266 serial bridge starting...");
  connectWiFi();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    unsigned long now = millis();
    if (now - lastWifiRetry >= WIFI_RETRY_INTERVAL) {
      lastWifiRetry = now;
      Serial.println("[WIFI] Reconnecting...");
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
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
