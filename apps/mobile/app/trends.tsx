import type { SensorReading, Zone } from "@lawnpal/core";
import { buildTrendSummaries } from "@lawnpal/core";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { Body, Card, Chip, Heading, Screen, Subheading } from "@/components/ui";
import { localRepository } from "@/data/localRepository";
import { formatDate } from "@/lib/format";
import { useAppStore } from "@/store/appStore";
import { palette, spacing } from "@/theme";

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

        if (!active) {
          return;
        }

        setZones(zoneList);
        setReadings(history.reverse());
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
  const seriesColors = [palette.primary, palette.warning, palette.secondary, palette.danger];

  const multiZoneMoisture = useMemo(
    () =>
      zones.map((zone) => ({
        zone,
        data: readings
          .filter((reading) => reading.zoneId === zone.id)
          .slice(-8)
          .map((reading, index) => ({
            x: index + 1,
            y: reading.metrics.moisture
          }))
      })),
    [readings, zones]
  );

  return (
    <Screen>
      <Card>
        <Heading>Trends</Heading>
        <Body muted>
          Compare recent movement by zone and spot the patterns behind your weekly advice.
        </Body>
      </Card>

      <Card>
        <Subheading>Zone focus</Subheading>
        <View style={styles.zoneWrap}>
          {zones.map((zone) => {
            const active = zone.id === activeZoneId;
            return (
              <Pressable
                key={zone.id}
                onPress={() => setSelectedZoneId(zone.id)}
                style={[styles.zoneButton, active && styles.zoneButtonActive]}
              >
                <Text style={[styles.zoneText, active && styles.zoneTextActive]}>{zone.name}</Text>
              </Pressable>
            );
          })}
        </View>
        {trendSummaries.map((summary) => (
          <Body key={summary.key}>• {summary.text}</Body>
        ))}
      </Card>

      <Card>
        <Subheading>Zone comparison</Subheading>
        <Body muted>Moisture by zone over recent checks.</Body>
        <LineChart
          data={{
            labels: multiZoneMoisture[0]?.data.map((_, index) => `#${index + 1}`) ?? [],
            datasets: multiZoneMoisture.map((series, index) => ({
              data: series.data.map((point) => point.y),
              color: () => seriesColors[index % seriesColors.length] ?? palette.primary
            }))
          }}
          width={Math.max(280, width - 72)}
          height={220}
          fromZero={false}
          withDots={false}
          withInnerLines={false}
          withOuterLines={false}
          chartConfig={chartConfig}
          bezier
          style={styles.chart}
        />
        <View style={styles.legendWrap}>
          {multiZoneMoisture.map((series) => (
            <Chip key={series.zone.id} label={series.zone.name} />
          ))}
        </View>
      </Card>

      {chartMetrics.map((metric) => (
        <Card key={metric.key}>
          <Subheading>{metric.label}</Subheading>
          {activeZoneReadings.length ? (
            <>
              <LineChart
                data={{
                  labels: activeZoneReadings.map((reading) => formatDate(reading.takenAt).slice(0, 6)),
                  datasets: [
                    {
                      data: activeZoneReadings.map((reading) => reading.metrics[metric.key] as number),
                      color: () => palette.primary
                    }
                  ]
                }}
                width={Math.max(280, width - 72)}
                height={220}
                withDots={false}
                withInnerLines={false}
                withOuterLines={false}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
              />
              <Text style={styles.caption}>
                Showing {activeZoneReadings.length} readings for{" "}
                {zones.find((zone) => zone.id === activeZoneId)?.name ?? "this zone"}.
              </Text>
            </>
          ) : (
            <Body muted>No readings yet for this zone.</Body>
          )}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  zoneWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  zoneButton: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10
  },
  zoneButtonActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary
  },
  zoneText: {
    color: palette.ink,
    fontWeight: "600"
  },
  zoneTextActive: {
    color: "#FFFFFF"
  },
  legendWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs
  },
  chart: {
    marginLeft: -16,
    borderRadius: 18
  },
  caption: {
    color: palette.inkSoft,
    fontSize: 12
  }
});

const chartConfig = {
  backgroundColor: palette.surface,
  backgroundGradientFrom: palette.surface,
  backgroundGradientTo: palette.surface,
  decimalPlaces: 1,
  color: () => palette.primary,
  labelColor: () => palette.inkSoft,
  propsForBackgroundLines: {
    stroke: palette.border
  }
};
