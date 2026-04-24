import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from './ThemeContext';
import { spacing, radius } from './theme';

export function Card({ children, style, testID }: { children: React.ReactNode; style?: ViewStyle; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.md,
          padding: spacing.lg,
          borderWidth: 1,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Label({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        {
          color: colors.textSecondary,
          fontSize: 12,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          fontWeight: '600',
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Title({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const { colors } = useTheme();
  return <Text style={[{ color: colors.textPrimary, fontSize: 24, fontWeight: '600', letterSpacing: -0.3 }, style]}>{children}</Text>;
}

export function Body({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const { colors } = useTheme();
  return <Text style={[{ color: colors.textPrimary, fontSize: 15, lineHeight: 22 }, style]}>{children}</Text>;
}

export function Sub({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const { colors } = useTheme();
  return <Text style={[{ color: colors.textSecondary, fontSize: 13 }, style]}>{children}</Text>;
}

export function MonoBig({ children, color }: { children: React.ReactNode; color?: string }) {
  const { colors } = useTheme();
  return (
    <Text
      style={{
        color: color || colors.textPrimary,
        fontSize: 44,
        fontFamily: Platform_mono(),
        fontVariant: ['tabular-nums'],
        fontWeight: '600',
        letterSpacing: -1,
      }}
    >
      {children}
    </Text>
  );
}

function Platform_mono() {
  // iOS: Menlo, Android: monospace
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Platform } = require('react-native');
  return Platform.OS === 'ios' ? 'Menlo' : 'monospace';
}

export function Badge({
  label,
  color,
  bg,
  testID,
}: {
  label: string;
  color: string;
  bg?: string;
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: color,
        backgroundColor: bg || 'transparent',
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' }}>{label}</Text>
    </View>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.md }} />;
}

export const componentStyles = StyleSheet.create({});
