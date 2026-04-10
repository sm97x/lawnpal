import { Platform } from "react-native";

export const palette = {
  background: "#FBF9F4",
  backgroundAlt: "#F5F3EE",
  surface: "#FFFFFF",
  surfaceLow: "#F5F3EE",
  surfaceMuted: "#F0EEE9",
  surfaceHigh: "#EAE8E3",
  surfaceHighest: "#E4E2DD",
  ink: "#1B1C19",
  inkSoft: "#4E6953",
  inkMuted: "#737973",
  outline: "#737973",
  border: "#C2C8C2",
  primary: "#051A0F",
  primaryContainer: "#1A2F23",
  primarySoft: "#D0E9D6",
  secondary: "#4A654F",
  secondarySoft: "#C9E7CC",
  warning: "#B37400",
  warningSoft: "#F1E7D2",
  danger: "#BA1A1A",
  dangerSoft: "#FFDAD6",
  white: "#FFFFFF",
  shadow: "rgba(13, 26, 18, 0.08)"
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 32,
  pill: 999
};

export const layout = {
  maxWidth: 860,
  gutter: 20,
  topBarHeight: 68,
  bottomNavHeight: 112
};

export const fonts = {
  headlineBold: "Manrope_700Bold",
  headlineHeavy: "Manrope_800ExtraBold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemi: "Inter_600SemiBold",
  bodyBold: "Inter_700Bold"
};

export const shadows = {
  botanical: Platform.select({
    ios: {
      shadowColor: "#0D1A12",
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.08,
      shadowRadius: 28
    },
    android: {
      elevation: 8
    },
    default: {
      shadowColor: "#0D1A12",
      shadowOffset: { width: 0, height: 20 },
      shadowOpacity: 0.08,
      shadowRadius: 28
    }
  })
};
