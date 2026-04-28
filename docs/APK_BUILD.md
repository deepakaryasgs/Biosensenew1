# AquaSpec — Android APK Build Guide

This guide walks you through generating an installable `.apk` for your Android phone using **Expo EAS Build**.

> ⚠️ Real BLE (`react-native-ble-plx`) **does not work in Expo Go**. You must build a dev/preview APK to test against the actual ESP32 biosensor. The APK below is what you'll side-load onto your Android phone.

---

## Prerequisites

1. **Free Expo account** — sign up at https://expo.dev/signup
2. **Node.js 18+** on your computer
3. **Project source code** — push from Emergent ("Save to GitHub") or download zip

---

## Step 1 — Install EAS CLI on your computer

```bash
npm install -g eas-cli
eas login        # use your Expo account
```

---

## Step 2 — From inside `/app/frontend` directory

```bash
cd frontend
yarn install
eas init                 # creates a new EAS project (one-time)
```

When prompted, accept the default project name. This will set `expo.extra.eas.projectId` in `app.json`.

---

## Step 3 — Build the APK

There are two profiles already configured in `eas.json`:

### A. Preview / shareable APK (recommended first)
```bash
eas build -p android --profile preview
```
- Output: a single `.apk` file you can install on any Android phone.
- Build runs on Expo's servers (free tier covers your first builds).
- Takes ~10–15 min.
- When done, EAS shows a **download link**.

### B. Production AAB (for Play Store later)
```bash
eas build -p android --profile production
```
- Output: `.aab` (Android App Bundle) — required by Google Play, not directly installable.

---

## Step 4 — Install the APK on your phone

1. Open the EAS download URL on your Android phone (or email/AirDrop the .apk file).
2. Allow "Install from unknown sources" when prompted.
3. Tap the downloaded .apk → Install → Open.

---

## Step 5 — First run

1. Power on your ESP32 with the AquaSpec firmware flashed.
2. Open the AquaSpec app on your phone.
3. Grant **Bluetooth** and **Location** permissions when prompted (Android 12+ requires Location for BLE scanning).
4. Tap **Connect Device** → Tap **SCAN FOR DEVICES**.
5. Your ESP32 should appear as **"AquaSpec"** in the list.
6. Tap to connect → wait for "Connected" confirmation.
7. Go to **Measure** tab → tap **Red/Green/Blue** to switch the actual LED on the biosensor.
8. Tap **Start** → real absorbance data streams in.

---

## Re-building after code changes

Any time you change app code:
```bash
eas build -p android --profile preview
```
A new APK will be built with your changes. Install over the existing one — your saved measurements, calibrations, and settings are preserved.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build fails with "Project not found" | Run `eas init` again inside `/app/frontend` |
| App crashes on launch | Check that `react-native-ble-plx` plugin is in `app.json` (it is, by default) |
| BLE scan returns nothing | Grant Location permission; turn Bluetooth + Location ON in Android settings |
| Won't see ESP32 in scan | Confirm Serial Monitor shows "BLE advertising"; reset ESP32 |
| LED tap does nothing on real device | Ensure firmware UUIDs match `/app/frontend/src/ble.ts` exactly (they do by default) |

---

## Costs & free tier

- **Free EAS tier**: limited builds per month (currently 30 priority builds/mo on free, more on paid plans).
- **Side-loading APK**: free — no Google Play account needed for personal use.
- **Google Play publishing**: $25 one-time (only if you want public distribution).

Done. You now have a real APK that talks to your real biosensor.
