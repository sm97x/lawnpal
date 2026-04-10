import {
  generateRecommendations,
  generateSchedule,
  listSensorScenarios,
  type SensorScenarioKey
} from "@lawnpal/core";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/appChrome";
import { SectionEyebrow } from "@/components/stitch";
import { Button } from "@/components/ui";
import { localRepository } from "@/data/localRepository";
import { syncTaskNotifications } from "@/services/notifications";
import { getSensorProvider } from "@/services/sensorService";
import { weatherService } from "@/services/weatherService";
import { useAppStore } from "@/store/appStore";
import { fonts, palette, radius, spacing } from "@/theme";

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
  const [progressText, setProgressText] = useState("Connecting to sensor...");

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
      setProgressText("Scanning for a device...");
      const devices = await provider.scanDevices();
      const device = devices[0];
      if (!device) {
        throw new Error("No sensor found.");
      }

      setProgressText("Connecting to sensor...");
      await provider.connect(device.id);
      setProgressText("Analyzing moisture...");
      const reading = await provider.takeReading({
        zoneId: activeZone.id,
        scenarioKey: scenario
      });
      await provider.disconnect();
      await localRepository.saveReading(reading);

      setProgressText("Fetching local weather...");
      const forecast = await weatherService.fetchForecast(location ?? fallbackLocation, {
        allowMockFallback: true
      });
      await localRepository.saveWeatherSnapshot(forecast);

      setProgressText("Building your plan...");
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
    <AppScreen navKey="scan">
      <View style={styles.header}>
        <SectionEyebrow>Current Selection</SectionEyebrow>
        <Text style={styles.zoneTitle}>{activeZone?.name ?? "Select a zone"}</Text>
      </View>

      <View style={styles.ringFrame}>
        <View style={styles.ringOuter}>
          <View style={styles.ringPulse}>
            <View style={styles.ringCore}>
              {loading ? (
                <ActivityIndicator color={palette.white} />
              ) : (
                <Text style={styles.ringGlyph}>(( ))</Text>
              )}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.progressBlock}>
        <Text style={styles.progressText}>{progressText}</Text>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width:
                  progressText.includes("weather") || progressText.includes("plan")
                    ? "78%"
                    : loading
                      ? "42%"
                      : "18%"
              }
            ]}
          />
        </View>
        <View style={styles.progressHints}>
          <Text style={styles.progressHint}>Analyzing moisture...</Text>
          <Text style={styles.progressHint}>Fetching local weather...</Text>
        </View>
      </View>

      <View style={styles.selectorGrid}>
        <Pressable style={[styles.selectorCard, styles.selectorCardActive]}>
          <View style={[styles.selectorIcon, styles.selectorIconActive]}>
            <Text style={styles.selectorIconText}>RF</Text>
          </View>
          <Text style={styles.selectorTitle}>Real Sensor</Text>
          <Text style={styles.selectorMeta}>Bluetooth LE</Text>
        </Pressable>
        <Pressable style={styles.selectorCard}>
          <View style={styles.selectorIcon}>
            <Text style={styles.selectorIconTextMuted}>T</Text>
          </View>
          <Text style={styles.selectorTitle}>Mock Scenario</Text>
          <Text style={styles.selectorMeta}>Testing Mode</Text>
        </Pressable>
      </View>

      <View style={styles.zoneSelector}>
        {zones.map((zone) => {
          const active = zone.id === activeZoneId;
          return (
            <Pressable
              key={zone.id}
              onPress={() => setSelectedZoneId(zone.id)}
              style={[styles.zonePill, active && styles.zonePillActive]}
            >
              <Text style={[styles.zonePillText, active && styles.zonePillTextActive]}>{zone.name}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.scenarioList}>
        {listSensorScenarios().map((item) => {
          const active = item.key === scenario;
          return (
            <Pressable
              key={item.key}
              onPress={() => setScenario(item.key)}
              style={[styles.scenarioRow, active && styles.scenarioRowActive]}
            >
              <Text style={[styles.scenarioTitle, active && styles.scenarioTitleActive]}>{item.name}</Text>
              <Text style={styles.scenarioMeta}>{item.key}</Text>
            </Pressable>
          );
        })}
      </View>

      <Button
        disabled={loading || !activeZone}
        label={loading ? "Scanning..." : "Start Scan"}
        onPress={() => void runScan()}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    gap: spacing.xs
  },
  zoneTitle: {
    color: palette.primary,
    fontFamily: fonts.headlineBold,
    fontSize: 32,
    letterSpacing: -0.8,
    textAlign: "center"
  },
  ringFrame: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl
  },
  ringOuter: {
    width: 278,
    height: 278,
    borderRadius: 139,
    borderWidth: 1,
    borderColor: "rgba(194, 200, 194, 0.32)",
    alignItems: "center",
    justifyContent: "center"
  },
  ringPulse: {
    width: 184,
    height: 184,
    borderRadius: 92,
    backgroundColor: "rgba(201, 231, 204, 0.6)",
    alignItems: "center",
    justifyContent: "center"
  },
  ringCore: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: palette.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  ringGlyph: {
    color: palette.white,
    fontFamily: fonts.bodyBold,
    fontSize: 20,
    letterSpacing: 1.2
  },
  progressBlock: {
    gap: spacing.sm,
    alignItems: "center"
  },
  progressText: {
    color: palette.primary,
    fontFamily: fonts.bodyMedium,
    fontSize: 14
  },
  progressTrack: {
    width: "100%",
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: palette.surfaceHighest,
    overflow: "hidden"
  },
  progressFill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: palette.primary
  },
  progressHints: {
    alignItems: "center",
    gap: spacing.xs,
    opacity: 0.5
  },
  progressHint: {
    color: palette.inkMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase"
  },
  selectorGrid: {
    flexDirection: "row",
    gap: spacing.md
  },
  selectorCard: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    alignItems: "center",
    gap: spacing.sm
  },
  selectorCardActive: {
    backgroundColor: palette.surfaceLow
  },
  selectorIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: palette.surfaceHigh,
    alignItems: "center",
    justifyContent: "center"
  },
  selectorIconActive: {
    backgroundColor: palette.secondarySoft
  },
  selectorIconText: {
    color: palette.secondary,
    fontFamily: fonts.bodyBold,
    fontSize: 12
  },
  selectorIconTextMuted: {
    color: palette.inkMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 12
  },
  selectorTitle: {
    color: palette.primary,
    fontFamily: fonts.headlineBold,
    fontSize: 15
  },
  selectorMeta: {
    color: palette.inkMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase"
  },
  zoneSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "center"
  },
  zonePill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: "rgba(194, 200, 194, 0.22)"
  },
  zonePillActive: {
    backgroundColor: palette.primary
  },
  zonePillText: {
    color: palette.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 13
  },
  zonePillTextActive: {
    color: palette.white
  },
  scenarioList: {
    gap: spacing.sm
  },
  scenarioRow: {
    borderRadius: radius.xl,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: "rgba(194, 200, 194, 0.18)",
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md
  },
  scenarioRowActive: {
    borderColor: palette.secondary
  },
  scenarioTitle: {
    color: palette.primary,
    fontFamily: fonts.bodySemi,
    fontSize: 15
  },
  scenarioTitleActive: {
    color: palette.primary
  },
  scenarioMeta: {
    color: palette.inkMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase"
  }
});
