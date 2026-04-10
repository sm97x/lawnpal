import type { SensorReading, Zone } from "@lawnpal/core";
import { buildTrendSummaries } from "@lawnpal/core";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { AppScreen } from "@/components/appChrome";
import { SectionEyebrow, SurfaceBlock } from "@/components/stitch";
import { localRepository } from "@/data/localRepository";
import { formatDate } from "@/lib/format";
import { useAppStore } from "@/store/appStore";
import { fonts, palette, spacing } from "@/theme";

const chartMetrics: { key: keyof SensorReading["metrics"]; label: string }[] = [
  { key: "moisture", label: "Moisture" },
  { key: "soilTemperatureC", label: "Soil temperature" },
  { key: "ph", label: "pH" },
  { key: "ec", label: "EC" }
];

export default function TrendsScreen() {
  const selectedZoneId = useAppStore((state) => state.selectedZoneId);
  const setSelectedZoneId = useAppStore((state) => state.setSelectedZoneId);
  const version = useAppStore((state) => state.version);
  const [zones, setZones] = useState<Zone[]>([]);
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const { width } = useWindowDimensions();

  useFocusEffect(
    useCallback(() => {
      const refreshToken = version;
      void refreshToken;
      let active = true;
      const load = async () => {
        const [zoneList, history] = await Promise.all([
          localRepository.getZones(),
          localRepository.getReadingHistory(60)
        ]);
        if (active) {
          setZones(zoneList);
          setReadings(history.reverse());
        }
      };
      void load();
      return () => {
        active = false;
      };
    }, [version])
  );

  const activeZoneId = selectedZoneId ?? zones[0]?.id;
  const activeZoneReadings = readings.filter((reading) => reading.zoneId === activeZoneId);
  const trendSummaries = buildTrendSummaries(readings, activeZoneId ?? "");

  const chartWidth = Math.max(280, Math.min(width - 40, 760));
  const chartConfig = {
    backgroundGradientFrom: palette.surface,
    backgroundGradientTo: palette.surface,
    color: () => palette.primary,
    labelColor: () => palette.inkMuted,
    decimalPlaces: 1,
    propsForBackgroundLines: {
      stroke: "rgba(194, 200, 194, 0.2)"
    }
  };

  const multiZoneMoisture = useMemo(
    () =>
      zones.map((zone) => ({
        zone,
        data: readings
          .filter((reading) => reading.zoneId === zone.id)
          .slice(-8)
          .map((reading) => reading.metrics.moisture)
      })),
    [readings, zones]
  );

  return (
    <AppScreen navKey="history">
      <View style={styles.header}>
        <Text style={styles.title}>Trends</Text>
        <Text style={styles.subtitle}>Compare recent movement by zone and surface the patterns behind your weekly advice.</Text>
      </View>

      <SurfaceBlock tone="raised">
        <SectionEyebrow>Zone Focus</SectionEyebrow>
        <View style={styles.zoneRow}>
          {zones.map((zone) => {
            const active = zone.id === activeZoneId;
            return (
              <Pressable
                key={zone.id}
                onPress={() => setSelectedZoneId(zone.id)}
                style={[styles.zonePill, active && styles.zonePillActive]}
              >
                <Text style={[styles.zoneText, active && styles.zoneTextActive]}>{zone.name}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.summaryList}>
          {trendSummaries.map((summary) => (
            <Text key={summary.key} style={styles.summaryItem}>
              {summary.text}
            </Text>
          ))}
        </View>
      </SurfaceBlock>

      <SurfaceBlock tone="raised">
        <SectionEyebrow>Zone Comparison</SectionEyebrow>
        <LineChart
          bezier
          chartConfig={chartConfig}
          data={{
            labels: multiZoneMoisture[0]?.data.map((_, index) => `#${index + 1}`) ?? [],
            datasets: multiZoneMoisture.map((series) => ({ data: series.data.length ? series.data : [0] }))
          }}
          fromZero={false}
          height={220}
          width={chartWidth}
          withDots={false}
        />
      </SurfaceBlock>

      {chartMetrics.map((metric) => (
        <SurfaceBlock key={metric.key} tone="raised">
          <SectionEyebrow>{metric.label}</SectionEyebrow>
          {activeZoneReadings.length ? (
            <LineChart
              bezier
              chartConfig={chartConfig}
              data={{
                labels: activeZoneReadings.map((reading) => formatDate(reading.takenAt).slice(0, 6)),
                datasets: [{ data: activeZoneReadings.map((reading) => reading.metrics[metric.key]) }]
              }}
              height={220}
              width={chartWidth}
              withDots={false}
            />
          ) : (
            <Text style={styles.summaryItem}>No readings in this zone yet.</Text>
          )}
        </SurfaceBlock>
      ))}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.xs
  },
  title: {
    color: palette.primary,
    fontFamily: fonts.headlineHeavy,
    fontSize: 38,
    letterSpacing: -1
  },
  subtitle: {
    color: palette.inkSoft,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22
  },
  zoneRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  zonePill: {
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: palette.surfaceLow
  },
  zonePillActive: {
    backgroundColor: palette.primary
  },
  zoneText: {
    color: palette.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 13
  },
  zoneTextActive: {
    color: palette.white
  },
  summaryList: {
    gap: spacing.sm
  },
  summaryItem: {
    color: palette.inkSoft,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21
  }
});
