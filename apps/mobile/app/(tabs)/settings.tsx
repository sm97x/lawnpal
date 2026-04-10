import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { router } from "expo-router";
import { Alert, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/appChrome";
import {
  SectionEyebrow,
  SegmentedControl,
  SettingRow,
  SurfaceBlock,
  ToggleAccessory
} from "@/components/stitch";
import { Button } from "@/components/ui";
import { localRepository } from "@/data/localRepository";
import { env } from "@/env";
import { defaultProfile } from "@/lib/stitchContent";
import { useAppStore } from "@/store/appStore";
import { fonts, palette, radius, spacing } from "@/theme";

export default function SettingsScreen() {
  const remindersEnabled = useAppStore((state) => state.remindersEnabled);
  const setRemindersEnabled = useAppStore((state) => state.setRemindersEnabled);
  const metricSystem = useAppStore((state) => state.metricSystem);
  const setMetricSystem = useAppStore((state) => state.setMetricSystem);
  const reset = useAppStore((state) => state.reset);
  const location = useAppStore((state) => state.location);
  const lawn = useAppStore((state) => state.lawn);
  const zones = useAppStore((state) => state.zones);
  const bumpVersion = useAppStore((state) => state.bumpVersion);

  const toggleReminders = async (value: boolean) => {
    setRemindersEnabled(value);
    await localRepository.saveSetting("remindersEnabled", value);
  };

  const switchMetricSystem = async (value: string) => {
    const nextValue = value === "Imperial" ? "imperial" : "metric";
    setMetricSystem(nextValue);
    await localRepository.saveSetting("metricSystem", nextValue);
  };

  const handleResetDemo = async () => {
    await localRepository.clearActivityData();
    bumpVersion();
    Alert.alert("Demo data reset", "Scans, advice, tasks, and AI history were cleared.");
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
    <AppScreen navKey="settings">
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Configure your environmental intelligence ecosystem.</Text>
      </View>

      <View style={styles.profileCard}>
        <View style={styles.profileCopy}>
          <SectionEyebrow>{defaultProfile.tier}</SectionEyebrow>
          <Text style={styles.profileName}>{defaultProfile.name}</Text>
          <Text style={styles.profileEmail}>{defaultProfile.email}</Text>
        </View>
        <Button label="Edit Profile" onPress={() => Alert.alert("Profile", "Profile editing is staged for the next pass.")} tone="secondary" />
      </View>

      <View style={styles.section}>
        <SectionEyebrow>Lawn and Devices</SectionEyebrow>
        <SurfaceBlock tone="raised">
          <SettingRow
            description={`${zones.length} active`}
            icon="grid-view"
            right={<Text style={styles.chevron}>{">"}</Text>}
            title="Garden Zones"
          />
          <SettingRow
            description={env.useMockSensor ? "Testing mode" : "All synced"}
            icon="sensors"
            right={<Text style={styles.chevron}>{">"}</Text>}
            title="Soil Sensors"
          />
          <SettingRow
            description={lawn?.name ?? "Bridge ready"}
            icon="router"
            right={<View style={styles.liveDot} />}
            title="Bridge Connection"
          />
        </SurfaceBlock>
      </View>

      <View style={styles.section}>
        <SectionEyebrow>Preferences</SectionEyebrow>
        <SurfaceBlock tone="raised">
          <SettingRow
            description="Measurement system"
            icon="straighten"
            right={
              <SegmentedControl
                onChange={switchMetricSystem}
                options={["Metric", "Imperial"]}
                value={metricSystem === "imperial" ? "Imperial" : "Metric"}
              />
            }
            title="Measurement System"
          />
          <SettingRow
            description={location?.label ?? "No saved location"}
            icon="cloud"
            right={<Text style={styles.trailingText}>{env.useMockWeather ? "Mock" : "OpenWeather"}</Text>}
            title="Weather Provider"
          />
        </SurfaceBlock>
      </View>

      <View style={styles.section}>
        <SectionEyebrow>Notifications</SectionEyebrow>
        <SurfaceBlock tone="raised">
          <SettingRow
            description="Notification when soil moisture is low"
            icon="water-drop"
            right={<ToggleAccessory onValueChange={toggleReminders} value={remindersEnabled} />}
            title="Watering Reminders"
          />
          <SettingRow
            description="Disease and nutrient deficiency warnings"
            icon="monitor-heart"
            right={<ToggleAccessory onValueChange={toggleReminders} value={remindersEnabled} />}
            title="Lawn Health Alerts"
          />
        </SurfaceBlock>
      </View>

      <View style={styles.section}>
        <SectionEyebrow>Data Tools</SectionEyebrow>
        <SurfaceBlock tone="raised">
          <Button label="Export local data" onPress={() => void handleExport()} tone="secondary" />
          <Button label="Reset demo data" onPress={() => void handleResetDemo()} tone="ghost" />
          <Button label="Clear all local data" onPress={() => void handleClearAll()} tone="ghost" />
        </SurfaceBlock>
      </View>

      <View style={styles.section}>
        <SectionEyebrow>App Info</SectionEyebrow>
        <SurfaceBlock tone="raised">
          <SettingRow
            description={env.apiBaseUrl}
            icon="info"
            right={<Text style={styles.trailingText}>v1.0.0</Text>}
            title="Version"
          />
          <SettingRow
            description="Stored on this device."
            icon="shield"
            right={<Text style={styles.chevron}>{">"}</Text>}
            title="Privacy Policy"
          />
          <SettingRow destructive icon="logout" title="Log Out" />
        </SurfaceBlock>
      </View>

      <View style={styles.footerBadge}>
        <View style={styles.footerRing}>
          <View style={styles.footerRingInner}>
            <Text style={styles.footerLeaf}>eco</Text>
          </View>
          <View style={styles.footerDot} />
        </View>
        <Text style={styles.footerText}>Eco-system Active</Text>
      </View>
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
  profileCard: {
    borderRadius: 32,
    padding: spacing.xl,
    backgroundColor: palette.primaryContainer,
    gap: spacing.lg
  },
  profileCopy: {
    gap: spacing.xs
  },
  profileName: {
    color: palette.white,
    fontFamily: fonts.headlineBold,
    fontSize: 28
  },
  profileEmail: {
    color: "rgba(255,255,255,0.72)",
    fontFamily: fonts.body,
    fontSize: 14
  },
  section: {
    gap: spacing.md
  },
  trailingText: {
    color: palette.inkMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 12
  },
  chevron: {
    color: palette.inkMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 18
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: "#4CAF50"
  },
  footerBadge: {
    alignItems: "center",
    gap: spacing.md,
    opacity: 0.52,
    paddingBottom: spacing.xl
  },
  footerRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(5, 26, 15, 0.18)",
    alignItems: "center",
    justifyContent: "center"
  },
  footerRingInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(74, 101, 79, 0.3)",
    alignItems: "center",
    justifyContent: "center"
  },
  footerLeaf: {
    color: palette.primary,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    textTransform: "uppercase"
  },
  footerDot: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: palette.secondary
  },
  footerText: {
    color: palette.inkMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: "uppercase"
  }
});
