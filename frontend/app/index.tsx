import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/ThemeContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function Splash() {
  const router = useRouter();
  const { colors } = useTheme();
  const opacity = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    const t = setTimeout(() => router.replace('/(tabs)'), 1400);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} testID="splash-screen">
      <Animated.View style={{ opacity, alignItems: 'center' }}>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 24,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          <MaterialCommunityIcons name="water-opacity" size={52} color={colors.primary} />
        </View>
        <Text style={{ color: colors.textPrimary, fontSize: 28, fontWeight: '700', letterSpacing: -0.5 }}>
          Aqua
          <Text style={{ color: colors.primary }}>Spec</Text>
        </Text>
        <Text
          style={{
            color: colors.textSecondary,
            marginTop: 8,
            letterSpacing: 2.5,
            fontSize: 11,
            textTransform: 'uppercase',
          }}
        >
          Optical Biosensor Companion
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
