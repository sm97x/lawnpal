import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useState } from "react";
import { OnboardingScreen } from "@/components/onboarding";
import { SectionEyebrow, SurfaceBlock } from "@/components/stitch";
import { Button } from "@/components/ui";
import { localRepository } from "@/data/localRepository";
import { requestDeviceLocation } from "@/services/locationService";
import { useAppStore } from "@/store/appStore";
import { fonts, palette, spacing } from "@/theme";

export default function LocationScreen() {
  const [loading, setLoading] = useState(false);
  const setLocation = useAppStore((state) => state.setLocation);

  const handleDeviceLocation = async () => {
    setLoading(true);
    const location = await requestDeviceLocation();
    setLoading(false);

    if (!location) {
      router.push("/postcode");
      return;
    }

    await localRepository.saveSetting("location", location);
    setLocation(location);
    router.push("/setup");
  };

  return (
    <OnboardingScreen
      description="Weather context shapes scan timing, rainfall advice, and recovery plans. Start with your current location or enter a postcode manually."
      eyebrow="Local Forecast"
      icon="near-me"
      step={2}
      title="Anchor LawnPal to the weather around your lawn."
    >
      <SurfaceBlock tone="accent">
        <SectionEyebrow tone="positive">Recommended</SectionEyebrow>
        <Text style={styles.panelTitle}>Use device location for the closest forecast signal</Text>
        <Text style={styles.panelBody}>
          LawnPal uses this for rainfall probability, frost risk, and timing guidance. It does not need precise address-level detail to work well.
        </Text>
      </SurfaceBlock>

      <SurfaceBlock tone="raised">
        <View style={styles.optionRow}>
          <View style={styles.optionCopy}>
            <SectionEyebrow>Option One</SectionEyebrow>
            <Text style={styles.optionTitle}>Use my location</Text>
            <Text style={styles.optionBody}>Fastest setup and the most accurate local forecast.</Text>
          </View>
        </View>
        <View style={styles.optionRow}>
          <View style={styles.optionCopy}>
            <SectionEyebrow>Option Two</SectionEyebrow>
            <Text style={styles.optionTitle}>Enter a postcode</Text>
            <Text style={styles.optionBody}>Good if you would rather skip device permissions.</Text>
          </View>
        </View>
      </SurfaceBlock>

      <Button
        disabled={loading}
        label={loading ? "Checking location..." : "Use my location"}
        onPress={() => void handleDeviceLocation()}
      />
      <Button label="Enter postcode instead" onPress={() => router.push("/postcode")} tone="ghost" />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  panelTitle: {
    color: palette.white,
    fontFamily: fonts.headlineBold,
    fontSize: 22
  },
  panelBody: {
    color: "rgba(255,255,255,0.82)",
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22
  },
  optionRow: {
    gap: spacing.xs
  },
  optionCopy: {
    gap: spacing.xs
  },
  optionTitle: {
    color: palette.primary,
    fontFamily: fonts.headlineBold,
    fontSize: 20
  },
  optionBody: {
    color: palette.inkSoft,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21
  }
});
