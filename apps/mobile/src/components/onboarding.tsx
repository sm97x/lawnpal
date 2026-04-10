import { MaterialIcons } from "@expo/vector-icons";
import type { PropsWithChildren, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/appChrome";
import { SectionEyebrow } from "@/components/stitch";
import { fonts, palette, radius, spacing } from "@/theme";

export const OnboardingScreen = ({
  children,
  description,
  eyebrow,
  footer,
  icon = "spa",
  step,
  title,
  totalSteps = 4
}: PropsWithChildren<{
  description: string;
  eyebrow: string;
  footer?: ReactNode;
  icon?: keyof typeof MaterialIcons.glyphMap;
  step?: number;
  title: string;
  totalSteps?: number;
}>) => (
  <AppScreen contentContainerStyle={styles.screenContent} showNav={false} showTopBar={false}>
    <View style={styles.topRow}>
      <View style={styles.brandPill}>
        <MaterialIcons color={palette.primary} name="eco" size={16} />
        <Text style={styles.brandText}>LawnPal</Text>
      </View>
      {step ? <Text style={styles.stepText}>{`Step ${step} / ${totalSteps}`}</Text> : null}
    </View>

    <View style={styles.hero}>
      <View style={styles.heroOrb}>
        <View style={styles.heroOrbInner}>
          <MaterialIcons color={palette.primary} name={icon} size={26} />
        </View>
      </View>
      <SectionEyebrow>{eyebrow}</SectionEyebrow>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {step ? (
        <View style={styles.progressRow}>
          {Array.from({ length: totalSteps }, (_, index) => {
            const filled = index < step;
            return <View key={index} style={[styles.progressDot, filled && styles.progressDotFilled]} />;
          })}
        </View>
      ) : null}
    </View>

    <View style={styles.body}>{children}</View>
    {footer}
  </AppScreen>
);

export const ChoicePill = ({
  active,
  icon,
  label,
  onPress
}: {
  active?: boolean;
  icon?: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
}) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.choicePill,
      active && styles.choicePillActive,
      pressed && styles.choicePillPressed
    ]}
  >
    {icon ? (
      <MaterialIcons color={active ? palette.white : palette.primary} name={icon} size={16} />
    ) : null}
    <Text style={[styles.choiceLabel, active && styles.choiceLabelActive]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  screenContent: {
    paddingTop: spacing.xl
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md
  },
  brandPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceLow,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  brandText: {
    color: palette.primary,
    fontFamily: fonts.headlineBold,
    fontSize: 13,
    letterSpacing: 0.4
  },
  stepText: {
    color: palette.inkMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase"
  },
  hero: {
    gap: spacing.md
  },
  heroOrb: {
    width: 84,
    height: 84,
    borderRadius: radius.pill,
    backgroundColor: "rgba(74, 101, 79, 0.1)",
    alignItems: "center",
    justifyContent: "center"
  },
  heroOrbInner: {
    width: 58,
    height: 58,
    borderRadius: radius.pill,
    backgroundColor: palette.surface,
    alignItems: "center",
    justifyContent: "center"
  },
  title: {
    color: palette.primary,
    fontFamily: fonts.headlineHeavy,
    fontSize: 38,
    letterSpacing: -1.1,
    lineHeight: 42
  },
  description: {
    color: palette.inkSoft,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm
  },
  progressDot: {
    width: 28,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceHighest
  },
  progressDotFilled: {
    backgroundColor: palette.secondary
  },
  body: {
    gap: spacing.lg
  },
  choicePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: "rgba(194, 200, 194, 0.32)",
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  choicePillActive: {
    borderColor: palette.primary,
    backgroundColor: palette.primary
  },
  choicePillPressed: {
    opacity: 0.84
  },
  choiceLabel: {
    color: palette.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 13
  },
  choiceLabelActive: {
    color: palette.white
  }
});
