#include <Arduino.h>
#include <math.h>
#include <SoftwareSerial.h>

const int MQ7_PIN = A0;
const int MQ135_PIN = A1;

const int ESP_RX_PIN = 2;
const int ESP_TX_PIN = 3;

SoftwareSerial espSerial(ESP_RX_PIN, ESP_TX_PIN);

const int SAMPLE_COUNT = 10;
const unsigned long READ_INTERVAL_MS = 2000;
const int CALIBRATION_SAMPLES = 80;

const float ADC_REF_VOLTAGE = 5.0;
const float ADC_MAX = 1023.0;
const float RL_KOHM = 10.0;

const float MQ7_A = 99.042;
const float MQ7_B = -1.518;
const float MQ135_A = 110.47;
const float MQ135_B = -2.862;
const float MQ7_CLEAN_AIR_RATIO = 27.5;
const float MQ135_CLEAN_AIR_RATIO = 3.6;

unsigned long lastRead = 0;
float mq7R0 = 10.0;
float mq135R0 = 10.0;

float readAveragedAdc(int pin) {
  long total = 0;
  for (int i = 0; i < SAMPLE_COUNT; i++) {
    total += analogRead(pin);
    delay(20);
  }
  return (float)total / SAMPLE_COUNT;
}

float adcToVoltage(float adc) {
  return (adc * ADC_REF_VOLTAGE) / ADC_MAX;
}

float adcToRs(float adc) {
  if (adc < 1.0) adc = 1.0;
  if (adc > ADC_MAX - 1.0) adc = ADC_MAX - 1.0;

  float vrl = adcToVoltage(adc);
  if (vrl < 0.01) vrl = 0.01;
  float rs = ((ADC_REF_VOLTAGE - vrl) * RL_KOHM) / vrl;
  return rs;
}

float rsToPpm(float rs, float r0, float curveA, float curveB) {
  if (r0 <= 0.0) return 0.0;
  float ratio = rs / r0;
  float ppm = curveA * pow(ratio, curveB);
  if (!isfinite(ppm) || ppm < 0.0) ppm = 0.0;
  return ppm;
}

float calibrateR0(int pin, float cleanAirRatio, const char* name) {
  float rsSum = 0.0;
  for (int i = 0; i < CALIBRATION_SAMPLES; i++) {
    float adc = readAveragedAdc(pin);
    rsSum += adcToRs(adc);
    delay(50);
  }

  float rsAvg = rsSum / CALIBRATION_SAMPLES;
  float r0 = rsAvg / cleanAirRatio;

  Serial.print("[CAL] ");
  Serial.print(name);
  Serial.print(" Rs_avg=");
  Serial.print(rsAvg, 3);
  Serial.print("k, R0=");
  Serial.print(r0, 3);
  Serial.println("k");

  if (!isfinite(r0) || r0 <= 0.0) {
    return 10.0;
  }

  return r0;
}

const char* getStatus(float coPpm, float co2Ppm) {
  if (coPpm >= 70.0 || co2Ppm >= 2000.0) return "DANGER";
  if (coPpm >= 35.0 || co2Ppm >= 1000.0) return "WARNING";
  return "NORMAL";
}

void setup() {
  Serial.begin(9600);
  espSerial.begin(9600);
  pinMode(MQ7_PIN, INPUT);
  pinMode(MQ135_PIN, INPUT);

  Serial.println("Vehicle Emission Monitor - Arduino UNO -> ESP8266");
  Serial.println("Warming up MQ sensors for 30 seconds...");
  delay(30000);
  Serial.println("Warmup complete");
  Serial.println("Keep sensors in clean air for calibration...");
  delay(3000);

  mq7R0 = calibrateR0(MQ7_PIN, MQ7_CLEAN_AIR_RATIO, "MQ7");
  mq135R0 = calibrateR0(MQ135_PIN, MQ135_CLEAN_AIR_RATIO, "MQ135");

  Serial.println("Sent to ESP format: DATA,CO_PPM,CO2_PPM,TEMP_C");
}

void loop() {
  unsigned long now = millis();
  if (now - lastRead < READ_INTERVAL_MS) return;
  lastRead = now;

  float mq7Adc = readAveragedAdc(MQ7_PIN);
  float mq135Adc = readAveragedAdc(MQ135_PIN);

  float mq7Rs = adcToRs(mq7Adc);
  float mq135Rs = adcToRs(mq135Adc);

  float coPpm = rsToPpm(mq7Rs, mq7R0, MQ7_A, MQ7_B);
  float co2Ppm = rsToPpm(mq135Rs, mq135R0, MQ135_A, MQ135_B);
  float temperature = 0.0;

  float mq7Voltage = adcToVoltage(mq7Adc);
  float mq135Voltage = adcToVoltage(mq135Adc);
  const char* status = getStatus(coPpm, co2Ppm);

  espSerial.print("DATA,");
  espSerial.print(coPpm, 2);
  espSerial.print(",");
  espSerial.print(co2Ppm, 2);
  espSerial.print(",");
  espSerial.println(temperature, 1);

  Serial.print("CO:");
  Serial.print(coPpm, 2);
  Serial.print(" ppm, CO2:");
  Serial.print(co2Ppm, 2);
  Serial.print(" ppm, Status:");
  Serial.print(status);
  Serial.print(", ADC_MQ7:");
  Serial.print(mq7Adc, 0);
  Serial.print(", Rs_MQ7:");
  Serial.print(mq7Rs, 2);
  Serial.print("k");
  Serial.print(", ADC_MQ135:");
  Serial.print(mq135Adc, 0);
  Serial.print(", Rs_MQ135:");
  Serial.print(mq135Rs, 2);
  Serial.print("k");
  Serial.print(", V_MQ7:");
  Serial.print(mq7Voltage, 3);
  Serial.print("V, V_MQ135:");
  Serial.print(mq135Voltage, 3);
  Serial.print("V, Temp:");
  Serial.print(temperature, 1);
  Serial.println("C");
}
