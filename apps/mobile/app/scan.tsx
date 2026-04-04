import {
  generateRecommendations,
  generateSchedule,
  listSensorScenarios,
  type SensorScenarioKey
} from "@lawnpal/core";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Body, Button, Card, Heading, Screen, Subheading } from "@/components/ui";
import { localRepository } from "@/data/localRepository";
import { syncTaskNotifications } from "@/services/notifications";
import { getSensorProvider } from "@/services/sensorService";
import { weatherService } from "@/services/weatherService";
import { useAppStore } from "@/store/appStore";
import { palette, spacing } from "@/theme";

const fallbackLocation = {
  lat: 51.5072,
  lon: -0.1276,
  label: "Central London",
  source: "postcode" as const
};

export default function ScanScreen() {
  const lawn = useAppStore((state) => state.lawn);
  const zones = useAppStore((state) => state.zones);
  const location = useAppStore((state) => state.location);
  const selectedZoneId = useAppStore((state) => state.selectedZoneId);
  const setSelectedZoneId = useAppStore((state) => state.setSelectedZoneId);
  const remindersEnabled = useAppStore((state) => state.remindersEnabled);
  const bumpVersion = useAppStore((state) => state.bumpVersion);
  const [scenario, setScenario] = useState<SensorScenarioKey>("healthy-lawn");
  const [loading, setLoading] = useState(false);
  const [progressText, setProgressText] = useState("Ready to scan.");

  const activeZoneId = selectedZoneId ?? zones[0]?.id;
  const activeZone = useMemo(
    () => zones.find((zone) => zone.id === activeZoneId) ?? zones[0],
    [activeZoneId, zones]
  );

  const runScan = async () => {
    if (!lawn || !activeZone) {
      return;
    }

    setLoading(true);
    try {
      const provider = getSensorProvider();
      setProgressText("Scanning for a device…");
      const devices = await provider.scanDevices();
      const device = devices[0];
      if (!device) {
        throw new Error("No sensor found.");
      }

      setProgressText("Connecting…");
      await provider.connect(device.id);
      setProgressText("Taking reading…");
      const reading = await provider.takeReading({
        zoneId: activeZone.id,
        scenarioKey: scenario
      });
      await provider.disconnect();
      await localRepository.saveReading(reading);

      setProgressText("Pulling weather…");
      const forecast = await weatherService.fetchForecast(location ?? fallbackLocation);
      await localRepository.saveWeatherSnapshot(forecast);

      setProgressText("Building your plan…");
      const [recentZoneReadings, allReadings] = await Promise.all([
        localRepository.getZoneReadings(activeZone.id, 12),
        localRepository.getReadingHistory(30)
      ]);

      const summary = generateRecommendations({
        reading,
        zone: activeZone,
        weather: forecast,
        profile: lawn.profile,
        recentZoneReadings: recentZoneReadings.reverse(),
        allRecentReadings: allReadings.reverse(),
        siblingZones: zones.filter((zone) => zone.id !== activeZone.id)
      });
      const tasks = generateSchedule({
        recommendationSet: summary,
        weather: forecast
      });

      await localRepository.saveRecommendationSet(summary);
      await localRepository.saveTasks(tasks);
      await syncTaskNotifications(tasks, remindersEnabled);
      bumpVersion();
      router.replace(`/result/${reading.id}`);
    } catch (error) {
      setProgressText(error instanceof Error ? error.message : "Unable to complete this scan.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <Card>
        <Heading>Scan the lawn</Heading>
        <Body muted>
          Demo mode uses realistic sensor scenarios in the same shape the future Bluetooth provider
          will return.
        </Body>
      </Card>

      <Card>
        <Subheading>Select zone</Subheading>
        <View style={styles.wrap}>
          {zones.map((zone) => {
            const active = zone.id === activeZoneId;
            return (
              <Pressable
                key={zone.id}
                onPress={() => setSelectedZoneId(zone.id)}
                style={[styles.option, active && styles.optionActive]}
              >
                <Text style={[styles.optionText, active && styles.optionTextActive]}>{zone.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Subheading>Select scenario</Subheading>
        <View style={styles.wrap}>
          {listSensorScenarios().map((item) => {
            const active = item.key === scenario;
            return (
              <Pressable
                key={item.key}
                onPress={() => setScenario(item.key)}
                style={[styles.option, active && styles.optionActive]}
              >
                <Text style={[styles.optionText, active && styles.optionTextActive]}>{item.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        {loading ? <ActivityIndicator color={palette.primary} /> : null}
        <Body>{progressText}</Body>
      </Card>

      <Button
        label={loading ? "Scanning…" : "Take reading"}
        onPress={() => void runScan()}
        disabled={loading || !activeZone}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  option: {
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10
  },
  optionActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary
  },
  optionText: {
    color: palette.ink,
    fontWeight: "600"
  },
  optionTextActive: {
    color: "#FFFFFF"
  }
});
