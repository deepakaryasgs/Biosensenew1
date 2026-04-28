# AquaSpec — Portable Water-Quality Biosensor Companion (Production)

## Product Overview
Cross-platform Expo React Native (Android + iOS) app that pairs over Bluetooth Low Energy with an ESP32-powered optical biosensor. Reads transmitted-light intensity from a BPW34 photodiode, computes absorbance via Beer–Lambert (A = log₁₀(I₀/I)), converts to contaminant concentration with user-defined calibration curves, and stores/exports results — fully offline.

## Hardware Stack
| Component | Notes |
|---|---|
| ESP32 NodeMCU-32 (38-pin) | BLE GATT server, runs `aquaspec_biosensor.ino` |
| Common-cathode RGB LED | GPIO 25 (R) / 26 (G) / 27 (B), each with 220 Ω resistor |
| BPW34 photodiode | Anode → 3.3 V, cathode → GPIO 34 with 1 MΩ load to GND |
| (Optional) Battery monitor | 100 kΩ : 100 kΩ divider → GPIO 35 |

## BLE Protocol (App ↔ ESP32)
| Characteristic | Properties | Payload |
|---|---|---|
| Measurement Data | NOTIFY | 16 bytes LE: `u32 t_ms, f32 intensity, f32 blank_I0, f32 absorbance` |
| LED Control | WRITE | 2 bytes: `u8 led_on, u8 wavelength (0=off,1=R,2=G,3=B)` |
| Battery | READ + NOTIFY | 1 byte: `u8 percent` |
| Blank I₀ | WRITE | 4 bytes: `f32` |

Service UUID: `a1b2c3d4-0001-4000-8000-000000000001`

## App Features
### Connectivity (real BLE)
- Filtered scan by AquaSpec Service UUID via `react-native-ble-plx`.
- Auto-subscribe to Measurement Data + Battery characteristics on connect.
- Live battery readout, connection status badge.
- Optional Demo Mode toggle for offline UI exploration.

### Measurement
- Beer–Lambert absorbance from intensity stream (every 200 ms).
- Live tabular-num readouts: Absorbance, Intensity, Concentration.
- Start / Pause / Resume / Stop controls.
- Threshold badges: Safe / Warning / Critical from active calibration.
- **RGB LED control** — Red/Green/Blue taps send WRITE to ESP32 → physical LED switches.
- LED ON/OFF toggle sends real BLE write.

### Calibration
- Linear, Polynomial (deg 2–4), Manual (slope/intercept) regression.
- Live R² and equation preview, scatter + fit curve.
- Save/activate multiple profiles per contaminant.

### History & Detail
- All measurements in AsyncStorage (offline-first).
- Search + Safe/Warning/Critical filter chips.
- Detail screen with Absorbance·t / Concentration·t graph toggle.

### Export
- CSV with full metadata header + per-sample series via native share sheet.
- PNG of the chart via `react-native-view-shot`.

### Settings
- Dark / Light theme toggle (persisted).
- Operator name, thresholds, unit, blank intensity.
- Demo Mode toggle.

## Repository Layout
```
/app/frontend/
  app/                            # expo-router screens
    _layout.tsx                   # Theme + Store providers
    index.tsx                     # Splash
    (tabs)/                       # Bottom-tabs: dashboard/measure/calibrate/history/settings
    connect.tsx                   # BLE scan + pair
    measurement/[id].tsx          # Detail + export
  src/
    ble.ts                        # BLE service (real + demo)
    store.tsx                     # AsyncStorage persistence
    regression.ts                 # Linear / Polynomial / Manual fits
    Chart.tsx                     # SVG live + scatter chart
    ThemeContext.tsx              # Dark/Light theme
  app.json                        # Expo config + BLE plugin + Android permissions
  eas.json                        # Build profiles (preview APK + production AAB)
/app/esp32-firmware/
  aquaspec_biosensor.ino          # Arduino sketch (one-click upload)
  README.md                       # Wiring + flashing guide
/app/docs/
  ESP32_BLE_PROTOCOL.md           # BLE characteristic spec
  APK_BUILD.md                    # EAS build walkthrough
```

## Smart Business Enhancement
**One-tap Compliance Report** — bundle batch measurements with operator + GPS + calibration + Safe/Warning/Critical counts into a signed PDF/CSV. Targets municipal water audits (EPA / WHO / BIS) and is a natural upsell from a free instrument driver.

## End-to-End Flow (real hardware)
1. Flash `aquaspec_biosensor.ino` to ESP32 once via Arduino IDE.
2. Build APK via `eas build -p android --profile preview`.
3. Side-load APK on Android phone.
4. Power on ESP32 → app scan finds "AquaSpec" → tap to connect.
5. Tap Red/Green/Blue → physical LED on biosensor switches.
6. Set blank cuvette → set I₀ → place sample → Start → real absorbance streams in.
7. Save → History → Export CSV via share sheet.

## Known Limitations
- BLE only available in dev/preview/production builds — Expo Go falls back to Demo Mode automatically.
- Battery monitoring requires extra divider (disabled by default; firmware reports 100%).
- iOS bundle id set to `com.aquaspec.app` — change before App Store submission.
