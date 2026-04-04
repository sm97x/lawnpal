import type { CareEvent, ScheduleTask } from "@lawnpal/core";
import { makeId } from "@lawnpal/core";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";
import { Body, Button, Card, Heading, Screen } from "@/components/ui";
import { localRepository } from "@/data/localRepository";
import { useAppStore } from "@/store/appStore";
import { palette } from "@/theme";

const quickEvents: { type: CareEvent["type"]; title: string; label: string }[] = [
  { type: "fertiliser", title: "Applied fertiliser", label: "Applied feed" },
  { type: "weedkiller", title: "Applied weedkiller", label: "Applied weedkiller" },
  { type: "watering", title: "Watered lawn", label: "Watered" },
  { type: "mowing", title: "Mowed lawn", label: "Mowed" },
  { type: "overseeding", title: "Overseeded area", label: "Overseeded" },
  { type: "pet-urine", title: "Suspected pet urine", label: "Pet urine" }
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
    <Screen>
      <Card>
        <Heading>Log an action</Heading>
        <Body muted>
          Capture real lawn actions as structured evidence so diagnosis and recovery plans stay
          honest.
        </Body>
      </Card>

      <Card>
        <Text style={{ color: palette.ink, fontWeight: "700", fontSize: 16 }}>Quick events</Text>
        <View style={{ gap: 10 }}>
          {quickEvents.map((event) => (
            <Button
              key={event.label}
              label={event.label}
              tone="ghost"
              onPress={() => void saveEvent(event.type, event.title)}
            />
          ))}
        </View>
      </Card>

      {tasks.length ? (
        tasks.map((task) => (
          <Card key={task.id}>
            <Text style={{ color: palette.ink, fontWeight: "700", fontSize: 16 }}>{task.title}</Text>
            <Body>{task.reason}</Body>
            <View style={{ gap: 10 }}>
              <Button label="Mark done" tone="secondary" onPress={() => void updateTask(task.id, "done")} />
              <Button label="Skip" tone="ghost" onPress={() => void updateTask(task.id, "skipped")} />
            </View>
          </Card>
        ))
      ) : (
        <Card>
          <Body muted>No pending scheduled tasks right now.</Body>
        </Card>
      )}
    </Screen>
  );
}
