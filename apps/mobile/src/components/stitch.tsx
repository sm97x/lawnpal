import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { PropsWithChildren, ReactNode } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { fonts, palette, radius, shadows, spacing } from "@/theme";

export const SectionEyebrow = ({
  children,
  tone = "muted"
}: PropsWithChildren<{ tone?: "muted" | "positive" | "danger" }>) => (
  <Text
    style={[
      styles.eyebrow,
      tone === "positive" && styles.eyebrowPositive,
      tone === "danger" && styles.eyebrowDanger
    ]}
  >
    {children}
  </Text>
);

export const StatusBadge = ({
  label,
  tone = "neutral"
}: {
  label: string;
  tone?: "neutral" | "positive" | "warning" | "danger";
}) => (
  <View
    style={[
      styles.statusBadge,
      tone === "positive" && styles.statusPositive,
      tone === "warning" && styles.statusWarning,
      tone === "danger" && styles.statusDanger
    ]}
  >
    <Text style={styles.statusBadgeText}>{label}</Text>
  </View>
);

export const ScoreRing = ({
  score,
  label = "Lawn Score",
  size = 136,
  accentColor = palette.primary
}: {
  score: number;
  label?: string;
  size?: number;
  accentColor?: string;
}) => {
  const clamped = Math.max(0, Math.min(score, 100));
  const strokeWidth = size > 180 ? 5 : 4;
  const radiusValue = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radiusValue;
  const offset = circumference * (1 - clamped / 100);

  return (
    <View style={[styles.scoreWrap, { width: size, height: size }]}>
      <Svg height={size} width={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radiusValue}
          stroke={palette.surfaceHighest}
          strokeWidth={1.5}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="none"
          r={radiusValue}
          stroke={accentColor}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View pointerEvents="none" style={styles.scoreContent}>
        <Text style={[styles.scoreValue, size > 180 && styles.scoreValueLarge]}>{Math.round(clamped)}</Text>
        <Text style={styles.scoreLabel}>{label}</Text>
      </View>
    </View>
  );
};

export const MetricTile = ({
  label,
  value,
  helper,
  icon,
  accentColor = palette.secondary,
  progress,
  suffix
}: {
  label: string;
  value: string;
  helper?: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  accentColor?: string;
  progress?: number;
  suffix?: string;
}) => (
  <View style={styles.metricTile}>
    <View style={styles.metricHeader}>
      <MaterialIcons color={accentColor} name={icon} size={18} />
      <SectionEyebrow>{label}</SectionEyebrow>
    </View>
    <View style={styles.metricBody}>
      <View style={styles.metricValueRow}>
        <Text style={styles.metricValue}>{value}</Text>
        {suffix ? <Text style={styles.metricSuffix}>{suffix}</Text> : null}
      </View>
      {typeof progress === "number" ? (
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { backgroundColor: accentColor, width: `${Math.max(0, Math.min(progress, 100))}%` }
            ]}
          />
        </View>
      ) : null}
      {helper ? <Text style={styles.metricHelper}>{helper}</Text> : null}
    </View>
  </View>
);

export const QuickAction = ({
  label,
  icon,
  onPress,
  active = false
}: {
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
  active?: boolean;
}) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.quickActionWrap, pressed && styles.pressed]}>
    {active ? (
      <LinearGradient
        colors={[palette.primary, palette.primaryContainer]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.quickActionActive}
      >
        <MaterialIcons color={palette.white} name={icon} size={18} />
        <Text style={styles.quickActionTextActive}>{label}</Text>
      </LinearGradient>
    ) : (
      <View style={styles.quickActionIdle}>
        <MaterialIcons color={palette.primary} name={icon} size={18} />
        <Text style={styles.quickActionText}>{label}</Text>
      </View>
    )}
  </Pressable>
);

export const SurfaceBlock = ({
  children,
  tone = "default"
}: PropsWithChildren<{ tone?: "default" | "raised" | "accent" }>) => (
  <View
    style={[
      styles.surfaceBlock,
      tone === "raised" && styles.surfaceRaised,
      tone === "accent" && styles.surfaceAccent
    ]}
  >
    {children}
  </View>
);

export const SettingRow = ({
  icon,
  title,
  description,
  right,
  destructive = false
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  description?: string;
  right?: ReactNode;
  destructive?: boolean;
}) => (
  <View style={styles.settingRow}>
    <View style={styles.settingLeft}>
      <View style={[styles.settingIconWrap, destructive && styles.settingIconWrapDanger]}>
        <MaterialIcons
          color={destructive ? palette.danger : palette.inkSoft}
          name={icon}
          size={18}
        />
      </View>
      <View style={styles.settingCopy}>
        <Text style={[styles.settingTitle, destructive && styles.settingTitleDanger]}>{title}</Text>
        {description ? <Text style={styles.settingDescription}>{description}</Text> : null}
      </View>
    </View>
    {right}
  </View>
);

export const SegmentedControl = ({
  value,
  options,
  onChange
}: {
  value: string;
  options: string[];
  onChange: (next: string) => void;
}) => (
  <View style={styles.segmentedWrap}>
    {options.map((option) => {
      const active = option === value;
      return (
        <Pressable
          key={option}
          onPress={() => onChange(option)}
          style={[styles.segmentedItem, active && styles.segmentedItemActive]}
        >
          <Text style={[styles.segmentedLabel, active && styles.segmentedLabelActive]}>{option}</Text>
        </Pressable>
      );
    })}
  </View>
);

export const ToggleAccessory = ({ value, onValueChange }: { value: boolean; onValueChange: (value: boolean) => void }) => (
  <Switch
    onValueChange={onValueChange}
    thumbColor={palette.white}
    trackColor={{ false: palette.surfaceHighest, true: palette.secondary }}
    value={value}
  />
);

const styles = StyleSheet.create({
  eyebrow: {
    color: palette.inkMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase"
  },
  eyebrowPositive: {
    color: palette.inkSoft
  },
  eyebrowDanger: {
    color: palette.danger
  },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: palette.surfaceHighest
  },
  statusPositive: {
    backgroundColor: palette.secondarySoft
  },
  statusWarning: {
    backgroundColor: palette.warningSoft
  },
  statusDanger: {
    backgroundColor: palette.dangerSoft
  },
  statusBadgeText: {
    color: palette.ink,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  scoreWrap: {
    alignItems: "center",
    justifyContent: "center"
  },
  scoreContent: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center"
  },
  scoreValue: {
    color: palette.primary,
    fontFamily: fonts.headlineHeavy,
    fontSize: 34,
    letterSpacing: -1.2
  },
  scoreValueLarge: {
    fontSize: 64
  },
  scoreLabel: {
    color: palette.inkMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase"
  },
  metricTile: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: "rgba(194, 200, 194, 0.18)",
    padding: spacing.lg,
    gap: spacing.md
  },
  metricHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  metricBody: {
    gap: spacing.sm
  },
  metricValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.xs
  },
  metricValue: {
    color: palette.primary,
    fontFamily: fonts.headlineBold,
    fontSize: 34,
    letterSpacing: -0.8
  },
  metricSuffix: {
    color: palette.inkMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 18
  },
  metricHelper: {
    color: palette.inkSoft,
    fontFamily: fonts.bodyMedium,
    fontSize: 12
  },
  progressTrack: {
    width: "100%",
    height: 4,
    borderRadius: radius.pill,
    overflow: "hidden",
    backgroundColor: palette.surfaceHighest
  },
  progressFill: {
    height: "100%",
    borderRadius: radius.pill
  },
  quickActionWrap: {
    minWidth: 112
  },
  quickActionActive: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    ...shadows.botanical
  },
  quickActionIdle: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: palette.surfaceHigh
  },
  quickActionText: {
    color: palette.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 14
  },
  quickActionTextActive: {
    color: palette.white,
    fontFamily: fonts.bodyBold,
    fontSize: 14
  },
  surfaceBlock: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    backgroundColor: palette.surfaceLow
  },
  surfaceRaised: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: "rgba(194, 200, 194, 0.18)"
  },
  surfaceAccent: {
    backgroundColor: palette.primaryContainer
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.md
  },
  settingLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  settingIconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceLow,
    alignItems: "center",
    justifyContent: "center"
  },
  settingIconWrapDanger: {
    backgroundColor: palette.dangerSoft
  },
  settingCopy: {
    flex: 1,
    gap: 2
  },
  settingTitle: {
    color: palette.primary,
    fontFamily: fonts.bodySemi,
    fontSize: 15
  },
  settingTitleDanger: {
    color: palette.danger
  },
  settingDescription: {
    color: palette.inkMuted,
    fontFamily: fonts.body,
    fontSize: 12
  },
  segmentedWrap: {
    flexDirection: "row",
    padding: 4,
    borderRadius: radius.lg,
    backgroundColor: palette.surfaceLow
  },
  segmentedItem: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    alignItems: "center"
  },
  segmentedItemActive: {
    backgroundColor: palette.white
  },
  segmentedLabel: {
    color: palette.inkMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 12
  },
  segmentedLabelActive: {
    color: palette.primary
  },
  pressed: {
    opacity: 0.85
  }
});
