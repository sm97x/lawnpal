import { StatusBar } from "expo-status-bar";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { AppProviders } from "@/providers/AppProviders";
import { localRepository } from "@/data/localRepository";
import { useAppStore } from "@/store/appStore";
import { palette } from "@/theme";

function BootstrappedLayout() {
  const bootstrap = useAppStore((state) => state.bootstrap);
  const [loading, setLoading] = useState(true);
  const [bootMessage, setBootMessage] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      try {
        await Promise.race([
          (async () => {
            await localRepository.init();
            const [lawn, zones, settings] = await Promise.all([
              localRepository.getPrimaryLawn(),
              localRepository.getZones(),
              localRepository.getSettingsSnapshot()
            ]);

            if (!alive) {
              return;
            }

            bootstrap({
              lawn,
              zones,
              onboardingComplete: settings.onboardingComplete,
              remindersEnabled: settings.remindersEnabled,
              metricSystem: settings.metricSystem,
              location: settings.location
            });
            setBootMessage(null);
            setLoading(false);
          })(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Startup took too long.")), 6000)
          )
        ]);
      } catch (error) {
        if (!alive) {
          return;
        }

        bootstrap({
          lawn: null,
          zones: [],
          onboardingComplete: false,
          remindersEnabled: true,
          metricSystem: "metric",
          location: null
        });
        setBootMessage(
          error instanceof Error
            ? `${error.message} Falling back to a fresh local session.`
            : "Startup stalled. Falling back to a fresh local session."
        );
        setLoading(false);
      }
    };

    void run();

    return () => {
      alive = false;
    };
  }, [bootstrap]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={palette.primary} size="large" />
        <Text style={styles.loadingText}>Preparing your lawn plan…</Text>
      </View>
    );
  }

  return (
    <>
      {bootMessage ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{bootMessage}</Text>
        </View>
      ) : null}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="scan" options={{ presentation: "modal" }} />
        <Stack.Screen name="result/[readingId]" />
        <Stack.Screen name="history/[readingId]" />
        <Stack.Screen name="trends" />
        <Stack.Screen name="products" />
        <Stack.Screen name="log-action" options={{ presentation: "modal" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <BootstrappedLayout />
    </AppProviders>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: palette.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 16
  },
  loadingText: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "600"
  },
  banner: {
    backgroundColor: palette.warningSoft,
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  bannerText: {
    color: palette.ink,
    fontSize: 13,
    fontWeight: "600"
  }
});
