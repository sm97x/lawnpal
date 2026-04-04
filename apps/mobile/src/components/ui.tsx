import type { PropsWithChildren, ReactNode } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { palette, spacing } from "../theme";

export const Screen = ({
  children,
  scroll = true
}: PropsWithChildren<{ scroll?: boolean }>) => {
  if (scroll) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>{children}</ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.fill}>{children}</View>
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
    style={({ pressed }) => [
      styles.button,
      tone === "primary" && styles.buttonPrimary,
      tone === "secondary" && styles.buttonSecondary,
      tone === "ghost" && styles.buttonGhost,
      disabled && styles.buttonDisabled,
      pressed && !disabled && styles.buttonPressed
    ]}
  >
    <Text
      style={[
        styles.buttonText,
        tone === "ghost" ? styles.buttonTextGhost : styles.buttonTextPrimary
      ]}
    >
      {label}
    </Text>
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
    value={value}
    onChangeText={onChangeText}
    placeholder={placeholder}
    placeholderTextColor={palette.inkSoft}
    multiline={multiline}
    style={[styles.input, multiline && styles.inputMultiline]}
  />
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background
  },
  fill: {
    flex: 1,
    padding: spacing.lg
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.md
  },
  card: {
    backgroundColor: palette.surface,
    borderRadius: 24,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
    shadowColor: palette.shadow,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 2,
    gap: spacing.sm
  },
  heading: {
    fontSize: 30,
    lineHeight: 36,
    color: palette.ink,
    fontWeight: "700"
  },
  subheading: {
    fontSize: 18,
    lineHeight: 24,
    color: palette.ink,
    fontWeight: "600"
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: palette.ink
  },
  bodyMuted: {
    color: palette.inkSoft
  },
  button: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  buttonPrimary: {
    backgroundColor: palette.primary
  },
  buttonSecondary: {
    backgroundColor: palette.primarySoft
  },
  buttonGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: palette.border
  },
  buttonDisabled: {
    opacity: 0.5
  },
  buttonPressed: {
    transform: [{ scale: 0.99 }]
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600"
  },
  buttonTextPrimary: {
    color: "#FFFFFF"
  },
  buttonTextGhost: {
    color: palette.ink
  },
  chip: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: palette.surfaceMuted
  },
  chipPositive: {
    backgroundColor: palette.primarySoft
  },
  chipWarning: {
    backgroundColor: palette.warningSoft
  },
  chipDanger: {
    backgroundColor: palette.dangerSoft
  },
  chipText: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.ink
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
    backgroundColor: palette.border
  },
  input: {
    minHeight: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: palette.ink,
    fontSize: 15
  },
  inputMultiline: {
    minHeight: 120,
    textAlignVertical: "top"
  }
});
