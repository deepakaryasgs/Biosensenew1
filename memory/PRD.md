# AquaSpec — Portable Water-Quality Biosensor Companion

## Product Overview
AquaSpec is a cross-platform Expo React Native mobile app that pairs with a portable ESP32-powered optical biosensor. It converts transmitted light intensity measured through a sample cuvette into absorbance (Beer–Lambert) and then into contaminant concentration using user-defined calibration curves. Designed for field technicians and lab operators; runs fully offline.

## Target Users
- Field water-quality technicians (low-light portable usage)
- Lab operators running enzymatic assays with spectrophotometric readout
- Researchers iterating calibration curves across contaminants / wavelengths

## Core User Journeys
1. Configure LED type + operator in Settings.
2. Create a calibration profile with standards → activate it.
3. Open Measure → connect device (BLE or Demo) → set blank intensity → Start → Stop & Save.
4. Review, filter, and export measurements (CSV / PNG share) from History.

## Feature Set (MVP delivered)
### Connectivity
- BLE scanning and pairing with ESP32 (native dev build) via `react-native-ble-plx`.
- Transparent fallback to Demo Mode inside Expo Go or runtimes without native BLE.
- Device status badge (Connected / Offline), battery readout, demo toggle.

### Measurement
- Real-time intensity → absorbance computation with `A = log10(I0 / I)`.
- Live tabular-num readouts: Absorbance (OD), Intensity, Concentration.
- Start / Pause / Resume / Stop controls.
- Threshold badge: Safe / Warning / Critical.
- LED on/off + RGB color (Red / Green / Blue) with approximate wavelength labels; or fixed wavelength entry.
- Live SVG chart (Absorbance vs time).

### Calibration
- Linear, Polynomial (deg 2-4), and Manual (slope/intercept) models.
- Dynamic standards table, live R² and regression equation preview.
- Save multiple profiles with contaminant and unit metadata; one active at a time.
- Scatter + fit curve preview chart.

### History & Detail
- All measurements stored in `AsyncStorage` (offline-first).
- Filter by safe/warning/critical; search by sample ID / contaminant / operator / notes.
- Detail screen toggles between Absorbance·t and Concentration·t graphs; shows calibration metadata.

### Export
- CSV export with full metadata header + per-sample time series.
- PNG export of the graph via `react-native-view-shot` + native share sheet (`expo-sharing`), with a browser-download fallback for web.

### Settings
- Dark / Light theme toggle (persisted).
- Operator name, LED type (RGB or fixed wavelength in nm), thresholds, unit, blank intensity.

## Technical Architecture
- **Expo SDK**: 54 (file-based routing via `expo-router`).
- **State**: React Context + AsyncStorage (no backend).
- **BLE**: `react-native-ble-plx` (lazy-required; Demo fallback).
- **Charts**: custom `react-native-svg` line/scatter chart (works in Expo Go, no native build needed).
- **Storage**: AsyncStorage for measurements, calibrations, settings, theme, active calibration.
- **Export**: `expo-file-system` + `expo-sharing` + `react-native-view-shot`.
- **Icons**: `@expo/vector-icons` (MaterialCommunityIcons).

## BLE Protocol
See `/app/docs/ESP32_BLE_PROTOCOL.md`.

## Smart Business Enhancement (scope expansion idea)
Introduce a one-tap **"Shareable Compliance Report"** — when a field technician completes a batch of measurements, the app can bundle them into a signed PDF/CSV with operator, GPS coordinates, calibration equations, and Safe/Warning/Critical status counts. This is a natural upsell for municipal contracts and regulatory audits (EPA, BIS, WHO guideline reporting) and distinguishes AquaSpec from a plain instrument driver.

## Known Limitations
- Real BLE only works in a **dev build** (Expo Go lacks the native module). App auto-falls back to Demo Mode.
- Cloud sync deferred per user choice (offline-first MVP).
