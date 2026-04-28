# AquaSpec ESP32 Firmware

Reference Arduino sketch for the AquaSpec optical biosensor.

## Hardware

| Item | Notes |
|------|-------|
| ESP32 NodeMCU-32 (38-pin) | Any ESP32 dev board with BLE |
| Common-cathode RGB LED | 4 legs: R, G, B, GND |
| 3× 220 Ω resistors | One for each LED color leg |
| BPW34 photodiode | PIN silicon |
| 1× 1 MΩ resistor | Photodiode load resistor |
| (Optional) 2× 100 kΩ | Battery voltage divider |

## Wiring

```
ESP32 GPIO 25 ──[220 Ω]── R leg of RGB LED
ESP32 GPIO 26 ──[220 Ω]── G leg
ESP32 GPIO 27 ──[220 Ω]── B leg
ESP32 GND     ────────── Common Cathode leg

BPW34 anode  (long leg)  ──── 3.3 V
BPW34 cathode (short leg) ─┬── ESP32 GPIO 34
                            │
                         [1 MΩ]
                            │
                           GND
```

Place LED so it shines through the cuvette holder onto the photodiode.

## Flashing in Arduino IDE

1. **Install ESP32 board support**  
   File → Preferences → *Additional Boards Manager URLs*:  
   `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`  
   Then Tools → Board → Boards Manager → search "esp32" → Install.

2. **Select board**: Tools → Board → ESP32 Arduino → **ESP32 Dev Module**.

3. **Select port**: Tools → Port → your USB COM port.

4. Open `aquaspec_biosensor.ino`, click **Upload (→)**.

5. Open Serial Monitor at **115200 baud**. You should see:
   ```
   AquaSpec Biosensor starting...
   BLE advertising as 'AquaSpec'. Waiting for connection...
   ```

## BLE Protocol

| Characteristic | Properties | Payload |
|---|---|---|
| Measurement Data | NOTIFY (16 bytes, little-endian) | `uint32 t_ms, float32 intensity, float32 blank_I0, float32 absorbance` |
| LED Control | WRITE (2 bytes) | `uint8 led_on, uint8 wavelength` (0=off, 1=R, 2=G, 3=B) |
| Battery | READ + NOTIFY (1 byte) | `uint8 percent` |
| Blank I₀ | WRITE (4 bytes) | `float32` little-endian |

Service UUID: `a1b2c3d4-0001-4000-8000-000000000001`  
(See sketch top for full UUID list — must match the AquaSpec mobile app exactly.)

## Battery monitoring (optional)

By default, the firmware reports 100 %. To enable real battery monitoring:

1. Add a 2-resistor divider:
   ```
   Battery + ──[100 kΩ]──┬── ESP32 GPIO 35
                          │
                       [100 kΩ]
                          │
                         GND
   Battery − ──── ESP32 GND
   ```
2. In `aquaspec_biosensor.ino` change `#define ENABLE_BATTERY 0` → `1`.
3. Re-upload.

## Troubleshooting

- **No BLE device shows up in app** → check Serial Monitor; firmware must print "BLE advertising". Make sure phone Bluetooth + Location permission is granted.
- **Connects but no data** → check photodiode polarity (long leg = anode = 3.3 V).
- **Photodiode reads 4095 always** → too much light or short circuit; verify 1 MΩ resistor is in place.
- **Photodiode reads 0 always** → reversed polarity, or LED not actually shining on it.
- **LED won't light** → confirm common-cathode (not anode) LED, and resistors on each color leg.
- **Reading is 0.000 absorbance** → that's correct when sample intensity ≈ blank intensity. Set blank with empty cuvette first via the app's "Blank I₀" field.

## Calibration

Use the AquaSpec app's **Calibrate** tab to record absorbance against known concentration standards. Save the profile, then activate it for live concentration readout.
