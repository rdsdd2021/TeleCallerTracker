// ─── Palette definitions ──────────────────────────────────────────────────────

const shared = {
  primary:      '#4F46E5',
  primaryLight: '#818CF8',
  accent:       '#0EA5E9',
  success:      '#10B981',
  error:        '#EF4444',
  warning:      '#F59E0B',
  textOnPrimary:'#FFFFFF',
  radius: { sm: 10, md: 16, lg: 24, xl: 32, full: 999 },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
};

export const lightPalette = {
  ...shared,
  dark: false,
  bg:              '#F5F7FF',
  surface:         '#FFFFFF',
  surfaceVariant:  '#EEF2FF',
  primaryContainer:'#E0E7FF',
  accentContainer: '#E0F2FE',
  successContainer:'#D1FAE5',
  errorContainer:  '#FEE2E2',
  warningContainer:'#FEF3C7',
  textPrimary:     '#1E1B4B',
  textSecondary:   '#6B7280',
  textTertiary:    '#9CA3AF',
  border:          '#E5E7EB',
  divider:         '#F3F4F6',
  shadow: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  shadowStrong: {
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 20,
    elevation: 8,
  },
};

export const darkPalette = {
  ...shared,
  dark: true,
  bg:              '#0F0E1A',
  surface:         '#1A1828',
  surfaceVariant:  '#231F35',
  primaryContainer:'#2D2A6E',
  accentContainer: '#0C3047',
  successContainer:'#064E3B',
  errorContainer:  '#450A0A',
  warningContainer:'#451A03',
  textPrimary:     '#EDE9FE',
  textSecondary:   '#A78BFA',
  textTertiary:    '#6D6A8A',
  border:          '#2D2A45',
  divider:         '#1E1C30',
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 4,
  },
  shadowStrong: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 8,
  },
};

export type Theme = typeof lightPalette;

// Default export — screens that haven't migrated to context yet still work
export const theme: Theme = lightPalette;
