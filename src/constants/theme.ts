export type ThemeColors = {
  bg: string;
  card: string;
  cardLight: string;
  accent: string;
  accentDark: string;
  text: string;
  textSecondary: string;
  border: string;
  error: string;
  success: string;
};

export const darkColors: ThemeColors = {
  bg: '#0a0b0e',
  card: '#151518',
  cardLight: '#1e1f23',
  accent: '#C41E3A',
  accentDark: '#9a1830',
  text: '#ffffff',
  textSecondary: '#8a8a8e',
  border: '#2a2a2e',
  error: '#e17055',
  success: '#00b894',
};

export const lightColors: ThemeColors = {
  bg: '#f5f5f7',
  card: '#ffffff',
  cardLight: '#eeeef0',
  accent: '#C41E3A',
  accentDark: '#9a1830',
  text: '#1a1a1a',
  textSecondary: '#6b6b70',
  border: '#d8d8dc',
  error: '#d63031',
  success: '#00b894',
};

// Default export for backward compatibility (used in non-component files)
export const colors = darkColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};
