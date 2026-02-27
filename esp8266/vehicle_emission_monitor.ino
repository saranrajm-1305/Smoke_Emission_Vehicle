#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <DHT.h>

const char* WIFI_SSID = "wifi004";
const char* WIFI_PASSWORD = "123456789";
const char* SERVER_URL = "http://10.125.50.164:3000/api/sensor-data";
const char* API_KEY = "veh_emission_2026_secure_9xK4pQ";
const char* DEVICE_ID = "ESP_001";

#define MQ_PIN A0
#define DHTPIN D4
#define DHTTYPE DHT11
#define BUZZER_PIN D5
#define SENSOR_SELECT_PIN D6

const float RO_CLEAN_AIR = 9.83;
const float MQ7_A = 99.042;
const float MQ7_B = -1.518;
const float MQ135_A = 110.47;
const float MQ135_B = -2.862;

const unsigned long POST_INTERVAL = 10000;
const unsigned long WIFI_RETRY_INTERVAL = 5000;

LiquidCrystal_I2C lcd(0x27, 16, 2);
DHT dht(DHTPIN, DHTTYPE);

unsigned long lastPostMillis = 0;
unsigned long lastWifiRetry = 0;

float readSensorRaw(bool coMode) {
  digitalWrite(SENSOR_SELECT_PIN, coMode ? LOW : HIGH);
  delay(120);
  int sensorValue = analogRead(MQ_PIN);
  return (float)sensorValue;
}

float adcToPpm(float adcValue, float A, float B) {
  if (adcValue < 1.0) adcValue = 1.0;
  float ratio = adcValue / RO_CLEAN_AIR;
  float ppm = A * pow(ratio, B);
  if (ppm < 0) ppm = 0;
  return ppm;
}

String getStatus(float co, float co2) {
  if (co >= 70.0 || co2 >= 2000.0) return "DANGER";
  if (co >= 35.0 || co2 >= 1000.0) return "WARN";
  return "OK";
}

void showReconnecting() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("WiFi Disconnected");
  lcd.setCursor(0, 1);
  lcd.print("Reconnecting...");
}

void updateBuzzer(float co, float co2) {
  if (co >= 70.0 || co2 >= 2000.0) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(120);
    digitalWrite(BUZZER_PIN, LOW);
    delay(120);
  } else if (co > 35.0 || co2 > 1000.0) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(300);
    digitalWrite(BUZZER_PIN, LOW);
    delay(300);
  } else {
    digitalWrite(BUZZER_PIN, LOW);
  }
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Connecting WiFi");

  int dot = 0;
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    lcd.setCursor(dot % 16, 1);
    lcd.print(".");
    dot++;
  }

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("WiFi Connected");
  lcd.setCursor(0, 1);
  lcd.print(WiFi.localIP());
  delay(1200);
  lcd.clear();
}

void setup() {
  Serial.begin(74880);
  delay(200);
  Serial.println();
  Serial.println("[BOOT] Vehicle Emission Monitor starting...");
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(SENSOR_SELECT_PIN, OUTPUT);

  lcd.init();
  lcd.backlight();
  dht.begin();

  connectWiFi();
  Serial.print("[WIFI] Connected IP: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    unsigned long now = millis();
    if (now - lastWifiRetry >= WIFI_RETRY_INTERVAL) {
      lastWifiRetry = now;
      showReconnecting();
      WiFi.disconnect();
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    }
    delay(100);
    return;
  }

  float coRaw = readSensorRaw(true);
  float co2Raw = readSensorRaw(false);

  float co_ppm = adcToPpm(coRaw, MQ7_A, MQ7_B);
  float co2_ppm = adcToPpm(co2Raw, MQ135_A, MQ135_B);
  float temperature = dht.readTemperature();
  if (isnan(temperature)) temperature = 0;

  String status = getStatus(co_ppm, co2_ppm);

  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("CO:");
  lcd.print((int)co_ppm);
  lcd.print(" CO2:");
  lcd.print((int)co2_ppm);
  lcd.setCursor(0, 1);
  lcd.print("Temp:");
  lcd.print((int)temperature);
  lcd.print("C ");
  lcd.print(status);

  updateBuzzer(co_ppm, co2_ppm);

  unsigned long now = millis();
  if (now - lastPostMillis >= POST_INTERVAL) {
    lastPostMillis = now;

    WiFiClient client;
    HTTPClient http;
    http.begin(client, SERVER_URL);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-API-KEY", API_KEY);

    String payload = String("{\"device_id\":\"") + DEVICE_ID +
                     "\",\"co_ppm\":" + String(co_ppm, 2) +
                     ",\"co2_ppm\":" + String(co2_ppm, 2) +
                     ",\"temperature\":" + String(temperature, 1) + "}";

    int httpCode = http.POST(payload);
    String response = http.getString();

    Serial.print("HTTP: ");
    Serial.println(httpCode);
    if (httpCode < 0) {
      Serial.print("HTTP ERROR: ");
      Serial.println(http.errorToString(httpCode));
      Serial.println("Check server URL, backend running state, and same WiFi network.");
    }
    Serial.println(response);

    http.end();
  }
}
