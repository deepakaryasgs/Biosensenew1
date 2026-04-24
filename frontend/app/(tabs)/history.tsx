import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../src/ThemeContext';
import { useStore } from '../../src/store';
import { Card, Label, Title, Sub, Badge } from '../../src/components';
import { spacing, radius } from '../../src/theme';

export default function History() {
  const { colors } = useTheme();
  const router = useRouter();
  const { measurements, settings } = useStore();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'safe' | 'warning' | 'critical'>('all');

  const list = useMemo(() => {
    const qs = q.trim().toLowerCase();
    return measurements.filter((m) => {
      if (filter !== 'all' && m.status !== filter) return false;
      if (!qs) return true;
      return (
        m.sampleId.toLowerCase().includes(qs) ||
        m.contaminant.toLowerCase().includes(qs) ||
        m.operator.toLowerCase().includes(qs) ||
        m.notes.toLowerCase().includes(qs)
      );
    });
  }, [q, filter, measurements]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xxl }}>
        <Title>History</Title>
        <Sub style={{ marginTop: 4, marginBottom: spacing.md }}>{measurements.length} measurements stored locally</Sub>

        <TextInput
          testID="history-search"
          value={q}
          onChangeText={setQ}
          placeholder="Search sample, contaminant, operator…"
          placeholderTextColor={colors.textSecondary}
          style={{
            backgroundColor: colors.surfaceElevated,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            paddingHorizontal: 12,
            paddingVertical: 10,
            color: colors.textPrimary,
            marginBottom: spacing.sm,
            minHeight: 44,
          }}
        />

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: spacing.md }}>
          {(['all', 'safe', 'warning', 'critical'] as const).map((f) => {
            const col =
              f === 'safe' ? colors.safe : f === 'warning' ? colors.warning : f === 'critical' ? colors.critical : colors.primary;
            const active = filter === f;
            return (
              <TouchableOpacity
                key={f}
                testID={`filter-${f}`}
                onPress={() => setFilter(f)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  borderColor: active ? col : colors.border,
                  backgroundColor: active ? col : 'transparent',
                }}
              >
                <Text style={{ color: active ? '#fff' : colors.textSecondary, fontWeight: '600', fontSize: 12, textTransform: 'uppercase' }}>
                  {f}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {list.length === 0 && (
          <Card testID="history-empty">
            <Sub>No measurements match.</Sub>
          </Card>
        )}

        {list.map((m) => (
          <TouchableOpacity
            key={m.id}
            testID={`hist-${m.id}`}
            onPress={() => router.push(`/measurement/${m.id}`)}
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.md,
              padding: spacing.md,
              marginBottom: spacing.sm,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 15 }}>{m.sampleId}</Text>
                <Sub style={{ marginTop: 2 }}>{m.contaminant} · {m.operator}</Sub>
                <Sub style={{ marginTop: 2 }}>{new Date(m.createdAt).toLocaleString()}</Sub>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.textPrimary, fontFamily: 'monospace', fontSize: 16 }}>
                  {m.meanAbsorbance.toFixed(3)} A
                </Text>
                {m.concentration != null && (
                  <Text style={{ color: colors.textSecondary, fontFamily: 'monospace', fontSize: 12, marginTop: 2 }}>
                    {m.concentration.toFixed(2)} {settings.unit}
                  </Text>
                )}
                <View style={{ marginTop: 6 }}>
                  <Badge
                    label={m.status}
                    color={
                      m.status === 'safe'
                        ? colors.safe
                        : m.status === 'warning'
                        ? colors.warning
                        : m.status === 'critical'
                        ? colors.critical
                        : colors.textSecondary
                    }
                  />
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
