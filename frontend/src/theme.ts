// Theme tokens from /app/design_guidelines.json
export type ThemeMode = 'light' | 'dark';

export const palette = {
  dark: {
    background: '#050505',
    surface: '#121212',
    surfaceElevated: '#1A1A1A',
    border: '#2E2E2E',
    textPrimary: '#FFFFFF',
    textSecondary: '#A1A1AA',
    primary: '#3399FF',
    safe: '#00E676',
    warning: '#FFEA00',
    critical: '#FF1744',
    ledRed: '#FF3B30',
    ledGreen: '#34C759',
    ledBlue: '#007AFF',
  },
  light: {
    background: '#F9FAFB',
    surface: '#FFFFFF',
    surfaceElevated: '#F3F4F6',
    border: '#E5E7EB',
    textPrimary: '#111827',
    textSecondary: '#6B7280',
    primary: '#0052FF',
    safe: '#00C853',
    warning: '#F57C00',
    critical: '#D50000',
    ledRed: '#D32F2F',
    ledGreen: '#2E7D32',
    ledBlue: '#1565C0',
  },
};

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 };
export const radius = { sm: 4, md: 8, lg: 12, pill: 9999 };

export const typography = {
  mono: 'Menlo',
  sans: 'System',
};

export type Colors = typeof palette.dark;

export const getColors = (mode: ThemeMode): Colors => palette[mode];
