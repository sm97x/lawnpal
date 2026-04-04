import type { RecommendationSet, SensorReading, Zone } from "@lawnpal/core";
import { useLocalSearchParams, useFocusEffect, router } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Body, Button, Card, Chip, Heading, Screen, Subheading } from "@/components/ui";
import { localRepository } from "@/data/localRepository";
import { describeMetric, relativeCheckLabel, statusLabel } from "@/lib/format";
import { palette, spacing } from "@/theme";

export default function ResultScreen() {
  const { readingId } = useLocalSearchParams<{ readingId: string }>();
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
      <Screen>
        <Card>
          <Heading>Reading not found</Heading>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <Chip label={statusLabel(summary.lawnStatus)} />
        <Heading>{zone?.name ?? "Zone result"}</Heading>
        <Text style={styles.score}>{summary.lawnScore}/100</Text>
        <Body>{summary.mainIssue}</Body>
        <Body muted>{summary.summary}</Body>
      </Card>

      <Card>
        <Subheading>Current values</Subheading>
        {Object.entries(reading.metrics).map(([key, value]) => (
          <View key={key} style={styles.metricRow}>
            <Text style={styles.metricLabel}>{key}</Text>
            <Text style={styles.metricValue}>
              {describeMetric(key as keyof SensorReading["metrics"], value as number)}
            </Text>
          </View>
        ))}
      </Card>

      <Card>
        <Subheading>What to do now</Subheading>
        {summary.doNow.map((item) => (
          <Body key={item}>• {item}</Body>
        ))}
        <Text style={styles.muted}>{relativeCheckLabel(summary.checkAgainAt)}</Text>
      </Card>

      <Card>
        <Subheading>What not to do</Subheading>
        {summary.avoid.length ? (
          summary.avoid.map((item) => <Body key={item}>• {item}</Body>)
        ) : (
          <Body muted>No major avoidances this week.</Body>
        )}
      </Card>

      <Card>
        <Subheading>Why Lawn Pal said this</Subheading>
        {summary.recommendations.map((recommendation) => (
          <View key={recommendation.id} style={styles.recommendation}>
            <Text style={styles.metricLabel}>{recommendation.title}</Text>
            <Text style={styles.muted}>{recommendation.explanation}</Text>
          </View>
        ))}
      </Card>

      <Button label="Back home" onPress={() => router.replace("/(tabs)")} />
      <Button label="View history detail" tone="ghost" onPress={() => router.push(`/history/${reading.id}`)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  score: {
    color: palette.primary,
    fontSize: 42,
    fontWeight: "800"
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md
  },
  metricLabel: {
    color: palette.ink,
    fontWeight: "700",
    textTransform: "capitalize",
    flex: 1
  },
  metricValue: {
    color: palette.inkSoft,
    flex: 1,
    textAlign: "right"
  },
  recommendation: {
    gap: 6
  },
  muted: {
    color: palette.inkSoft
  }
});
