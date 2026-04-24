import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/ThemeContext';
import { useStore } from '../src/store';
import { bleService, BleDevice, isBleNativeAvailable } from '../src/ble';
import { Card, Label, Sub, Badge } from '../src/components';
import { spacing, radius } from '../src/theme';

export default function Connect() {
  const { colors } = useTheme();
  const router = useRouter();
  const { settings, updateSettings } = useStore();
  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<BleDevice[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connected, setConnected] = useState<BleDevice | null>(bleService.getConnected());

  useEffect(() => {
    bleService.setDemoMode(settings.demoMode);
  }, [settings.demoMode]);

  const startScan = async () => {
    setScanning(true);
    setDevices([]);
    try {
      await bleService.scan((d) => {
        setDevices((prev) => (prev.find((x) => x.id === d.id) ? prev : [...prev, d]));
      });
    } catch (e: any) {
      Alert.alert('Scan error', e?.message || String(e));
    } finally {
      setScanning(false);
    }
  };

  const connect = async (d: BleDevice) => {
    setConnecting(d.id);
    try {
      await bleService.connect(d);
      setConnected(bleService.getConnected());
      Alert.alert('Connected', `${d.name} is ready.`);
    } catch (e: any) {
      Alert.alert('Connect failed', e?.message || String(e));
    } finally {
      setConnecting(null);
    }
  };

  const disconnect = async () => {
    await bleService.disconnect();
    setConnected(null);
  };

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md }}>
        <Card testID="demo-mode-card" style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Label>Demo Mode</Label>
              <Sub style={{ marginTop: 4 }}>
                {isBleNativeAvailable()
                  ? 'Use simulated data without hardware.'
                  : 'Native BLE unavailable in this runtime. Demo mode provides realistic simulated signals.'}
              </Sub>
            </View>
            <Switch
              testID="demo-mode-switch"
              value={settings.demoMode}
              onValueChange={(v) => {
                updateSettings({ demoMode: v });
                bleService.setDemoMode(v);
              }}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        </Card>

        {connected ? (
          <Card testID="connected-card" style={{ marginBottom: spacing.md }}>
            <Label>Connected</Label>
            <Text style={{ color: colors.textPrimary, fontSize: 18, fontWeight: '600', marginTop: 4 }}>{connected.name}</Text>
            <Sub style={{ marginTop: 2 }}>{connected.id}</Sub>
            <View style={{ flexDirection: 'row', marginTop: spacing.md, gap: 10 }}>
              <TouchableOpacity
                testID="disconnect-btn"
                onPress={disconnect}
                style={{
                  flex: 1,
                  backgroundColor: colors.critical,
                  padding: 12,
                  borderRadius: radius.md,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Disconnect</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="goto-measure-btn"
                onPress={() => router.replace('/(tabs)/measure')}
                style={{
                  flex: 1,
                  backgroundColor: colors.primary,
                  padding: 12,
                  borderRadius: radius.md,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Go to Measure</Text>
              </TouchableOpacity>
            </View>
          </Card>
        ) : null}

        <TouchableOpacity
          testID="scan-btn"
          onPress={startScan}
          disabled={scanning}
          style={{
            backgroundColor: colors.primary,
            padding: 14,
            borderRadius: radius.md,
            alignItems: 'center',
            marginBottom: spacing.md,
            opacity: scanning ? 0.6 : 1,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', letterSpacing: 1 }}>
            {scanning ? 'SCANNING…' : 'SCAN FOR DEVICES'}
          </Text>
        </TouchableOpacity>

        {devices.length === 0 && !scanning && (
          <Card>
            <Sub>No devices yet. Tap Scan to discover nearby BLE biosensors.</Sub>
          </Card>
        )}

        {devices.map((d) => (
          <TouchableOpacity
            key={d.id}
            testID={`device-${d.id}`}
            onPress={() => connect(d)}
            disabled={connecting === d.id}
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              padding: spacing.md,
              marginBottom: spacing.sm,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.textPrimary, fontWeight: '600', fontSize: 15 }}>{d.name}</Text>
              <Sub style={{ marginTop: 2 }}>
                {d.id} {d.rssi ? `· ${d.rssi} dBm` : ''}
              </Sub>
              {d.isDemo && (
                <View style={{ marginTop: 6 }}>
                  <Badge label="Simulated" color={colors.primary} />
                </View>
              )}
            </View>
            <MaterialCommunityIcons
              name={connecting === d.id ? 'dots-horizontal' : 'chevron-right'}
              size={22}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
