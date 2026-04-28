/* AquaSpec Biosensor Firmware
 * Target: ESP32 NodeMCU-32 (38-pin) — Arduino IDE
 *
 * Hardware wiring (default pin map — change defines below if your build differs):
 *
 *                       ┌──────────────────┐
 *   ESP32 GPIO 25 ──[220Ω]── R leg of common-cathode RGB LED
 *   ESP32 GPIO 26 ──[220Ω]── G leg
 *   ESP32 GPIO 27 ──[220Ω]── B leg
 *   ESP32 GND     ────────── Common Cathode leg
 *
 *   BPW34 photodiode:
 *     anode  (long leg)  ─────────── 3.3V
 *     cathode (short leg) ─┬──────── ESP32 GPIO 34 (ADC1_CH6)
 *                          │
 *                       [1 MΩ]
 *                          │
 *                         GND
 *
 *   (Battery monitor is OPTIONAL — disabled by default; set ENABLE_BATTERY 1
 *    after wiring two 100k resistors in a divider on GPIO 35.)
 *
 * Required Arduino setup:
 *   1. File → Preferences → Additional Boards Manager URLs:
 *        https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
 *   2. Tools → Board → ESP32 Arduino → ESP32 Dev Module
 *   3. Tools → Port → (your COM port)
 *   4. Click Upload (→). Open Serial Monitor at 115200 baud.
 *
 * No external libraries needed — uses ESP32 stock BLE stack.
 */

#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <math.h>

// ============== PIN MAP ==============
#define PIN_LED_R   25
#define PIN_LED_G   26
#define PIN_LED_B   27
#define PIN_PHOTO   34   // ADC1_CH6 — input only

#define ENABLE_BATTERY 0
#define PIN_BATT       35   // ADC1_CH7 — voltage divider midpoint

// ============== UUIDs (must match mobile app /app/frontend/src/ble.ts) ==============
#define SERVICE_UUID       "a1b2c3d4-0001-4000-8000-000000000001"
#define CHAR_MEASURE_UUID  "a1b2c3d4-0002-4000-8000-000000000002"
#define CHAR_LED_UUID      "a1b2c3d4-0003-4000-8000-000000000003"
#define CHAR_BATT_UUID     "a1b2c3d4-0004-4000-8000-000000000004"
#define CHAR_BLANK_UUID    "a1b2c3d4-0005-4000-8000-000000000005"

// ============== Globals ==============
BLEServer*         pServer        = nullptr;
BLECharacteristic* pCharMeasure   = nullptr;
BLECharacteristic* pCharBatt      = nullptr;
bool               bleConnected   = false;
bool               oldConnected   = false;

float    g_blankIntensity = 1000.0f;        // I0, configurable via BLE write
uint8_t  g_ledWavelength  = 2;              // 0=off,1=red,2=green,3=blue
bool     g_ledOn          = true;
uint32_t g_t0_ms          = 0;              // session start
uint32_t g_lastSample_ms  = 0;
uint32_t g_lastBatt_ms    = 0;

// ============== Helpers ==============
void applyLed() {
  // All off first
  digitalWrite(PIN_LED_R, LOW);
  digitalWrite(PIN_LED_G, LOW);
  digitalWrite(PIN_LED_B, LOW);
  if (!g_ledOn) return;
  switch (g_ledWavelength) {
    case 1: digitalWrite(PIN_LED_R, HIGH); break;
    case 2: digitalWrite(PIN_LED_G, HIGH); break;
    case 3: digitalWrite(PIN_LED_B, HIGH); break;
    default: break;
  }
}

float readPhotodiode() {
  // Average 16 samples for noise reduction
  uint32_t sum = 0;
  for (int i = 0; i < 16; i++) {
    sum += analogRead(PIN_PHOTO);
    delayMicroseconds(50);
  }
  return (float)(sum / 16);
}

uint8_t readBatteryPercent() {
#if ENABLE_BATTERY
  // 100k:100k divider → ADC reads battery/2.
  // ESP32 ADC reference ~3.3V, 12-bit (0..4095).
  uint16_t raw = analogRead(PIN_BATT);
  float v_adc  = (raw / 4095.0f) * 3.3f;
  float v_batt = v_adc * 2.0f;
  // Map 3.0V (0%) → 4.2V (100%) Li-ion
  float pct = (v_batt - 3.0f) / 1.2f * 100.0f;
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  return (uint8_t)pct;
#else
  return 100;
#endif
}

// ============== BLE callbacks ==============
class ServerCB : public BLEServerCallbacks {
  void onConnect(BLEServer*) override { bleConnected = true; }
  void onDisconnect(BLEServer*) override { bleConnected = false; }
};

class LedCB : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* c) override {
    String v = c->getValue();
    if (v.length() >= 2) {
      g_ledOn          = v[0] != 0;
      g_ledWavelength  = (uint8_t)v[1];
      applyLed();
      Serial.printf("LED write: on=%d wavelength=%d\n", g_ledOn, g_ledWavelength);
    }
  }
};

class BlankCB : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic* c) override {
    String v = c->getValue();
    if (v.length() >= 4) {
      float f;
      memcpy(&f, v.c_str(), 4);
      if (f > 0) {
        g_blankIntensity = f;
        Serial.printf("Blank I0 set to: %.2f\n", f);
      }
    }
  }
};

// ============== Setup ==============
void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("\nAquaSpec Biosensor starting...");

  pinMode(PIN_LED_R, OUTPUT);
  pinMode(PIN_LED_G, OUTPUT);
  pinMode(PIN_LED_B, OUTPUT);
  applyLed();

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);  // ~0..3.3V range

  BLEDevice::init("AquaSpec");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCB());

  BLEService* svc = pServer->createService(SERVICE_UUID);

  // Measurement Data — NOTIFY
  pCharMeasure = svc->createCharacteristic(
    CHAR_MEASURE_UUID,
    BLECharacteristic::PROPERTY_NOTIFY | BLECharacteristic::PROPERTY_READ);
  pCharMeasure->addDescriptor(new BLE2902());

  // LED Control — WRITE
  BLECharacteristic* pCharLed = svc->createCharacteristic(
    CHAR_LED_UUID, BLECharacteristic::PROPERTY_WRITE);
  pCharLed->setCallbacks(new LedCB());

  // Battery — READ + NOTIFY
  pCharBatt = svc->createCharacteristic(
    CHAR_BATT_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pCharBatt->addDescriptor(new BLE2902());
  uint8_t b0 = readBatteryPercent();
  pCharBatt->setValue(&b0, 1);

  // Blank intensity — WRITE
  BLECharacteristic* pCharBlank = svc->createCharacteristic(
    CHAR_BLANK_UUID, BLECharacteristic::PROPERTY_WRITE);
  pCharBlank->setCallbacks(new BlankCB());

  svc->start();

  BLEAdvertising* adv = BLEDevice::getAdvertising();
  adv->addServiceUUID(SERVICE_UUID);
  adv->setScanResponse(true);
  adv->setMinPreferred(0x06);
  BLEDevice::startAdvertising();

  g_t0_ms = millis();
  Serial.println("BLE advertising as 'AquaSpec'. Waiting for connection...");
}

// ============== Loop ==============
void loop() {
  uint32_t now = millis();

  // Sample every 200 ms
  if (bleConnected && (now - g_lastSample_ms >= 200)) {
    g_lastSample_ms = now;
    float intensity = readPhotodiode();
    if (intensity < 1.0f) intensity = 1.0f;  // avoid div-by-zero / log(0)
    float absorbance = log10f(g_blankIntensity / intensity);

    // Pack 16 bytes little-endian: u32 t_ms, f32 I, f32 I0, f32 A
    uint8_t payload[16];
    uint32_t t_rel = now - g_t0_ms;
    memcpy(payload + 0,  &t_rel,            4);
    memcpy(payload + 4,  &intensity,        4);
    memcpy(payload + 8,  &g_blankIntensity, 4);
    memcpy(payload + 12, &absorbance,       4);
    pCharMeasure->setValue(payload, 16);
    pCharMeasure->notify();
  }

  // Battery notify every 10 s
  if (bleConnected && (now - g_lastBatt_ms >= 10000)) {
    g_lastBatt_ms = now;
    uint8_t b = readBatteryPercent();
    pCharBatt->setValue(&b, 1);
    pCharBatt->notify();
  }

  // Re-advertise on disconnect
  if (!bleConnected && oldConnected) {
    delay(500);
    pServer->startAdvertising();
    Serial.println("Re-advertising...");
  }
  oldConnected = bleConnected;

  delay(10);
}
