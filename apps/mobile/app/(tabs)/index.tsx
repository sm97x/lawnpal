import type { RecommendationSet, ScheduleTask, SensorReading } from "@lawnpal/core";
import { useQuery } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Body,
  Button,
  Card,
  Chip,
  Divider,
  Heading,
  Row,
  Screen,
  Subheading
} from "@/components/ui";
import { localRepository } from "@/data/localRepository";
import { relativeCheckLabel, statusLabel } from "@/lib/format";
import { weatherService } from "@/services/weatherService";
import { useAppStore } from "@/store/appStore";
import { palette, spacing } from "@/theme";

const toneForStatus = (status?: RecommendationSet["lawnStatus"]) => {
  switch (status) {
    case "thriving":
      return "positive" as const;
    case "stable":
      return "neutral" as const;
    case "slightly-stressed":
      return "warning" as const;
    case "at-risk":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
};

export default function HomeScreen() {
  const lawn = useAppStore((state) => state.lawn);
  const location = useAppStore((state) => state.location);
  const version = useAppStore((state) => state.version);
  const [latestReading, setLatestReading] = useState<SensorReading | null>(null);
  const [latestSummary, setLatestSummary] = useState<RecommendationSet | null>(null);
  const [tasks, setTasks] = useState<ScheduleTask[]>([]);

  useFocusEffect(
    useCallback(() => {
      const refreshToken = version;
      void refreshToken;
      let active = true;
      const load = async () => {
        const [readingHistory, summary, taskList] = await Promise.all([
          localRepository.getReadingHistory(1),
          localRepository.getLatestRecommendationSet(),
          localRepository.getTasks(4)
        ]);

        if (!active) {
          return;
        }

        setLatestReading(readingHistory[0] ?? null);
        setLatestSummary(summary);
        setTasks(taskList);
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

  if (!latestSummary || !latestReading) {
    return (
      <Screen>
        <Card>
          <Chip label={lawn?.name ?? "Lawn Pal"} tone="positive" />
          <Heading>Your lawn plan starts with one scan</Heading>
          <Body muted>
            Take a demo reading to see the full flow: lawn status, weekly advice, schedule and
            history.
          </Body>
        </Card>
        <Button label="Scan the lawn" onPress={() => router.push("/scan")} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <Chip label={statusLabel(latestSummary.lawnStatus)} tone={toneForStatus(latestSummary.lawnStatus)} />
        <Heading>{lawn?.name ?? "Your lawn"}</Heading>
        <Text style={styles.score}>{latestSummary.lawnScore}/100</Text>
        <Body>{latestSummary.mainIssue}</Body>
        <Body muted>{latestSummary.summary}</Body>
      </Card>

      <Card>
        <Subheading>This week</Subheading>
        {latestSummary.doNow.slice(0, 3).map((item) => (
          <Body key={item}>• {item}</Body>
        ))}
        {latestSummary.avoid.length ? <Divider /> : null}
        {latestSummary.avoid.slice(0, 2).map((item) => (
          <Body key={item} muted>
            Avoid: {item}
          </Body>
        ))}
      </Card>

      <Card>
        <Subheading>Weather-aware note</Subheading>
        {weatherQuery.data ? (
          <>
            <Body>
              {weatherQuery.data.current.summary} with a {weatherQuery.data.current.rainProbability}%
              rain chance today.
            </Body>
            <Body muted>
              Next shift: {weatherQuery.data.daily[1]?.summary ?? "steady conditions"}.
            </Body>
          </>
        ) : (
          <Body muted>Fetching local forecast…</Body>
        )}
      </Card>

      <Card>
        <Row
          left={
            <View>
              <Subheading>Next check</Subheading>
              <Body>{relativeCheckLabel(latestSummary.checkAgainAt)}</Body>
            </View>
          }
          right={<Chip label="Plan" />}
        />
        <Body muted>{latestSummary.checkAgainAt.slice(0, 10)}</Body>
      </Card>

      <Card>
        <Subheading>Upcoming tasks</Subheading>
        {tasks.map((task) => (
          <Row
            key={task.id}
            left={
              <View>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <Text style={styles.taskMeta}>{task.startDate.slice(0, 10)}</Text>
              </View>
            }
            right={<Chip label={task.status} tone={task.status === "pending" ? "warning" : "positive"} />}
          />
        ))}
      </Card>

      <View style={styles.quickGrid}>
        <QuickAction label="Scan lawn" onPress={() => router.push("/scan")} />
        <QuickAction label="Log action" onPress={() => router.push("/log-action")} />
        <QuickAction label="Ask AI" onPress={() => router.push("/ask")} />
        <QuickAction label="View history" onPress={() => router.push("/history")} />
      </View>

      <View style={styles.quickGrid}>
        <QuickAction label="Trends" onPress={() => router.push("/trends")} />
        <QuickAction label="Products" onPress={() => router.push("/products")} />
      </View>
    </Screen>
  );
}

const QuickAction = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <Pressable onPress={onPress} style={styles.quickAction}>
    <Text style={styles.quickActionText}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  score: {
    color: palette.primary,
    fontSize: 42,
    fontWeight: "800"
  },
  taskTitle: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "600"
  },
  taskMeta: {
    color: palette.inkSoft,
    marginTop: 4
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  quickAction: {
    flexGrow: 1,
    minWidth: "45%",
    borderRadius: 22,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border
  },
  quickActionText: {
    color: palette.ink,
    fontWeight: "700"
  }
});
