import type { RecommendationSet, ScheduleTask, SensorReading, Zone } from "@lawnpal/core";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/appChrome";
import { ScoreRing, SectionEyebrow, StatusBadge, SurfaceBlock } from "@/components/stitch";
import { Button } from "@/components/ui";
import { localRepository } from "@/data/localRepository";
import { dayBucketLabel, formatDateTime, formatShortTime } from "@/lib/format";
import { fonts, palette, radius, spacing } from "@/theme";
import { useAppStore } from "@/store/appStore";

type ReadingCard = {
  reading: SensorReading;
  summary: RecommendationSet | null;
  zoneName: string;
};

type ReadingBucket = ReturnType<typeof dayBucketLabel>;

const weekdayFormatter = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
const dayNumberFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric" });
const fullDayFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short"
});

const toDateKey = (value: string | Date) => {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const taskStatusTone = (status: ScheduleTask["status"]) => {
  switch (status) {
    case "done":
      return "positive" as const;
    case "skipped":
      return "danger" as const;
    default:
      return "warning" as const;
  }
};

const taskStatusLabel = (status: ScheduleTask["status"]) => {
  switch (status) {
    case "done":
      return "Done";
    case "skipped":
      return "Skipped";
    default:
      return "Pending";
  }
};

const sortTasks = (tasks: ScheduleTask[]) =>
  [...tasks].sort((left, right) => {
    if (left.startDate !== right.startDate) {
      return left.startDate.localeCompare(right.startDate);
    }

    const statusOrder: Record<ScheduleTask["status"], number> = {
      pending: 0,
      done: 1,
      skipped: 2
    };

    if (statusOrder[left.status] !== statusOrder[right.status]) {
      return statusOrder[left.status] - statusOrder[right.status];
    }

    return left.title.localeCompare(right.title);
  });

export default function ScheduleHubScreen() {
  const version = useAppStore((state) => state.version);
  const bumpVersion = useAppStore((state) => state.bumpVersion);
  const [rows, setRows] = useState<ReadingCard[]>([]);
  const [tasks, setTasks] = useState<ScheduleTask[]>([]);

  useFocusEffect(
    useCallback(() => {
      const refreshToken = version;
      void refreshToken;
      let active = true;

      const load = async () => {
        const [history, zones, taskList] = await Promise.all([
          localRepository.getReadingHistory(50),
          localRepository.getZones(),
          localRepository.getTasks(50)
        ]);
        const summaryEntries = await Promise.all(
          history.map(async (reading) => [
            reading.id,
            await localRepository.getRecommendationSetByReadingId(reading.id)
          ] as const)
        );

        if (!active) {
          return;
        }

        const zoneMap = new Map(zones.map((zone: Zone) => [zone.id, zone.name]));
        const summaryMap = new Map(summaryEntries);
        setRows(
          history.map((reading) => ({
            reading,
            summary: summaryMap.get(reading.id) ?? null,
            zoneName: zoneMap.get(reading.zoneId) ?? "Unknown zone"
          }))
        );
        setTasks(sortTasks(taskList));
      };

      void load();
      return () => {
        active = false;
      };
    }, [version])
  );

  const todayKey = toDateKey(new Date());

  const buckets = useMemo(() => {
    const grouped: Record<ReadingBucket, ReadingCard[]> = {
      Today: [],
      Yesterday: [],
      "This Week": [],
      Earlier: []
    };

    rows.forEach((row) => {
      grouped[dayBucketLabel(row.reading.takenAt)].push(row);
    });

    return grouped;
  }, [rows]);

  const weeklyAverage = useMemo(() => {
    const scores = rows.map((row) => row.summary?.lawnScore).filter((value): value is number => typeof value === "number");
    if (!scores.length) {
      return null;
    }

    return Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
  }, [rows]);

  const carryOverTasks = useMemo(
    () => tasks.filter((task) => task.status === "pending" && toDateKey(task.startDate) < todayKey),
    [tasks, todayKey]
  );

  const weeklySchedule = useMemo(() => {
    const taskMap = new Map<string, ScheduleTask[]>();

    tasks.forEach((task) => {
      const key = toDateKey(task.startDate);
      const list = taskMap.get(key) ?? [];
      list.push(task);
      taskMap.set(key, list);
    });

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const key = toDateKey(date);
      const dayTasks = sortTasks(taskMap.get(key) ?? []);
      return {
        key,
        date,
        tasks: dayTasks,
        pendingCount: dayTasks.filter((task) => task.status === "pending").length
      };
    });
  }, [tasks]);

  const weeklyTaskGroups = weeklySchedule.filter((day) => day.tasks.length);

  const markTask = async (taskId: string, status: ScheduleTask["status"]) => {
    await localRepository.updateTaskStatus(taskId, status);
    bumpVersion();
  };

  return (
    <AppScreen navKey="history">
      <View style={styles.header}>
        <Text style={styles.title}>Schedule</Text>
        <Text style={styles.subtitle}>Upcoming tasks and scan history live together here, so the plan and the evidence stay in one place.</Text>
      </View>

      <SurfaceBlock tone="accent">
        <SectionEyebrow tone="positive">This Week</SectionEyebrow>
        <Text style={styles.bannerTitle}>Your plan updates with every new scan.</Text>
        <Text style={styles.bannerText}>
          Use this screen to manage what is coming up next, then scroll down into the scan archive when you need context.
        </Text>
        <Text style={styles.bannerLink} onPress={() => router.push("/trends")}>
          View trend report
        </Text>
      </SurfaceBlock>

      <Button label="Log an action" onPress={() => router.push("/log-action")} tone="secondary" />

      <View style={styles.weekStrip}>
        {weeklySchedule.map((day, index) => {
          const isToday = index === 0;
          const metaLabel = day.pendingCount
            ? `${day.pendingCount} pending`
            : day.tasks.length
              ? `${day.tasks.length} logged`
              : "Clear";

          return (
            <View key={day.key} style={[styles.dayCard, isToday && styles.dayCardToday]}>
              <Text style={[styles.dayWeekday, isToday && styles.dayWeekdayToday]}>{weekdayFormatter.format(day.date)}</Text>
              <Text style={[styles.dayNumber, isToday && styles.dayNumberToday]}>{dayNumberFormatter.format(day.date)}</Text>
              <Text style={[styles.dayMeta, isToday && styles.dayMetaToday]}>{metaLabel}</Text>
            </View>
          );
        })}
      </View>

      {carryOverTasks.length ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <SectionEyebrow tone="danger">Needs Attention</SectionEyebrow>
            <View style={styles.sectionRule} />
          </View>
          <View style={styles.taskList}>
            {carryOverTasks.map((task) => (
              <View key={task.id} style={styles.taskCard}>
                <View style={styles.taskTopRow}>
                  <View style={styles.taskCopy}>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    <Text style={styles.taskReason}>{task.reason}</Text>
                  </View>
                  <StatusBadge label="Pending" tone="warning" />
                </View>
                <View style={styles.actions}>
                  <Pressable onPress={() => void markTask(task.id, "done")} style={styles.actionButton}>
                    <Text style={styles.actionText}>Done</Text>
                  </Pressable>
                  <Pressable onPress={() => void markTask(task.id, "skipped")} style={styles.actionButton}>
                    <Text style={styles.actionText}>Skip</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {weeklyTaskGroups.length ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <SectionEyebrow>Upcoming Tasks</SectionEyebrow>
            <View style={styles.sectionRule} />
          </View>
          <View style={styles.taskGroups}>
            {weeklyTaskGroups.map((day) => (
              <View key={day.key} style={styles.taskGroup}>
                <View style={styles.groupHeader}>
                  <SectionEyebrow>{fullDayFormatter.format(day.date)}</SectionEyebrow>
                  <View style={styles.groupRule} />
                </View>
                <View style={styles.taskList}>
                  {day.tasks.map((task) => (
                    <View key={task.id} style={styles.taskCard}>
                      <View style={styles.taskTopRow}>
                        <View style={styles.taskCopy}>
                          <Text style={styles.taskTitle}>{task.title}</Text>
                          <Text style={styles.taskReason}>{task.reason}</Text>
                        </View>
                        <StatusBadge label={taskStatusLabel(task.status)} tone={taskStatusTone(task.status)} />
                      </View>
                      {task.status === "pending" ? (
                        <View style={styles.actions}>
                          <Pressable onPress={() => void markTask(task.id, "done")} style={styles.actionButton}>
                            <Text style={styles.actionText}>Done</Text>
                          </Pressable>
                          <Pressable onPress={() => void markTask(task.id, "skipped")} style={styles.actionButton}>
                            <Text style={styles.actionText}>Skip</Text>
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <SurfaceBlock tone="raised">
          <Text style={styles.emptyTitle}>No weekly tasks yet</Text>
          <Text style={styles.emptyText}>Take a scan and LawnPal will start building the schedule for you.</Text>
        </SurfaceBlock>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <SectionEyebrow>Scan History</SectionEyebrow>
          <View style={styles.sectionRule} />
        </View>
        <Text style={styles.historyIntro}>Review previous scans, reopen a reading, and compare what changed over time.</Text>
      </View>

      {(["Today", "Yesterday", "This Week"] as const).map((bucket) =>
        buckets[bucket].length ? (
          <View key={bucket} style={styles.section}>
            <View style={styles.sectionHeader}>
              <SectionEyebrow>{bucket}</SectionEyebrow>
              <View style={styles.sectionRule} />
            </View>
            <View style={styles.sectionList}>
              {buckets[bucket].map((row) => (
                <Pressable
                  key={row.reading.id}
                  onPress={() => router.push(`/history/${row.reading.id}`)}
                  style={styles.pressable}
                >
                  <View style={styles.historyCard}>
                    <View style={styles.historyCopy}>
                      <View style={styles.historyMetaRow}>
                        <Text style={styles.historyTime}>{formatShortTime(row.reading.takenAt)}</Text>
                        <Text style={styles.historyDot}>|</Text>
                        <Text style={styles.historyZone}>{row.zoneName}</Text>
                      </View>
                      {row.summary ? (
                        <View style={styles.historyStatusRow}>
                          <StatusBadge
                            label={
                              row.summary.lawnStatus === "at-risk"
                                ? "Action Required"
                                : row.summary.lawnStatus === "thriving"
                                  ? "Thriving"
                                  : row.summary.lawnStatus === "stable"
                                    ? "Stable"
                                    : "Monitor"
                            }
                            tone={
                              row.summary.lawnStatus === "at-risk"
                                ? "danger"
                                : row.summary.lawnStatus === "thriving"
                                  ? "positive"
                                  : "neutral"
                            }
                          />
                          <Text style={styles.historyIssue}>{row.summary.mainIssue}</Text>
                        </View>
                      ) : (
                        <Text style={styles.historyIssue}>Reading saved</Text>
                      )}
                    </View>
                    <ScoreRing label="Score" score={row.summary?.lawnScore ?? 0} size={74} />
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null
      )}

      {weeklyAverage ? (
        <SurfaceBlock tone="accent">
          <SectionEyebrow tone="positive">Insight</SectionEyebrow>
          <Text style={styles.insightTitle}>Weekly Average {weeklyAverage}</Text>
          <Text style={styles.insightText}>
            Your recent scan history is giving a stable weekly signal. Open the trend report when you want the longer-range pattern.
          </Text>
          <Text style={styles.insightLink} onPress={() => router.push("/trends")}>
            View report
          </Text>
        </SurfaceBlock>
      ) : null}

      {buckets.Earlier.length ? (
        <View style={styles.earlierList}>
          {buckets.Earlier.slice(0, 6).map((row) => (
            <Pressable
              key={row.reading.id}
              onPress={() => router.push(`/history/${row.reading.id}`)}
              style={styles.earlierRow}
            >
              <View>
                <Text style={styles.earlierDate}>{formatDateTime(row.reading.takenAt).slice(0, 6)}</Text>
                <Text style={styles.earlierTitle}>{row.zoneName}</Text>
              </View>
              <Text style={styles.earlierScore}>{row.summary?.lawnScore ?? "--"}</Text>
            </Pressable>
          ))}
        </View>
      ) : rows.length ? null : (
        <SurfaceBlock tone="raised">
          <Text style={styles.emptyTitle}>No scan history yet</Text>
          <Text style={styles.emptyText}>Run a scan and the archive will start building underneath your schedule.</Text>
        </SurfaceBlock>
      )}
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
  bannerTitle: {
    color: palette.white,
    fontFamily: fonts.headlineBold,
    fontSize: 28
  },
  bannerText: {
    color: "rgba(255,255,255,0.78)",
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22
  },
  bannerLink: {
    color: palette.white,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 1.6,
    marginTop: spacing.sm,
    textTransform: "uppercase"
  },
  weekStrip: {
    flexDirection: "row",
    gap: spacing.sm
  },
  dayCard: {
    flex: 1,
    minHeight: 94,
    borderRadius: radius.xl,
    backgroundColor: palette.surfaceLow,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs
  },
  dayCardToday: {
    backgroundColor: palette.primary
  },
  dayWeekday: {
    color: palette.inkMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  dayWeekdayToday: {
    color: "rgba(255,255,255,0.72)"
  },
  dayNumber: {
    color: palette.primary,
    fontFamily: fonts.headlineHeavy,
    fontSize: 28
  },
  dayNumberToday: {
    color: palette.white
  },
  dayMeta: {
    color: palette.inkSoft,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 0.4,
    textAlign: "center"
  },
  dayMetaToday: {
    color: palette.white
  },
  section: {
    gap: spacing.md
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  sectionRule: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(194, 200, 194, 0.22)"
  },
  taskGroups: {
    gap: spacing.lg
  },
  taskGroup: {
    gap: spacing.md
  },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md
  },
  groupRule: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(194, 200, 194, 0.16)"
  },
  taskList: {
    gap: spacing.sm
  },
  taskCard: {
    borderRadius: radius.xl,
    backgroundColor: palette.surfaceLow,
    padding: spacing.lg,
    gap: spacing.md
  },
  taskTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md
  },
  taskCopy: {
    flex: 1,
    gap: spacing.xs
  },
  taskTitle: {
    color: palette.primary,
    fontFamily: fonts.headlineBold,
    fontSize: 18
  },
  taskReason: {
    color: palette.inkSoft,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm
  },
  actionButton: {
    borderRadius: radius.pill,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  actionText: {
    color: palette.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 12
  },
  historyIntro: {
    color: palette.inkSoft,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21
  },
  sectionList: {
    gap: spacing.sm
  },
  pressable: {
    borderRadius: radius.xl
  },
  historyCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: palette.surfaceLow
  },
  historyCopy: {
    flex: 1,
    gap: spacing.sm
  },
  historyMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs
  },
  historyTime: {
    color: palette.inkMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: "uppercase"
  },
  historyDot: {
    color: palette.inkMuted
  },
  historyZone: {
    color: palette.primary,
    fontFamily: fonts.headlineBold,
    fontSize: 18
  },
  historyStatusRow: {
    gap: spacing.sm
  },
  historyIssue: {
    color: palette.inkSoft,
    fontFamily: fonts.bodyMedium,
    fontSize: 14
  },
  insightTitle: {
    color: palette.white,
    fontFamily: fonts.headlineBold,
    fontSize: 28
  },
  insightText: {
    color: "rgba(255,255,255,0.78)",
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 22
  },
  insightLink: {
    color: palette.white,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 1.6,
    marginTop: spacing.sm,
    textTransform: "uppercase"
  },
  earlierList: {
    gap: spacing.sm
  },
  earlierRow: {
    borderRadius: radius.xl,
    backgroundColor: palette.surfaceLow,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  earlierDate: {
    color: palette.inkMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  earlierTitle: {
    color: palette.primary,
    fontFamily: fonts.headlineBold,
    fontSize: 18,
    marginTop: 2
  },
  earlierScore: {
    color: palette.secondary,
    fontFamily: fonts.headlineHeavy,
    fontSize: 26
  },
  emptyTitle: {
    color: palette.primary,
    fontFamily: fonts.headlineBold,
    fontSize: 24
  },
  emptyText: {
    color: palette.inkSoft,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22
  }
});
