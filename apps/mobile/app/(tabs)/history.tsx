import type { RecommendationSet, SensorReading, Zone } from "@lawnpal/core";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Body, Button, Card, Chip, Heading, Screen, Subheading } from "@/components/ui";
import { localRepository } from "@/data/localRepository";
import { formatDateTime, statusLabel } from "@/lib/format";
import { useAppStore } from "@/store/appStore";
import { palette, spacing } from "@/theme";

export default function HistoryScreen() {
  const version = useAppStore((state) => state.version);
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [summaries, setSummaries] = useState<Record<string, RecommendationSet | null>>({});

  useFocusEffect(
    useCallback(() => {
      const refreshToken = version;
      void refreshToken;
      let active = true;
      const load = async () => {
        const [history, zoneList] = await Promise.all([
          localRepository.getReadingHistory(50),
          localRepository.getZones()
        ]);
        const summaryEntries = await Promise.all(
          history.map(async (reading) => [
            reading.id,
            await localRepository.getRecommendationSetByReadingId(reading.id)
          ])
        );

        if (!active) {
          return;
        }

        setReadings(history);
        setZones(zoneList);
        setSummaries(Object.fromEntries(summaryEntries));
      };

      void load();
      return () => {
        active = false;
      };
    }, [version])
  );

  return (
    <Screen>
      <Card>
        <Heading>History</Heading>
        <Body muted>See past readings, zone differences and how your plan has shifted over time.</Body>
      </Card>

      <Button label="View trends" tone="secondary" onPress={() => router.push("/trends")} />

      {readings.map((reading) => {
        const zoneName = zones.find((zone) => zone.id === reading.zoneId)?.name ?? "Unknown zone";
        const summary = summaries[reading.id];
        return (
          <Pressable
            key={reading.id}
            onPress={() => router.push(`/history/${reading.id}`)}
            style={styles.pressable}
          >
            <Card>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Subheading>{zoneName}</Subheading>
                  <Text style={styles.meta}>{formatDateTime(reading.takenAt)}</Text>
                </View>
                {summary ? <Chip label={statusLabel(summary.lawnStatus)} /> : null}
              </View>
              <Body>{summary?.mainIssue ?? "Reading saved"}</Body>
            </Card>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: 24
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  meta: {
    color: palette.inkSoft,
    marginTop: 4
  }
});
