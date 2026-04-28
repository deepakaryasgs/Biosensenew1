import React from 'react';
import { View, Text, ScrollView, Switch, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../src/ThemeContext';
import { useStore } from '../../src/store';
import { Card, Label, Title, Sub } from '../../src/components';
import { spacing, radius } from '../../src/theme';

export default function Settings() {
  const { colors, mode, setMode } = useTheme();
  const { settings, updateSettings } = useStore();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}>
        <Title>Settings</Title>

        <Card style={{ marginTop: spacing.md }} testID="appearance-card">
          <Label>Appearance</Label>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.sm }}>
            {(['dark', 'light'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                testID={`theme-${m}`}
                onPress={() => setMode(m)}
                style={{
                  flex: 1,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: mode === m ? colors.primary : colors.border,
                  backgroundColor: mode === m ? colors.primary : 'transparent',
                  borderRadius: radius.md,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: mode === m ? '#fff' : colors.textSecondary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, fontSize: 12 }}>
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <Card style={{ marginTop: spacing.md }} testID="demo-card">
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Label>Demo Mode</Label>
              <Sub style={{ marginTop: 4 }}>Run with simulated data.</Sub>
            </View>
            <Switch
              testID="demo-switch"
              value={settings.demoMode}
              onValueChange={(v) => updateSettings({ demoMode: v })}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
        </Card>

        <Card style={{ marginTop: spacing.md }} testID="thresholds-card">
          <Label>Thresholds ({settings.unit})</Label>
          <Sub style={{ marginTop: 4 }}>
            Safe if ≤ Safe max; Warning if ≤ Warning max; Critical otherwise.
          </Sub>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Input
                testID="safe-max"
                value={String(settings.safeMax)}
                onChangeText={(v) => updateSettings({ safeMax: Number(v) || 0 })}
                keyboardType="numeric"
                placeholder="Safe max"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                testID="warn-max"
                value={String(settings.warningMax)}
                onChangeText={(v) => updateSettings({ warningMax: Number(v) || 0 })}
                keyboardType="numeric"
                placeholder="Warning max"
              />
            </View>
          </View>
          <Input testID="unit-input" value={settings.unit} onChangeText={(v) => updateSettings({ unit: v })} placeholder="Unit (e.g. mg/L)" />
        </Card>

        <Card style={{ marginTop: spacing.md }} testID="blank-card">
          <Label>Optical Reference</Label>
          <Input
            testID="blank-intensity-input"
            value={String(settings.blankIntensity)}
            onChangeText={(v) => updateSettings({ blankIntensity: Number(v) || 0 })}
            keyboardType="numeric"
            placeholder="Blank I₀"
          />
          <Sub style={{ marginTop: 4 }}>I₀ is the transmitted light through a blank cuvette. Used for A = log₁₀(I₀/I).</Sub>
        </Card>

        <TouchableOpacity
          testID="about-btn"
          onPress={() =>
            Alert.alert(
              'AquaSpec',
              'Portable water-quality biosensor companion. BLE + Demo mode. Local-only offline-first.\nBeer-Lambert: A = ε · l · c.',
            )
          }
          style={{
            marginTop: spacing.lg,
            padding: 14,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: colors.textSecondary, fontWeight: '600', letterSpacing: 1 }}>ABOUT</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Input({ value, onChangeText, placeholder, testID, keyboardType }: any) {
  const { colors } = useTheme();
  return (
    <TextInput
      testID={testID}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textSecondary}
      keyboardType={keyboardType}
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
