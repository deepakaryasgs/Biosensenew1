import React, { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../src/ThemeContext';
import { bleService, Sample, Wavelength } from '../../src/ble';
import { useStore, Measurement } from '../../src/store';
import { useRouter } from 'expo-router';
import { Card, Label, Badge, Sub } from '../../src/components';
import { Chart } from '../../src/Chart';
import { spacing, radius } from '../../src/theme';

export default function Measure() {
  const { colors } = useTheme();
  const router = useRouter();
  const { settings, calibrations, activeCalibrationId, addMeasurement, updateSettings } = useStore();
  const [samples, setSamples] = useState<Sample[]>([]);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [ledOn, setLedOn] = useState(true);
  const [wavelength, setWavelength] = useState<Wavelength>('green');
  const [sampleId, setSampleId] = useState('');
  const [contaminant, setContaminant] = useState('');
  const [notes, setNotes] = useState('');
  const [blankI0, setBlankI0] = useState(String(settings.blankIntensity));
  const samplesRef = useRef<Sample[]>([]);

  const activeCal = calibrations.find((c) => c.id === activeCalibrationId) || null;

  useEffect(() => {
    bleService.setWavelength(wavelength).catch(() => {});
  }, [wavelength]);

  useEffect(() => {
    bleService.setBlank(settings.blankIntensity);
  }, [settings.blankIntensity]);

  useEffect(() => {
    bleService.setLedOn(ledOn).catch(() => {});
  }, [ledOn]);

  useEffect(() => {
    const unsub = bleService.onData((s) => {
      samplesRef.current = [...samplesRef.current, s].slice(-300);
      setSamples(samplesRef.current);
    });
    return unsub;
  }, []);

  const last = samples[samples.length - 1];
  const intensity = last?.intensity ?? 0;
  const absorbance = last?.absorbance ?? 0;
  const concentration = activeCal ? activeCal.coefficients.reduce((s, c, i) => s + c * Math.pow(absorbance, i), 0) : null;
  // NOTE: calibration stored as y=absorbance as a function of x=concentration (linear/poly).
  // For inverse (concentration from absorbance), use the inverse we recomputed below more carefully:
  const concFromCal = activeCal ? invertCal(activeCal, absorbance) : null;

  const status = threshold(concFromCal, settings.safeMax, settings.warningMax);

  const handleStart = () => {
    if (!bleService.getConnected() && !settings.demoMode) {
      Alert.alert('Not connected', 'Connect a device or enable Demo Mode in Settings.');
      return;
    }
    if (!bleService.getConnected() && settings.demoMode) {
      // auto-connect demo
      bleService.setDemoMode(true);
      bleService.connect({ id: 'demo-auto', name: 'BioSensor (Demo)', isDemo: true });
    }
    samplesRef.current = [];
    setSamples([]);
    bleService.setBlank(Number(blankI0) || 1000);
    bleService.start();
    setRunning(true);
    setPaused(false);
  };

  const handlePause = () => {
    if (paused) {
      bleService.resume();
      setPaused(false);
    } else {
      bleService.pause();
      setPaused(true);
    }
  };

  const handleStop = async () => {
    bleService.stop();
    setRunning(false);
    setPaused(false);
    if (samplesRef.current.length === 0) return;
    const pts = samplesRef.current;
    const meanI = pts.reduce((s, p) => s + p.intensity, 0) / pts.length;
    const meanA = pts.reduce((s, p) => s + p.absorbance, 0) / pts.length;
    const conc = activeCal ? invertCal(activeCal, meanA) : null;
    const st = threshold(conc, settings.safeMax, settings.warningMax);
    const meas: Measurement = {
      id: `${Date.now()}`,
      sampleId: sampleId || `SMP-${Date.now().toString().slice(-5)}`,
      operator: '',
      contaminant: contaminant || (activeCal?.contaminant ?? 'Unknown'),
      notes,
      wavelength: wavelength,
      calibrationId: activeCal?.id ?? null,
      createdAt: new Date().toISOString(),
      durationSec: pts[pts.length - 1].t,
      meanIntensity: meanI,
      meanAbsorbance: meanA,
      concentration: conc,
      status: st,
      points: pts.map((p) => ({ t: p.t, intensity: p.intensity, absorbance: p.absorbance })),
    };
    await addMeasurement(meas);
    Alert.alert('Saved', 'Measurement stored in history.', [
      { text: 'View', onPress: () => router.push(`/measurement/${meas.id}`) },
      { text: 'OK' },
    ]);
  };

  const screenW = Dimensions.get('window').width - spacing.md * 2 - spacing.lg * 2;

  const wavelengthLabel = () => {
    return wavelength === 'red' ? '~635 nm (Red)' : wavelength === 'green' ? '~540 nm (Green)' : wavelength === 'blue' ? '~470 nm (Blue)' : 'Off';
  };

  const wavelengthColor = () => {
    if (wavelength === 'red') return colors.ledRed;
    if (wavelength === 'green') return colors.ledGreen;
    if (wavelength === 'blue') return colors.ledBlue;
    return colors.textSecondary;
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}>
        {/* Readouts */}
        <Card testID="live-readout-card" style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Label>Live Measurement</Label>
            <Badge
              testID="measure-state-badge"
              label={running ? (paused ? 'Paused' : 'Measuring') : 'Idle'}
              color={running && !paused ? colors.primary : colors.textSecondary}
            />
          </View>

          <View style={{ marginTop: spacing.md }}>
            <Text style={{ color: colors.textSecondary, fontSize: 11, letterSpacing: 1.5 }}>ABSORBANCE (OD)</Text>
            <Text
              testID="live-absorbance"
              style={{
                color: colors.textPrimary,
                fontSize: 52,
                fontFamily: 'monospace',
                fontVariant: ['tabular-nums'],
                fontWeight: '600',
                letterSpacing: -1,
              }}
            >
              {absorbance.toFixed(3)}
            </Text>
          </View>

          <View style={{ marginTop: spacing.md }}>
            <Text style={{ color: colors.textSecondary, fontSize: 11, letterSpacing: 1.5 }}>CONCENTRATION</Text>
            <Text
              testID="live-concentration"
              style={{
                color: colors.textPrimary,
                fontSize: 22,
                fontFamily: 'monospace',
                fontVariant: ['tabular-nums'],
                marginTop: 4,
              }}
            >
              {concFromCal != null ? `${concFromCal.toFixed(2)} ${settings.unit}` : '—'}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: 10 }}>
            <MiniMetric label="Intensity" value={intensity.toFixed(0)} unit="I" />
            <MiniMetric
              label="Concentration"
              value={concFromCal != null ? concFromCal.toFixed(2) : '—'}
              unit={settings.unit}
            />
          </View>

          <View style={{ marginTop: spacing.md }}>
            <Badge
              testID="threshold-badge"
              label={status === 'unknown' ? 'No calibration' : status}
              color={
                status === 'safe'
                  ? colors.safe
                  : status === 'warning'
                  ? colors.warning
                  : status === 'critical'
                  ? colors.critical
                  : colors.textSecondary
              }
            />
          </View>
        </Card>

        {/* Chart */}
        <Card style={{ marginBottom: spacing.md }}>
          <Label>Absorbance · Time</Label>
          <View style={{ marginTop: spacing.sm, alignItems: 'center' }}>
            <Chart
              testID="live-chart"
              width={screenW}
              height={180}
              data={samples.map((s) => ({ x: s.t, y: s.absorbance }))}
              strokeColor={wavelengthColor()}
              xLabel="t (s)"
              yLabel="A"
              minY={0}
              maxY={Math.max(1, ...samples.map((s) => s.absorbance), 0) * 1.2 || 1}
            />
          </View>
        </Card>

        {/* Controls */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: spacing.md }}>
          {!running ? (
            <CtrlBtn testID="start-btn" icon="play" label="Start" color={colors.primary} onPress={handleStart} big />
          ) : (
            <>
              <CtrlBtn
                testID="pause-btn"
                icon={paused ? 'play' : 'pause'}
                label={paused ? 'Resume' : 'Pause'}
                color={colors.warning}
                onPress={handlePause}
              />
              <CtrlBtn testID="stop-btn" icon="stop" label="Stop & Save" color={colors.critical} onPress={handleStop} />
            </>
          )}
        </View>

        {/* LED & Wavelength */}
        <Card style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Label>LED · Wavelength</Label>
              <Text style={{ color: wavelengthColor(), marginTop: 4, fontFamily: 'monospace', fontSize: 16 }}>
                {wavelengthLabel()}
              </Text>
            </View>
            <TouchableOpacity
              testID="led-toggle"
              onPress={() => setLedOn((v) => !v)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: ledOn ? colors.primary : colors.border,
                backgroundColor: ledOn ? colors.primary : 'transparent',
              }}
            >
              <Text style={{ color: ledOn ? '#fff' : colors.textSecondary, fontWeight: '700', letterSpacing: 1 }}>
                LED {ledOn ? 'ON' : 'OFF'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.md }}>
            {(['red', 'green', 'blue'] as Wavelength[]).map((w) => (
              <TouchableOpacity
                key={w}
                testID={`wavelength-${w}`}
                onPress={() => setWavelength(w)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor:
                    wavelength === w
                      ? w === 'red'
                        ? colors.ledRed
                        : w === 'green'
                        ? colors.ledGreen
                        : colors.ledBlue
                      : colors.border,
                  backgroundColor: wavelength === w ? colors.surfaceElevated : 'transparent',
                  alignItems: 'center',
                }}
              >
                <View
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 7,
                    backgroundColor: w === 'red' ? colors.ledRed : w === 'green' ? colors.ledGreen : colors.ledBlue,
                    marginBottom: 4,
                  }}
                />
                <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' }}>
                  {w}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        {/* Sample info */}
        <Card style={{ marginBottom: spacing.md }}>
          <Label>Sample</Label>
          <TextInputRow testID="sample-id-input" value={sampleId} onChangeText={setSampleId} placeholder="Sample ID (auto if empty)" />
          <TextInputRow
            testID="contaminant-input"
            value={contaminant}
            onChangeText={setContaminant}
            placeholder="Contaminant (e.g. Nitrate)"
          />
          <TextInputRow testID="notes-input" value={notes} onChangeText={setNotes} placeholder="Notes" multiline />
          <TextInputRow
            testID="blank-input"
            value={blankI0}
            onChangeText={setBlankI0}
            placeholder="Blank intensity I₀"
            keyboardType="numeric"
          />
          <Sub style={{ marginTop: 6 }}>A = log₁₀(I₀ / I). Measure blank first to set I₀.</Sub>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function invertCal(cal: any, absorbance: number): number | null {
  // cal stored as y = f(x) where x=concentration, y=absorbance.
  // Need inverse: solve f(x) = absorbance.
  if (cal.modelType === 'linear' || cal.degree === 1) {
    const [a, b] = cal.coefficients;
    if (b === 0) return null;
    return (absorbance - a) / b;
  }
  // Polynomial inversion via bisection over standards range
  const xs = (cal.standards as { concentration: number }[]).map((s) => s.concentration);
  let lo = Math.min(...xs);
  let hi = Math.max(...xs);
  if (lo === hi) return lo;
  const span = hi - lo;
  lo -= span;
  hi += span;
  const f = (x: number) => cal.coefficients.reduce((s: number, c: number, i: number) => s + c * Math.pow(x, i), 0);
  const monotonic = f(hi) >= f(lo);
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const v = f(mid);
    if (monotonic) {
      if (v < absorbance) lo = mid;
      else hi = mid;
    } else {
      if (v > absorbance) lo = mid;
      else hi = mid;
    }
  }
  return (lo + hi) / 2;
}

function threshold(conc: number | null, safe: number, warn: number): 'safe' | 'warning' | 'critical' | 'unknown' {
  if (conc == null || isNaN(conc)) return 'unknown';
  if (conc <= safe) return 'safe';
  if (conc <= warn) return 'warning';
  return 'critical';
}

function MiniMetric({ label, value, unit }: any) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        padding: spacing.md,
        backgroundColor: colors.surfaceElevated,
      }}
    >
      <Text style={{ color: colors.textSecondary, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase' }}>{label}</Text>
      <Text
        style={{ color: colors.textPrimary, fontSize: 22, fontFamily: 'monospace', fontVariant: ['tabular-nums'], marginTop: 4 }}
      >
        {value}
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>{unit}</Text>
    </View>
  );
}

function CtrlBtn({ icon, label, color, onPress, testID, big }: any) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      style={{
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: big ? 18 : 14,
        backgroundColor: color,
        borderRadius: radius.md,
        minHeight: big ? 60 : 48,
      }}
    >
      <MaterialCommunityIcons name={icon} size={22} color="#fff" />
      <Text style={{ color: '#fff', fontWeight: '800', letterSpacing: 1, marginLeft: 8 }}>{label.toUpperCase()}</Text>
    </TouchableOpacity>
  );
}

function TextInputRow({ value, onChangeText, placeholder, testID, multiline, keyboardType }: any) {
  const { colors } = useTheme();
  return (
    <TextInput
      testID={testID}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textSecondary}
      keyboardType={keyboardType}
      multiline={multiline}
      style={{
        marginTop: 10,
        backgroundColor: colors.surfaceElevated,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.md,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: colors.textPrimary,
        minHeight: 44,
      }}
    />
  );
}
