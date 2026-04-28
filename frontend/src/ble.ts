// AquaSpec BLE service — real ESP32 communication + optional demo fallback.
// Protocol matches /app/esp32-firmware/aquaspec_biosensor.ino exactly.
import { Platform } from 'react-native';

// ===== UUIDs (must match firmware) =====
export const AQUA_SERVICE_UUID = 'a1b2c3d4-0001-4000-8000-000000000001';
export const CHAR_MEASURE_UUID = 'a1b2c3d4-0002-4000-8000-000000000002';
export const CHAR_LED_UUID = 'a1b2c3d4-0003-4000-8000-000000000003';
export const CHAR_BATT_UUID = 'a1b2c3d4-0004-4000-8000-000000000004';
export const CHAR_BLANK_UUID = 'a1b2c3d4-0005-4000-8000-000000000005';

export interface BleDevice {
  id: string;
  name: string;
  rssi?: number;
  isDemo?: boolean;
}

export interface Sample {
  t: number;
  intensity: number;
  intensityBlank?: number;
  absorbance: number;
}

export type Wavelength = 'red' | 'green' | 'blue' | 'off';

type Listener = (s: Sample) => void;

// Lazy-require so Expo Go web preview doesn't crash
let BleManagerCtor: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require('react-native-ble-plx');
  BleManagerCtor = m.BleManager;
} catch {
  BleManagerCtor = null;
}

export const isBleNativeAvailable = () =>
  !!BleManagerCtor && Platform.OS !== 'web';

// ---- base64 helpers (ble-plx uses base64 strings) ----
function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob !== 'undefined') {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Buffer = require('buffer').Buffer;
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa !== 'undefined') {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Buffer = require('buffer').Buffer;
  return Buffer.from(bytes).toString('base64');
}

// Parse 16-byte measurement payload (little-endian):
// uint32 t_ms, float32 intensity, float32 intensity_blank, float32 absorbance
function parseMeasurement(b64: string): Sample | null {
  const bytes = base64ToBytes(b64);
  if (bytes.length < 16) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const t_ms = dv.getUint32(0, true);
  const intensity = dv.getFloat32(4, true);
  const intensityBlank = dv.getFloat32(8, true);
  const absorbance = dv.getFloat32(12, true);
  return {
    t: t_ms / 1000,
    intensity,
    intensityBlank,
    absorbance,
  };
}

export class BleService {
  private manager: any = null;
  private device: any = null;
  private connected: BleDevice | null = null;
  private listeners: Listener[] = [];
  private subscription: any = null;
  private demoInterval: any = null;
  private running = false;
  private paused = false;
  private t0 = 0;
  private I0 = 1000;
  private wavelength: Wavelength = 'green';
  private batteryPercent = 0;
  private batterySub: any = null;

  isDemoMode = false;

  setDemoMode(v: boolean) {
    this.isDemoMode = v;
  }
  setBlank(i0: number) {
    this.I0 = i0;
    if (this.connected && !this.connected.isDemo) {
      this.writeBlank(i0).catch(() => {});
    }
  }
  getConnected() {
    return this.connected;
  }
  getBatteryLevel() {
    if (this.connected?.isDemo) return 82;
    return this.batteryPercent;
  }

  private getManager() {
    if (!this.manager && BleManagerCtor) this.manager = new BleManagerCtor();
    return this.manager;
  }

  // ---- Scan ----
  async scan(onFound: (d: BleDevice) => void, timeoutMs = 5000): Promise<void> {
    if (this.isDemoMode || !isBleNativeAvailable()) {
      const demoDevices: BleDevice[] = [
        { id: 'demo-esp32-a', name: 'BioSensor ESP32 (Demo)', rssi: -45, isDemo: true },
      ];
      return new Promise((resolve) => {
        let i = 0;
        const push = () => {
          if (i < demoDevices.length) {
            onFound(demoDevices[i++]);
            setTimeout(push, 300);
          } else resolve();
        };
        push();
      });
    }
    const mgr = this.getManager();
    if (!mgr) throw new Error('BLE manager unavailable');
    const seen = new Set<string>();
    return new Promise((resolve, reject) => {
      mgr.startDeviceScan([AQUA_SERVICE_UUID], null, (error: any, dev: any) => {
        if (error) {
          mgr.stopDeviceScan();
          reject(error);
          return;
        }
        if (dev && !seen.has(dev.id)) {
          seen.add(dev.id);
          onFound({
            id: dev.id,
            name: dev.name || dev.localName || 'AquaSpec BLE',
            rssi: dev.rssi,
          });
        }
      });
      setTimeout(() => {
        mgr.stopDeviceScan();
        resolve();
      }, timeoutMs);
    });
  }

  // ---- Connect ----
  async connect(d: BleDevice): Promise<void> {
    if (d.isDemo || this.isDemoMode) {
      this.connected = d;
      return;
    }
    const mgr = this.getManager();
    if (!mgr) throw new Error('BLE not available');
    const dev = await mgr.connectToDevice(d.id, { timeout: 10000 });
    await dev.discoverAllServicesAndCharacteristics();
    this.device = dev;
    this.connected = { id: dev.id, name: dev.name || 'AquaSpec', rssi: d.rssi };

    // Subscribe battery notifications
    try {
      this.batterySub = dev.monitorCharacteristicForService(
        AQUA_SERVICE_UUID,
        CHAR_BATT_UUID,
        (err: any, ch: any) => {
          if (err || !ch?.value) return;
          const bytes = base64ToBytes(ch.value);
          if (bytes.length >= 1) this.batteryPercent = bytes[0];
        },
      );
    } catch {}
  }

  async disconnect(): Promise<void> {
    this.stop();
    if (this.batterySub) {
      try { this.batterySub.remove(); } catch {}
      this.batterySub = null;
    }
    if (this.device) {
      try { await this.device.cancelConnection(); } catch {}
      this.device = null;
    }
    this.connected = null;
    this.batteryPercent = 0;
  }

  // ---- Data subscription ----
  onData(cb: Listener) {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  start() {
    if (this.running && !this.paused) return;
    this.running = true;
    this.paused = false;
    this.t0 = Date.now();

    if (this.connected?.isDemo || this.isDemoMode || !this.device) {
      // Demo path
      if (this.demoInterval) clearInterval(this.demoInterval);
      this.demoInterval = setInterval(() => {
        if (!this.running || this.paused) return;
        const t = (Date.now() - this.t0) / 1000;
        const targetA = 0.4 + 0.15 * Math.sin(t / 8) + (Math.random() - 0.5) * 0.03;
        const I = this.I0 * Math.pow(10, -targetA);
        const sample: Sample = { t, intensity: Math.max(0, I), intensityBlank: this.I0, absorbance: targetA };
        this.listeners.forEach((l) => l(sample));
      }, 200);
      return;
    }

    // Real BLE path: subscribe to Measurement Data notifications
    try {
      this.subscription = this.device.monitorCharacteristicForService(
        AQUA_SERVICE_UUID,
        CHAR_MEASURE_UUID,
        (err: any, ch: any) => {
          if (err || !ch?.value || !this.running || this.paused) return;
          const sample = parseMeasurement(ch.value);
          if (sample) {
            // Re-base timestamp from session start for chart
            sample.t = (Date.now() - this.t0) / 1000;
            this.listeners.forEach((l) => l(sample));
          }
        },
      );
    } catch (e) {
      console.warn('monitor failed', e);
    }
  }

  pause() { this.paused = true; }
  resume() { this.paused = false; }

  stop() {
    this.running = false;
    this.paused = false;
    if (this.demoInterval) {
      clearInterval(this.demoInterval);
      this.demoInterval = null;
    }
    if (this.subscription) {
      try { this.subscription.remove(); } catch {}
      this.subscription = null;
    }
  }

  isRunning() { return this.running && !this.paused; }

  // ---- LED control (WRITE to ESP32) ----
  // Payload: [led_on(uint8), wavelength(uint8 0=off,1=red,2=green,3=blue)]
  async setWavelength(w: Wavelength) {
    this.wavelength = w;
    if (this.isDemoMode || !this.device || this.connected?.isDemo) return;
    const map: Record<Wavelength, number> = { off: 0, red: 1, green: 2, blue: 3 };
    const wByte = map[w];
    const ledOn = w === 'off' ? 0 : 1;
    const payload = new Uint8Array([ledOn, wByte]);
    try {
      await this.device.writeCharacteristicWithResponseForService(
        AQUA_SERVICE_UUID,
        CHAR_LED_UUID,
        bytesToBase64(payload),
      );
    } catch (e) {
      console.warn('LED write failed', e);
      throw e;
    }
  }

  async setLedOn(on: boolean) {
    if (this.isDemoMode || !this.device || this.connected?.isDemo) return;
    const map: Record<Wavelength, number> = { off: 0, red: 1, green: 2, blue: 3 };
    const payload = new Uint8Array([on ? 1 : 0, map[this.wavelength] ?? 2]);
    try {
      await this.device.writeCharacteristicWithResponseForService(
        AQUA_SERVICE_UUID,
        CHAR_LED_UUID,
        bytesToBase64(payload),
      );
    } catch (e) {
      console.warn('LED on/off write failed', e);
      throw e;
    }
  }

  // ---- Set blank I0 on device (float32 LE) ----
  async writeBlank(i0: number) {
    if (this.isDemoMode || !this.device || this.connected?.isDemo) return;
    const buf = new ArrayBuffer(4);
    new DataView(buf).setFloat32(0, i0, true);
    try {
      await this.device.writeCharacteristicWithResponseForService(
        AQUA_SERVICE_UUID,
        CHAR_BLANK_UUID,
        bytesToBase64(new Uint8Array(buf)),
      );
    } catch (e) {
      console.warn('Blank write failed', e);
    }
  }
}

export const bleService = new BleService();
