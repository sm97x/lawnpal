import type { ScheduleTask } from "@lawnpal/core";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Body, Button, Card, Chip, Heading, Row, Screen } from "@/components/ui";
import { localRepository } from "@/data/localRepository";
import { formatDate } from "@/lib/format";
import { useAppStore } from "@/store/appStore";
import { palette } from "@/theme";

export default function ScheduleScreen() {
  const version = useAppStore((state) => state.version);
  const bumpVersion = useAppStore((state) => state.bumpVersion);
  const [tasks, setTasks] = useState<ScheduleTask[]>([]);

  useFocusEffect(
    useCallback(() => {
      const refreshToken = version;
      void refreshToken;
      let active = true;
      const load = async () => {
        const taskList = await localRepository.getTasks(50);
        if (active) {
          setTasks(taskList);
        }
      };
      void load();
      return () => {
        active = false;
      };
    }, [version])
  );

  const markTask = async (taskId: string, status: ScheduleTask["status"]) => {
    await localRepository.updateTaskStatus(taskId, status);
    bumpVersion();
  };

  return (
    <Screen>
      <Card>
        <Heading>Rolling weekly plan</Heading>
        <Body muted>
          This is not a static calendar. Lawn Pal updates the timing based on your latest reading and
          the forecast around it.
        </Body>
      </Card>

      {tasks.map((task) => (
        <Card key={task.id}>
          <Row
            left={
              <View>
                <Text style={styles.title}>{task.title}</Text>
                <Text style={styles.meta}>{formatDate(task.startDate)}</Text>
              </View>
            }
            right={
              <Chip
                label={task.status}
                tone={task.status === "done" ? "positive" : task.status === "skipped" ? "danger" : "warning"}
              />
            }
          />
          <Body>{task.reason}</Body>
          {task.status === "pending" ? (
            <View style={styles.actions}>
              <Button label="Done" tone="secondary" onPress={() => void markTask(task.id, "done")} />
              <Button label="Skip" tone="ghost" onPress={() => void markTask(task.id, "skipped")} />
            </View>
          ) : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: palette.ink,
    fontWeight: "700",
    fontSize: 16
  },
  meta: {
    color: palette.inkSoft,
    marginTop: 4
  },
  actions: {
    gap: 10
  }
});
