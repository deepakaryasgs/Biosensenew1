# ESP32 Biosensor BLE Protocol

## Overview
The AquaSpec mobile app expects the ESP32 firmware to expose a Generic GATT server advertising the services/characteristics below. All fields are little-endian unless noted.

## Suggested BLE Service

- **Service UUID**: `aquaspec-0001-biosensor-service-000000000000` (use your own 128-bit UUID in firmware; configure it identically in the mobile app for real BLE builds.)

### Characteristics

| Purpose | Properties | Payload |
|---------|-----------|---------|
| Measurement Data | NOTIFY | `{ t_ms: uint32, intensity: float32, intensity_blank: float32, absorbance: float32 }` 16 bytes |
| LED Control | WRITE | `{ led_on: uint8, wavelength: uint8 (0=fixed,1=red,2=green,3=blue), custom_nm: uint16 }` |
| Calibration Data | WRITE | `{ model: uint8, degree: uint8, coeffs: float32[<=6] }` |
| Battery Status | NOTIFY / READ | `uint8 percent` |
| Device Config | READ / WRITE | `{ led_type: uint8 (0=fixed,1=rgb), installed_nm: uint16 }` |

## Absorbance
`A = log10(I0 / I)` (calculated on device or on app; app recalculates if `absorbance` is 0)

## Concentration
Computed on the mobile app using the currently active calibration profile:
- Linear: `c = (A - a0) / a1`
- Polynomial degree n: solve `A = Σ ai · c^i` via bisection over the standards range.

## Demo Mode
In Demo Mode the app generates synthetic telemetry with no hardware requirement:
- Target absorbance oscillates around 0.4 with slow drift + noise
- Blank intensity I₀ configurable in Settings

## Notes
- `react-native-ble-plx` requires a **dev build** or standalone build (not available in Expo Go). When running in Expo Go, the app automatically falls back to Demo Mode.
- On iOS make sure `NSBluetoothAlwaysUsageDescription` is set (see `app.json` once you prebuild).
- On Android request `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, and (below API 31) location permissions.
