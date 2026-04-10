import type { CareEvent, ScheduleTask } from "@lawnpal/core";
import { makeId } from "@lawnpal/core";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/appChrome";
import { SectionEyebrow, StatusBadge, SurfaceBlock } from "@/components/stitch";
import { Button } from "@/components/ui";
import { localRepository } from "@/data/localRepository";
import { useAppStore } from "@/store/appStore";
import { fonts, palette, spacing } from "@/theme";

const quickEvents: { type: CareEvent["type"]; title: string; label: string }[] = [
  { type: "fertiliser", title: "Applied fertiliser", label: "Applied feed" },
  { type: "weedkiller", title: "Applied weedkiller", label: "Applied weedkiller" },
  { type: "watering", title: "Watered lawn", label: "Watered" },
  { type: "mowing", title: "Mowed lawn", label: "Mowed" }
];

export default function LogActionScreen() {
  const version = useAppStore((state) => state.version);
  const bumpVersion = useAppStore((state) => state.bumpVersion);
  const [tasks, setTasks] = useState<ScheduleTask[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void version;
      let active = true;
      const load = async () => {
        const [nextTasks, caseId] = await Promise.all([
          localRepository.getTasks(20),
          localRepository.getSetting<string | null>("activeDiagnosticCaseId", null)
        ]);

        const snapshot = caseId ? await localRepository.getLatestDiagnosticSnapshot(caseId) : null;

        if (active) {
          setTasks(nextTasks.filter((task) => task.status === "pending"));
          setActiveCaseId(caseId);
          setActiveZoneId(snapshot?.zoneContext?.id ?? null);
        }
      };

      void load();
      return () => {
        active = false;
      };
    }, [version])
  );

  const updateTask = async (taskId: string, status: ScheduleTask["status"]) => {
    await localRepository.updateTaskStatus(taskId, status);
    bumpVersion();
  };

  const saveEvent = async (type: CareEvent["type"], title: string) => {
    await localRepository.saveCareEvent({
      id: makeId("care-event"),
      createdAt: new Date().toISOString(),
      caseId: activeCaseId ?? undefined,
      zoneId: activeZoneId ?? undefined,
      type,
      title
    });
    bumpVersion();
  };

  return (
    <AppScreen navKey="lawn">
      <View style={styles.header}>
        <Text style={styles.title}>Log an action</Text>
        <Text style={styles.subtitle}>Capture real lawn actions as structured evidence so diagnosis and recovery plans stay honest.</Text>
      </View>

      <SurfaceBlock tone="raised">
        <SectionEyebrow>Quick Events</SectionEyebrow>
        <View style={styles.buttonList}>
          {quickEvents.map((event) => (
            <Button key={event.label} label={event.label} onPress={() => void saveEvent(event.type, event.title)} tone="secondary" />
          ))}
        </View>
      </SurfaceBlock>

      {tasks.length ? (
        <View style={styles.taskList}>
          {tasks.map((task) => (
            <SurfaceBlock key={task.id} tone="raised">
              <View style={styles.taskRow}>
                <View style={styles.taskCopy}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <Text style={styles.subtitle}>{task.reason}</Text>
                </View>
                <StatusBadge label="Pending" tone="warning" />
              </View>
              <View style={styles.actions}>
                <Button label="Mark done" onPress={() => void updateTask(task.id, "done")} tone="secondary" />
                <Button label="Skip" onPress={() => void updateTask(task.id, "skipped")} tone="ghost" />
              </View>
            </SurfaceBlock>
          ))}
        </View>
      ) : (
        <SurfaceBlock tone="raised">
          <Text style={styles.taskTitle}>No pending scheduled tasks right now.</Text>
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
    fontSize: 34,
    letterSpacing: -1
  },
  subtitle: {
    color: palette.inkSoft,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21
  },
  buttonList: {
    gap: spacing.sm
  },
  taskList: {
    gap: spacing.md
  },
  taskRow: {
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
  actions: {
    gap: spacing.sm
  }
});
