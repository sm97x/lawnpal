import { LinearGradient } from "expo-linear-gradient";
import type { PropsWithChildren, ReactNode } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle
} from "react-native";
import { fonts, layout, palette, radius, shadows, spacing } from "@/theme";

export const Screen = ({
  children,
  scroll = true,
  contentContainerStyle
}: PropsWithChildren<{ scroll?: boolean; contentContainerStyle?: ViewStyle }>) => {
  if (scroll) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.fill, contentContainerStyle]}>{children}</View>
    </SafeAreaView>
  );
};

export const Card = ({ children }: PropsWithChildren) => (
  <View style={styles.card}>{children}</View>
);

export const Heading = ({ children }: PropsWithChildren) => (
  <Text style={styles.heading}>{children}</Text>
);

export const Subheading = ({ children }: PropsWithChildren) => (
  <Text style={styles.subheading}>{children}</Text>
);

export const Body = ({ children, muted = false }: PropsWithChildren<{ muted?: boolean }>) => (
  <Text style={[styles.body, muted && styles.bodyMuted]}>{children}</Text>
);

export const Button = ({
  label,
  onPress,
  tone = "primary",
  disabled = false
}: {
  label: string;
  onPress: () => void;
  tone?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
}) => (
  <Pressable
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.buttonWrap, disabled && styles.buttonDisabled, pressed && !disabled && styles.buttonPressed]}
  >
    {tone === "primary" ? (
      <LinearGradient
        colors={[palette.primary, palette.primaryContainer]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.buttonPrimary}
      >
        <Text style={[styles.buttonText, styles.buttonTextPrimary]}>{label}</Text>
      </LinearGradient>
    ) : (
      <View
        style={[
          styles.button,
          tone === "secondary" && styles.buttonSecondary,
          tone === "ghost" && styles.buttonGhost
        ]}
      >
        <Text
          style={[
            styles.buttonText,
            tone === "ghost" ? styles.buttonTextGhost : styles.buttonTextSecondary
          ]}
        >
          {label}
        </Text>
      </View>
    )}
  </Pressable>
);

export const Chip = ({
  label,
  tone = "neutral"
}: {
  label: string;
  tone?: "neutral" | "positive" | "warning" | "danger";
}) => (
  <View
    style={[
      styles.chip,
      tone === "positive" && styles.chipPositive,
      tone === "warning" && styles.chipWarning,
      tone === "danger" && styles.chipDanger
    ]}
  >
    <Text style={styles.chipText}>{label}</Text>
  </View>
);

export const Row = ({
  left,
  right
}: {
  left: ReactNode;
  right?: ReactNode;
}) => (
  <View style={styles.row}>
    <View style={styles.rowLeft}>{left}</View>
    {right ? <View>{right}</View> : null}
  </View>
);

export const Divider = () => <View style={styles.divider} />;

export const InputField = ({
  value,
  onChangeText,
  placeholder,
  multiline = false
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
}) => (
  <TextInput
    multiline={multiline}
    onChangeText={onChangeText}
    placeholder={placeholder}
    placeholderTextColor={palette.inkMuted}
    style={[styles.input, multiline && styles.inputMultiline]}
    value={value}
  />
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background
  },
  fill: {
    flex: 1,
    width: "100%",
    maxWidth: layout.maxWidth,
    alignSelf: "center",
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.lg,
    gap: spacing.lg
  },
  scrollContent: {
    width: "100%",
    maxWidth: layout.maxWidth,
    alignSelf: "center",
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg
  },
  card: {
    backgroundColor: palette.surfaceLow,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm
  },
  heading: {
    color: palette.primary,
    fontFamily: fonts.headlineHeavy,
    fontSize: 34,
    letterSpacing: -0.8,
    lineHeight: 40
  },
  subheading: {
    color: palette.primary,
    fontFamily: fonts.headlineBold,
    fontSize: 20,
    letterSpacing: -0.3,
    lineHeight: 26
  },
  body: {
    color: palette.ink,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22
  },
  bodyMuted: {
    color: palette.inkSoft
  },
  buttonWrap: {
    borderRadius: radius.lg,
    overflow: "hidden",
    ...shadows.botanical
  },
  button: {
    minHeight: 52,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  buttonPrimary: {
    minHeight: 54,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg
  },
  buttonSecondary: {
    backgroundColor: palette.surfaceHigh
  },
  buttonGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(194, 200, 194, 0.35)"
  },
  buttonDisabled: {
    opacity: 0.5
  },
  buttonPressed: {
    transform: [{ scale: 0.99 }]
  },
  buttonText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15
  },
  buttonTextPrimary: {
    color: palette.white
  },
  buttonTextSecondary: {
    color: palette.primary
  },
  buttonTextGhost: {
    color: palette.primary
  },
  chip: {
    alignSelf: "flex-start",
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: palette.surfaceMuted
  },
  chipPositive: {
    backgroundColor: palette.secondarySoft
  },
  chipWarning: {
    backgroundColor: palette.warningSoft
  },
  chipDanger: {
    backgroundColor: palette.dangerSoft
  },
  chipText: {
    color: palette.ink,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: "uppercase"
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md
  },
  rowLeft: {
    flex: 1
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(194, 200, 194, 0.22)"
  },
  input: {
    minHeight: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: "rgba(194, 200, 194, 0.28)",
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: palette.ink,
    fontFamily: fonts.body,
    fontSize: 15
  },
  inputMultiline: {
    minHeight: 120,
    textAlignVertical: "top"
  }
});
