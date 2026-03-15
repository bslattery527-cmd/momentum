// ─── Color Palette ──────────────────────────────────────────────────────────

export const Colors = {
  // Primary brand
  primary: '#6C63FF',
  primaryLight: '#8B83FF',
  primaryDark: '#4A42DB',

  // Backgrounds
  background: '#FFFFFF',
  backgroundSecondary: '#F7F7FA',
  backgroundTertiary: '#EFEFEF',

  // Surfaces
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',

  // Text
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textInverse: '#FFFFFF',

  // Borders
  border: '#E5E7EB',
  borderLight: '#F3F4F6',

  // Semantic
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  info: '#3B82F6',
  infoLight: '#DBEAFE',

  // Streak & Goal
  streak: '#FF6B35',
  streakLight: '#FFF0EB',
  celebrate: '#FFD700',
  celebrateLight: '#FFFBEB',

  // Social
  google: '#4285F4',
  apple: '#000000',

  // Tab bar
  tabActive: '#6C63FF',
  tabInactive: '#9CA3AF',

  // Overlays
  overlay: 'rgba(0, 0, 0, 0.5)',
  shimmer: '#E5E7EB',
} as const;

// ─── Spacing ────────────────────────────────────────────────────────────────

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 48,
  '6xl': 64,
} as const;

// ─── Typography ─────────────────────────────────────────────────────────────

export const Typography = {
  // Headings
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
    lineHeight: 26,
  },
  h4: {
    fontSize: 17,
    fontWeight: '600' as const,
    lineHeight: 22,
  },

  // Body
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
  },
  bodyMedium: {
    fontSize: 15,
    fontWeight: '500' as const,
    lineHeight: 22,
  },
  bodySemibold: {
    fontSize: 15,
    fontWeight: '600' as const,
    lineHeight: 22,
  },

  // Small
  small: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
  },
  smallMedium: {
    fontSize: 13,
    fontWeight: '500' as const,
    lineHeight: 18,
  },

  // Caption
  caption: {
    fontSize: 11,
    fontWeight: '400' as const,
    lineHeight: 16,
  },
  captionMedium: {
    fontSize: 11,
    fontWeight: '500' as const,
    lineHeight: 16,
  },

  // Button
  button: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
  },
  buttonSmall: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
  },

  // Tab bar
  tab: {
    fontSize: 10,
    fontWeight: '500' as const,
    lineHeight: 14,
  },
} as const;

// ─── Border Radius ──────────────────────────────────────────────────────────

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
} as const;

// ─── Shadows ────────────────────────────────────────────────────────────────

export const Shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;

// ─── Layout ─────────────────────────────────────────────────────────────────

export const Layout = {
  screenPadding: 16,
  cardPadding: 16,
  maxContentWidth: 600,
  avatarSizeSm: 32,
  avatarSizeMd: 40,
  avatarSizeLg: 64,
  avatarSizeXl: 80,
  tabBarHeight: 84,
  headerHeight: 56,
  fabSize: 56,
} as const;

// ─── Animation ──────────────────────────────────────────────────────────────

export const Animation = {
  fast: 150,
  normal: 250,
  slow: 350,
} as const;

// ─── Camel-case Aliases ────────────────────────────────────────────────────
// Agent 3 components import these names; keep both to avoid churn.

export const colors = Colors;
export const spacing = Spacing;
export const typography = { ...Typography, subtitle: Typography.h4 };
export const borderRadius = BorderRadius;
export const shadows = Shadows;
export const layout = Layout;
