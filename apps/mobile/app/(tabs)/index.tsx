import type { RecommendationSet, ScheduleTask, SensorReading, Zone } from "@lawnpal/core";
import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { AppScreen } from "@/components/appChrome";
import {
  MetricTile,
  QuickAction,
  ScoreRing,
  SectionEyebrow,
  StatusBadge,
  SurfaceBlock
} from "@/components/stitch";
import { Body, Button, Heading } from "@/components/ui";
import { localRepository } from "@/data/localRepository";
import {
  formatRelativeTimestamp,
  formatTemperature,
  relativeCheckLabel,
  statusLabel
} from "@/lib/format";
import { weatherService } from "@/services/weatherService";
import { useAppStore } from "@/store/appStore";
import { fonts, palette, spacing } from "@/theme";

const heroCopy: Record<RecommendationSet["lawnStatus"], { badge: string; title: string }> = {
  thriving: { badge: "Optimal Health", title: "thriving" },
  stable: { badge: "Steady Conditions", title: "stable" },
  "slightly-stressed": { badge: "Needs Attention", title: "under pressure" },
  "at-risk": { badge: "Action Required", title: "at risk" }
};

const rangeLabel = (reading: SensorReading, metricSystem: "metric" | "imperial") => ({
  moisture:
    reading.metrics.moisture >= 60 && reading.metrics.moisture <= 70
      ? "Ideal range 60-70%"
      : reading.metrics.moisture < 60
        ? "Hydration below target"
        : "Holding extra moisture",
  soilTemperatureC:
    reading.metrics.soilTemperatureC >= 14 && reading.metrics.soilTemperatureC <= 22
      ? "Peak growing window"
      : "Monitor the next weather swing",
  ph:
    reading.metrics.ph >= 6 && reading.metrics.ph <= 7
      ? "Optimal balance"
      : "Worth watching over time",
  ec:
    reading.metrics.ec >= 1.2 && reading.metrics.ec <= 2.2
      ? "Nutrient uptake in range"
      : reading.metrics.ec < 1.2
        ? "Slightly low"
        : "Reading elevated",
  tempValue: formatTemperature(reading.metrics.soilTemperatureC, metricSystem)
});

export default function HomeScreen() {
  const lawn = useAppStore((state) => state.lawn);
  const location = useAppStore((state) => state.location);
  const metricSystem = useAppStore((state) => state.metricSystem);
  const version = useAppStore((state) => state.version);
  const [latestReading, setLatestReading] = useState<SensorReading | null>(null);
  const [latestSummary, setLatestSummary] = useState<RecommendationSet | null>(null);
  const [tasks, setTasks] = useState<ScheduleTask[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);

  useFocusEffect(
    useCallback(() => {
      const refreshToken = version;
      void refreshToken;
      let active = true;

      const load = async () => {
        const [readingHistory, summary, taskList, zoneList] = await Promise.all([
          localRepository.getReadingHistory(1),
          localRepository.getLatestRecommendationSet(),
          localRepository.getTasks(4),
          localRepository.getZones()
        ]);

        if (!active) {
          return;
        }

        setLatestReading(readingHistory[0] ?? null);
        setLatestSummary(summary);
        setTasks(taskList);
        setZones(zoneList);
      };

      void load();
      return () => {
        active = false;
      };
    }, [version])
  );

  const weatherQuery = useQuery({
    enabled: Boolean(location),
    queryKey: ["weather", location?.lat, location?.lon, version],
    queryFn: () => weatherService.fetchForecast(location!)
  });

  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const activeZone = useMemo(
    () => zones.find((zone) => zone.id === latestReading?.zoneId) ?? zones[0] ?? null,
    [latestReading?.zoneId, zones]
  );

  if (!latestSummary || !latestReading) {
    return (
      <AppScreen navKey="lawn">
        <SurfaceBlock>
          <SectionEyebrow>Environmental Intelligence</SectionEyebrow>
          <Heading>Your lawn plan starts with one scan</Heading>
          <Body muted>
            Take a reading to populate the stitched dashboard, current metrics, and next-step plan.
          </Body>
        </SurfaceBlock>
        <SurfaceBlock tone="raised">
          <View style={styles.emptyHero}>
            <ScoreRing label="Lawn Score" score={0} size={176} />
            <View style={styles.emptyHeroCopy}>
              <Text style={styles.emptyZoneLabel}>{lawn?.name ?? "LawnPal"}</Text>
              <Text style={styles.emptyHeroTitle}>No live signal yet</Text>
              <Text style={styles.emptyHeroText}>
                Scan once to unlock your moisture, soil temperature, pH, and nutrient dashboard.
              </Text>
            </View>
          </View>
        </SurfaceBlock>
        <Button label="Scan the lawn" onPress={() => router.push("/scan")} />
      </AppScreen>
    );
  }

  const hero = heroCopy[latestSummary.lawnStatus];
  const taskLead = tasks[0]?.title ?? latestSummary.doNow[0] ?? "Review the latest lawn reading";
  const taskReason = tasks[0]?.reason ?? latestSummary.summary;
  const ranges = rangeLabel(latestReading, metricSystem);

  return (
    <AppScreen navKey="lawn">
      <View style={[styles.heroSection, wide && styles.heroSectionWide]}>
        <View style={styles.heroCopy}>
          <View style={styles.heroMeta}>
            <StatusBadge label={hero.badge} tone={latestSummary.lawnStatus === "thriving" ? "positive" : latestSummary.lawnStatus === "at-risk" ? "danger" : "neutral"} />
            <Text style={styles.updatedText}>{formatRelativeTimestamp(latestReading.takenAt)}</Text>
          </View>
          <Text style={styles.heroTitle}>
            Your lawn is <Text style={styles.heroAccent}>{hero.title}</Text>
          </Text>
          <Text style={styles.heroBody}>{latestSummary.summary}</Text>
          {activeZone ? <Text style={styles.zoneText}>{activeZone.name}</Text> : null}
        </View>
        <View style={styles.ringWrap}>
          <ScoreRing label="Lawn Score" score={latestSummary.lawnScore} size={wide ? 220 : 176} />
        </View>
      </View>

      <View style={styles.quickActions}>
        <QuickAction active icon="insights" label="Trends" onPress={() => router.push("/trends")} />
        <QuickAction icon="eco" label="Products" onPress={() => router.push("/products")} />
        <QuickAction icon="calendar-today" label="Schedule" onPress={() => router.push("/history")} />
      </View>

      <SurfaceBlock>
        <SectionEyebrow>{"This Week's Plan"}</SectionEyebrow>
        <Text style={styles.planTitle}>{taskLead}</Text>
        <Text style={styles.planBody}>{taskReason}</Text>
        <View style={styles.planFooter}>
          <Text style={styles.planFootnote}>{relativeCheckLabel(latestSummary.checkAgainAt)}</Text>
          <Text style={styles.planLink} onPress={() => router.push("/history")}>
            View full schedule
          </Text>
        </View>
        {weatherQuery.data ? (
          <Text style={styles.weatherNote}>
            Natural assist: {weatherQuery.data.current.summary.toLowerCase()} and{" "}
            {weatherQuery.data.current.rainProbability}% rain chance today.
          </Text>
        ) : null}
      </SurfaceBlock>

      <View style={styles.metricsGrid}>
        <MetricTile
          accentColor={palette.secondary}
          helper={ranges.moisture}
          icon="water-drop"
          label="Moisture"
          progress={latestReading.metrics.moisture}
          value={String(Math.round(latestReading.metrics.moisture))}
          suffix="%"
        />
        <MetricTile
          accentColor={palette.danger}
          helper={ranges.soilTemperatureC}
          icon="thermostat"
          label="Soil Temp"
          progress={Math.min(100, Math.max(0, latestReading.metrics.soilTemperatureC * 4))}
          value={ranges.tempValue.split(" ")[0] ?? ranges.tempValue}
          suffix={ranges.tempValue.split(" ")[1]}
        />
        <MetricTile
          accentColor={palette.primary}
          helper={ranges.ph}
          icon="science"
          label="Soil pH"
          progress={Math.min(100, Math.max(0, (latestReading.metrics.ph / 8) * 100))}
          value={latestReading.metrics.ph.toFixed(1)}
          suffix="pH"
        />
        <MetricTile
          accentColor={palette.secondary}
          helper={ranges.ec}
          icon="bolt"
          label="Nutrient EC"
          progress={Math.min(100, latestReading.metrics.ec * 30)}
          value={latestReading.metrics.ec.toFixed(1)}
          suffix="ms"
        />
      </View>

      {tasks.length ? (
        <SurfaceBlock tone="raised">
          <SectionEyebrow>Upcoming Tasks</SectionEyebrow>
          <View style={styles.taskList}>
            {tasks.slice(0, 3).map((task) => (
              <View key={task.id} style={styles.taskRow}>
                <View style={styles.taskCopy}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <Text style={styles.taskMeta}>{task.startDate.slice(0, 10)}</Text>
                </View>
                <Text style={styles.taskStatus}>{task.status}</Text>
              </View>
            ))}
          </View>
        </SurfaceBlock>
      ) : null}

      <Button label={`Open ${statusLabel(latestSummary.lawnStatus)} reading`} onPress={() => router.push(`/result/${latestReading.id}`)} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heroSection: {
    gap: spacing.lg
  },
  heroSectionWide: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  heroCopy: {
    flex: 1,
    gap: spacing.md
  },
  heroMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flexWrap: "wrap"
  },
  updatedText: {
    color: palette.inkMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  heroTitle: {
    color: palette.primary,
    fontFamily: fonts.headlineHeavy,
    fontSize: 42,
    lineHeight: 46,
    letterSpacing: -1.1
  },
  heroAccent: {
    color: palette.secondary,
    fontFamily: fonts.headlineHeavy,
    fontStyle: "italic"
  },
  heroBody: {
    color: palette.inkSoft,
    fontFamily: fonts.bodyMedium,
    fontSize: 17,
    lineHeight: 25
  },
  zoneText: {
    color: palette.inkMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  ringWrap: {
    alignItems: "center"
  },
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  planTitle: {
    color: palette.primary,
    fontFamily: fonts.headlineBold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.8
  },
  planBody: {
    color: palette.inkSoft,
    fontFamily: fonts.bodyMedium,
    fontSize: 16,
    lineHeight: 24
  },
  planFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(194, 200, 194, 0.18)"
  },
  planFootnote: {
    color: palette.inkMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 13
  },
  planLink: {
    color: palette.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 13
  },
  weatherNote: {
    marginTop: spacing.sm,
    color: palette.inkSoft,
    fontFamily: fonts.body,
    fontSize: 13
  },
  metricsGrid: {
    gap: spacing.md
  },
  taskList: {
    gap: spacing.md
  },
  taskRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(194, 200, 194, 0.16)"
  },
  taskCopy: {
    flex: 1
  },
  taskTitle: {
    color: palette.primary,
    fontFamily: fonts.bodySemi,
    fontSize: 15
  },
  taskMeta: {
    color: palette.inkMuted,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2
  },
  taskStatus: {
    color: palette.inkSoft,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  emptyHero: {
    gap: spacing.xl,
    alignItems: "center"
  },
  emptyHeroCopy: {
    gap: spacing.sm,
    alignItems: "center"
  },
  emptyZoneLabel: {
    color: palette.inkMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  emptyHeroTitle: {
    color: palette.primary,
    fontFamily: fonts.headlineBold,
    fontSize: 26
  },
  emptyHeroText: {
    color: palette.inkSoft,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center"
  }
});
