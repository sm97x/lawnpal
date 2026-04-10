import type { RecommendationSet, SensorReading, Zone } from "@lawnpal/core";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/appChrome";
import { ScoreRing, SectionEyebrow, SurfaceBlock } from "@/components/stitch";
import { Button } from "@/components/ui";
import { localRepository } from "@/data/localRepository";
import {
  formatTemperature,
  formatTemperatureRange,
  relativeCheckLabel,
  statusLabel
} from "@/lib/format";
import { useAppStore } from "@/store/appStore";
import { fonts, palette, radius, spacing } from "@/theme";

const targetMeta = (
  reading: SensorReading,
  metricSystem: "metric" | "imperial"
): {
  label: string;
  value: string;
  status: string;
  statusTone: string;
  target: string;
}[] => [
  {
    label: "Moisture",
    value: `${Math.round(reading.metrics.moisture)}%`,
    status: reading.metrics.moisture < 35 ? "Critically Low" : reading.metrics.moisture > 75 ? "High" : "Healthy",
    statusTone: reading.metrics.moisture < 35 ? palette.danger : palette.inkSoft,
    target: "Target: 45-60%"
  },
  {
    label: "Soil Temp",
    value: formatTemperature(reading.metrics.soilTemperatureC, metricSystem),
    status: reading.metrics.soilTemperatureC > 10 && reading.metrics.soilTemperatureC < 28 ? "Optimal" : "Watch",
    statusTone: palette.inkSoft,
    target: `Target: ${formatTemperatureRange(18, 27, metricSystem)}`
  },
  {
    label: "Acidity (pH)",
    value: reading.metrics.ph.toFixed(1),
    status: reading.metrics.ph >= 6 && reading.metrics.ph <= 7 ? "Healthy" : "Watch",
    statusTone: palette.inkSoft,
    target: "Target: 6.0-7.0"
  },
  {
    label: "Nutrients (EC)",
    value: reading.metrics.ec.toFixed(1),
    status: reading.metrics.ec > 2.2 ? "Elevated" : reading.metrics.ec < 1.2 ? "Low" : "In Range",
    statusTone: reading.metrics.ec > 2.2 ? palette.warning : palette.inkSoft,
    target: "Target: 1.2-2.2"
  }
];

export default function ResultScreen() {
  const { readingId } = useLocalSearchParams<{ readingId: string }>();
  const metricSystem = useAppStore((state) => state.metricSystem);
  const [reading, setReading] = useState<SensorReading | null>(null);
  const [summary, setSummary] = useState<RecommendationSet | null>(null);
  const [zone, setZone] = useState<Zone | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const load = async () => {
        const nextReading = await localRepository.getReadingById(readingId);
        const nextSummary = await localRepository.getRecommendationSetByReadingId(readingId);
        const nextZone = nextReading ? await localRepository.getZoneById(nextReading.zoneId) : null;

        if (!active) {
          return;
        }

        setReading(nextReading);
        setSummary(nextSummary);
        setZone(nextZone);
      };

      void load();
      return () => {
        active = false;
      };
    }, [readingId])
  );

  if (!reading || !summary) {
    return (
      <AppScreen navKey="scan">
        <SurfaceBlock>
          <Text style={styles.missingTitle}>Reading not found</Text>
        </SurfaceBlock>
      </AppScreen>
    );
  }

  return (
    <AppScreen navKey="scan">
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <SectionEyebrow>{zone ? `${zone.name} | ${statusLabel(summary.lawnStatus)}` : "Scan Result"}</SectionEyebrow>
          <Text style={styles.heroTitle}>
            {summary.lawnStatus === "at-risk" ? "Action Required" : statusLabel(summary.lawnStatus)}
          </Text>
        </View>
        <ScoreRing label="Score" score={summary.lawnScore} size={132} />
      </View>

      <SurfaceBlock>
        <Text style={styles.verdictTitle}>{summary.mainIssue}</Text>
        <Text style={styles.verdictBody}>{summary.summary}</Text>
      </SurfaceBlock>

      <View style={styles.metricGrid}>
        {targetMeta(reading, metricSystem).map((metric) => (
          <View key={metric.label} style={styles.metricCard}>
            <View>
              <Text style={styles.metricLabel}>{metric.label}</Text>
              <Text style={styles.metricValue}>{metric.value}</Text>
            </View>
            <View style={styles.metricMeta}>
              <Text style={[styles.metricStatus, { color: metric.statusTone }]}>{metric.status}</Text>
              <Text style={styles.metricTarget}>{metric.target}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.protocolGrid}>
        <View style={styles.protocolColumn}>
          <Text style={styles.protocolTitle}>Immediate Protocol</Text>
          <View style={styles.protocolList}>
            {(summary.doNow.length ? summary.doNow : ["Monitor the next scan closely"]).slice(0, 3).map((item) => (
              <View key={item} style={styles.protocolRowPositive}>
                <Text style={styles.protocolText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={styles.protocolColumn}>
          <Text style={[styles.protocolTitle, styles.protocolTitleDanger]}>Restrict Actions</Text>
          <View style={styles.protocolList}>
            {(summary.avoid.length ? summary.avoid : ["No major restrictions right now"]).slice(0, 3).map((item) => (
              <View key={item} style={styles.protocolRowDanger}>
                <Text style={styles.protocolText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      <Button label="View Schedule" onPress={() => router.push("/history")} />

      <View style={styles.linkRow}>
        <Text style={styles.linkButton} onPress={() => router.push(`/history/${reading.id}`)}>
          View Scan History
        </Text>
        <Text style={styles.linkButton} onPress={() => router.push("/ask")}>
          Discuss with AI
        </Text>
      </View>

      <Text style={styles.recheckText}>{relativeCheckLabel(summary.checkAgainAt)}</Text>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.lg
  },
  heroCopy: {
    flex: 1,
    gap: spacing.xs
  },
  heroTitle: {
    color: palette.primary,
    fontFamily: fonts.headlineHeavy,
    fontSize: 38,
    letterSpacing: -1
  },
  verdictTitle: {
    color: palette.primary,
    fontFamily: fonts.headlineBold,
    fontSize: 28,
    lineHeight: 34
  },
  verdictBody: {
    color: palette.inkSoft,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    lineHeight: 24
  },
  metricGrid: {
    gap: spacing.sm
  },
  metricCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(194, 200, 194, 0.18)",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md
  },
  metricLabel: {
    color: palette.inkMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  metricValue: {
    color: palette.primary,
    fontFamily: fonts.headlineBold,
    fontSize: 28,
    marginTop: 4
  },
  metricMeta: {
    justifyContent: "center",
    alignItems: "flex-end"
  },
  metricStatus: {
    fontFamily: fonts.bodyBold,
    fontSize: 12
  },
  metricTarget: {
    color: palette.inkMuted,
    fontFamily: fonts.body,
    fontSize: 11,
    marginTop: 4
  },
  protocolGrid: {
    gap: spacing.xl
  },
  protocolColumn: {
    gap: spacing.md
  },
  protocolTitle: {
    color: palette.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase"
  },
  protocolTitleDanger: {
    color: palette.danger
  },
  protocolList: {
    gap: spacing.sm
  },
  protocolRowPositive: {
    backgroundColor: "rgba(201, 231, 204, 0.3)",
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  protocolRowDanger: {
    backgroundColor: "rgba(255, 218, 214, 0.4)",
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  protocolText: {
    color: palette.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 14
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xl
  },
  linkButton: {
    color: palette.inkSoft,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 1.6,
    textTransform: "uppercase"
  },
  recheckText: {
    color: palette.inkMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    textAlign: "center"
  },
  missingTitle: {
    color: palette.primary,
    fontFamily: fonts.headlineBold,
    fontSize: 24
  }
});
