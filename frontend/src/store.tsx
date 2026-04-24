import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Measurement {
  id: string;
  sampleId: string;
  operator: string;
  contaminant: string;
  notes: string;
  wavelength: string;
  calibrationId: string | null;
  createdAt: string; // ISO
  durationSec: number;
  meanIntensity: number;
  meanAbsorbance: number;
  concentration: number | null;
  status: 'safe' | 'warning' | 'critical' | 'unknown';
  points: { t: number; intensity: number; absorbance: number }[];
}

export interface CalibrationProfile {
  id: string;
  name: string;
  contaminant: string;
  unit: string;
  modelType: 'linear' | 'polynomial' | 'manual';
  degree: number;
  coefficients: number[];
  r2: number;
  equation: string;
  standards: { concentration: number; absorbance: number }[];
  createdAt: string;
}

export interface Settings {
  operator: string;
  ledType: 'rgb' | 'fixed';
  fixedWavelength: number; // nm
  safeMax: number; // concentration threshold
  warningMax: number; // between safeMax and warningMax = warning, above = critical
  unit: string;
  blankIntensity: number;
  demoMode: boolean;
}

interface StoreCtx {
  measurements: Measurement[];
  calibrations: CalibrationProfile[];
  settings: Settings;
  activeCalibrationId: string | null;
  ready: boolean;
  addMeasurement: (m: Measurement) => Promise<void>;
  deleteMeasurement: (id: string) => Promise<void>;
  addCalibration: (c: CalibrationProfile) => Promise<void>;
  deleteCalibration: (id: string) => Promise<void>;
  setActiveCalibrationId: (id: string | null) => Promise<void>;
  updateSettings: (s: Partial<Settings>) => Promise<void>;
}

const defaultSettings: Settings = {
  operator: 'Field Technician',
  ledType: 'rgb',
  fixedWavelength: 525,
  safeMax: 5,
  warningMax: 15,
  unit: 'mg/L',
  blankIntensity: 1000,
  demoMode: true,
};

const Ctx = createContext<StoreCtx | null>(null);

const KEYS = {
  measurements: 'app-measurements',
  calibrations: 'app-calibrations',
  settings: 'app-settings',
  activeCal: 'app-active-cal',
};

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [calibrations, setCalibrations] = useState<CalibrationProfile[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [activeCalibrationId, setActiveCalibId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canStore = Platform.OS !== 'web' || typeof window !== 'undefined';
    if (!canStore) {
      setReady(true);
      return;
    }
    (async () => {
      try {
        const [m, c, s, ac] = await Promise.all([
          AsyncStorage.getItem(KEYS.measurements),
          AsyncStorage.getItem(KEYS.calibrations),
          AsyncStorage.getItem(KEYS.settings),
          AsyncStorage.getItem(KEYS.activeCal),
        ]);
        if (m) setMeasurements(JSON.parse(m));
        if (c) setCalibrations(JSON.parse(c));
        if (s) setSettings({ ...defaultSettings, ...JSON.parse(s) });
        if (ac) setActiveCalibId(ac);
      } catch (e) {
        console.warn('store load err', e);
      }
      setReady(true);
    })();
  }, []);

  const persist = async (key: string, value: any) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch {}
  };

  const addMeasurement = useCallback(async (m: Measurement) => {
    const next = [m, ...measurements];
    setMeasurements(next);
    await persist(KEYS.measurements, next);
  }, [measurements]);

  const deleteMeasurement = useCallback(async (id: string) => {
    const next = measurements.filter((x) => x.id !== id);
    setMeasurements(next);
    await persist(KEYS.measurements, next);
  }, [measurements]);

  const addCalibration = useCallback(async (c: CalibrationProfile) => {
    const next = [c, ...calibrations];
    setCalibrations(next);
    await persist(KEYS.calibrations, next);
    if (!activeCalibrationId) {
      setActiveCalibId(c.id);
      await AsyncStorage.setItem(KEYS.activeCal, c.id);
    }
  }, [calibrations, activeCalibrationId]);

  const deleteCalibration = useCallback(async (id: string) => {
    const next = calibrations.filter((c) => c.id !== id);
    setCalibrations(next);
    await persist(KEYS.calibrations, next);
    if (activeCalibrationId === id) {
      setActiveCalibId(null);
      await AsyncStorage.removeItem(KEYS.activeCal);
    }
  }, [calibrations, activeCalibrationId]);

  const setActiveCalibrationId = useCallback(async (id: string | null) => {
    setActiveCalibId(id);
    if (id) await AsyncStorage.setItem(KEYS.activeCal, id);
    else await AsyncStorage.removeItem(KEYS.activeCal);
  }, []);

  const updateSettings = useCallback(async (s: Partial<Settings>) => {
    const next = { ...settings, ...s };
    setSettings(next);
    await persist(KEYS.settings, next);
  }, [settings]);

  return (
    <Ctx.Provider
      value={{
        measurements,
        calibrations,
        settings,
        activeCalibrationId,
        ready,
        addMeasurement,
        deleteMeasurement,
        addCalibration,
        deleteCalibration,
        setActiveCalibrationId,
        updateSettings,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useStore = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStore must be used within StoreProvider');
  return c;
};
