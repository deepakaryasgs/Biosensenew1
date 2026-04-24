// BLE service with demo-mode fallback.
// In Expo Go or when native BLE module isn't available, demo mode simulates data.
// When built as a dev build with react-native-ble-plx, real BLE is used.
import { Platform } from 'react-native';

export interface BleDevice {
  id: string;
  name: string;
  rssi?: number;
  isDemo?: boolean;
}

export interface Sample {
  t: number; // relative seconds
  intensity: number; // raw photodiode
  intensityBlank?: number;
  absorbance: number;
}

export type Wavelength = 'red' | 'green' | 'blue' | 'fixed';

type Listener = (s: Sample) => void;

let bleManagerInstance: any = null;
let BleManagerCtor: any = null;
try {
  // Lazy require so Expo Go doesn't crash
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const m = require('react-native-ble-plx');
  BleManagerCtor = m.BleManager;
} catch {
  BleManagerCtor = null;
}

export const isBleNativeAvailable = () => !!BleManagerCtor && Platform.OS !== 'web';

export class BleService {
  private demoInterval: any = null;
  private listeners: Listener[] = [];
  private connected: BleDevice | null = null;
  private running = false;
  private paused = false;
  private t0 = 0;
  private I0 = 1000; // blank intensity baseline
  private wavelength: Wavelength = 'green';

  isDemoMode = true; // default demo

  setDemoMode(v: boolean) {
    this.isDemoMode = v;
  }

  setWavelength(w: Wavelength) {
    this.wavelength = w;
  }

  setBlank(I0: number) {
    this.I0 = I0;
  }

  getConnected() {
    return this.connected;
  }

  async scan(onFound: (d: BleDevice) => void, timeoutMs = 4000): Promise<void> {
    if (this.isDemoMode || !isBleNativeAvailable()) {
      const demoDevices: BleDevice[] = [
        { id: 'demo-esp32-a', name: 'BioSensor ESP32 (Demo)', rssi: -45, isDemo: true },
        { id: 'demo-esp32-b', name: 'Aqua Sense DEMO', rssi: -62, isDemo: true },
      ];
      let i = 0;
      return new Promise((resolve) => {
        const push = () => {
          if (i < demoDevices.length) {
            onFound(demoDevices[i++]);
            setTimeout(push, 400);
          } else {
            resolve();
          }
        };
        push();
      });
    }
    // Real BLE path
    if (!bleManagerInstance) bleManagerInstance = new BleManagerCtor();
    return new Promise((resolve, reject) => {
      const seen = new Set<string>();
      const sub = bleManagerInstance.startDeviceScan(null, null, (error: any, device: any) => {
        if (error) {
          reject(error);
          return;
        }
        if (device && !seen.has(device.id)) {
          seen.add(device.id);
          onFound({ id: device.id, name: device.name || 'Unknown', rssi: device.rssi });
        }
      });
      setTimeout(() => {
        bleManagerInstance.stopDeviceScan();
        resolve();
      }, timeoutMs);
    });
  }

  async connect(device: BleDevice): Promise<void> {
    if (device.isDemo || this.isDemoMode) {
      this.connected = device;
      return;
    }
    if (!bleManagerInstance) bleManagerInstance = new BleManagerCtor();
    const d = await bleManagerInstance.connectToDevice(device.id);
    await d.discoverAllServicesAndCharacteristics();
    this.connected = { id: d.id, name: d.name || 'ESP32', rssi: device.rssi };
  }

  async disconnect(): Promise<void> {
    this.stop();
    if (this.connected && !this.connected.isDemo && bleManagerInstance) {
      try {
        await bleManagerInstance.cancelDeviceConnection(this.connected.id);
      } catch {}
    }
    this.connected = null;
  }

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
    if (this.isDemoMode || !this.connected || this.connected.isDemo) {
      if (this.demoInterval) clearInterval(this.demoInterval);
      this.demoInterval = setInterval(() => {
        if (!this.running || this.paused) return;
        const t = (Date.now() - this.t0) / 1000;
        // Simulate: target absorbance ~0.4 + slow drift + noise
        const targetA = 0.4 + 0.15 * Math.sin(t / 8) + (Math.random() - 0.5) * 0.03;
        const I = this.I0 * Math.pow(10, -targetA);
        const sample: Sample = {
          t,
          intensity: Math.max(0, I),
          intensityBlank: this.I0,
          absorbance: targetA,
        };
        this.listeners.forEach((l) => l(sample));
      }, 200);
    }
    // Real BLE characteristic monitoring would go here (characteristic UUIDs defined by firmware)
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  stop() {
    this.running = false;
    this.paused = false;
    if (this.demoInterval) {
      clearInterval(this.demoInterval);
      this.demoInterval = null;
    }
  }

  isRunning() {
    return this.running && !this.paused;
  }

  getBatteryLevel(): number {
    // Demo: returns a pseudo-stable battery level
    return this.isDemoMode || !this.connected ? 82 : 0;
  }
}

export const bleService = new BleService();
