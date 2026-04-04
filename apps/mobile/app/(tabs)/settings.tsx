import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { router } from "expo-router";
import { Alert, StyleSheet, Switch, Text, View } from "react-native";
import { Body, Button, Card, Chip, Heading, Row, Screen, Subheading } from "@/components/ui";
import { env } from "@/env";
import { localRepository } from "@/data/localRepository";
import { useAppStore } from "@/store/appStore";
import { palette } from "@/theme";

export default function SettingsScreen() {
  const remindersEnabled = useAppStore((state) => state.remindersEnabled);
  const setRemindersEnabled = useAppStore((state) => state.setRemindersEnabled);
  const metricSystem = useAppStore((state) => state.metricSystem);
  const setMetricSystem = useAppStore((state) => state.setMetricSystem);
  const reset = useAppStore((state) => state.reset);
  const location = useAppStore((state) => state.location);
  const bumpVersion = useAppStore((state) => state.bumpVersion);

  const toggleReminders = async (value: boolean) => {
    setRemindersEnabled(value);
    await localRepository.saveSetting("remindersEnabled", value);
  };

  const toggleMetricSystem = async () => {
    const nextValue = metricSystem === "metric" ? "imperial" : "metric";
    setMetricSystem(nextValue);
    await localRepository.saveSetting("metricSystem", nextValue);
  };

  const handleResetDemo = async () => {
    await localRepository.clearActivityData();
    bumpVersion();
    Alert.alert("Demo data reset", "Scans, advice, tasks and AI history were cleared.");
  };

  const handleClearAll = async () => {
    await localRepository.clearAllData();
    reset();
    router.replace("/welcome");
  };

  const handleExport = async () => {
    const fileUri = `${FileSystem.cacheDirectory}lawnpal-export-${Date.now()}.json`;
    const payload = await localRepository.exportAllData();
    await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload, null, 2));
    await Sharing.shareAsync(fileUri);
  };

  return (
    <Screen>
      <Card>
        <Heading>Settings</Heading>
        <Body muted>Local-first controls, reminders and weather mode for this MVP.</Body>
      </Card>

      <Card>
        <Subheading>Units</Subheading>
        <Row
          left={
            <View>
              <Text style={styles.title}>Metric / imperial</Text>
              <Text style={styles.meta}>Currently using {metricSystem}</Text>
            </View>
          }
          right={<Button label="Toggle" tone="secondary" onPress={() => void toggleMetricSystem()} />}
        />
      </Card>

      <Card>
        <Subheading>Reminders</Subheading>
        <Row
          left={
            <View>
              <Text style={styles.title}>Local notifications</Text>
              <Text style={styles.meta}>Scan reminders and action windows</Text>
            </View>
          }
          right={<Switch value={remindersEnabled} onValueChange={(value) => void toggleReminders(value)} />}
        />
      </Card>

      <Card>
        <Subheading>Weather provider</Subheading>
        <Chip label={env.useMockWeather ? "Mock weather" : "OpenWeather proxy"} />
        <Body muted>{location?.label ?? "No saved location"}</Body>
        <Body muted>{env.apiBaseUrl}</Body>
      </Card>

      <Card>
        <Subheading>Data tools</Subheading>
        <Button label="Export local data" tone="secondary" onPress={() => void handleExport()} />
        <Button label="Reset demo data" tone="ghost" onPress={() => void handleResetDemo()} />
        <Button label="Clear all local data" tone="ghost" onPress={() => void handleClearAll()} />
      </Card>

      <Card>
        <Subheading>App info</Subheading>
        <Body>Lawn Pal MVP</Body>
        <Body muted>Mock sensor: {String(env.useMockSensor)}</Body>
        <Body muted>Mock AI: {String(env.useMockAi)}</Body>
        <Body muted>Everything is stored on this device.</Body>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: palette.ink,
    fontWeight: "700",
    fontSize: 15
  },
  meta: {
    color: palette.inkSoft,
    marginTop: 4
  }
});
