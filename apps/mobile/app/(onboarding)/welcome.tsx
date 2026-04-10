import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { OnboardingScreen } from "@/components/onboarding";
import { SectionEyebrow, SurfaceBlock } from "@/components/stitch";
import { Button } from "@/components/ui";
import { fonts, palette, spacing } from "@/theme";

const highlights = [
  "One stitched dashboard for weather, soil data, and next actions.",
  "Clear scan results instead of raw sensor metrics.",
  "Local-first history and AI diagnosis when something looks off."
];

export default function WelcomeScreen() {
  return (
    <OnboardingScreen
      description="LawnPal turns weather, sensor readings, and simple lawn context into a calm weekly operating view for your lawn."
      eyebrow="Environmental Intelligence"
      icon="eco"
      step={1}
      title="Your weekly lawn coach, redesigned around signal instead of noise."
    >
      <SurfaceBlock tone="accent">
        <SectionEyebrow tone="positive">What You Get</SectionEyebrow>
        <View style={styles.highlightList}>
          {highlights.map((item) => (
            <View key={item} style={styles.highlightRow}>
              <View style={styles.highlightDot} />
              <Text style={styles.highlightText}>{item}</Text>
            </View>
          ))}
        </View>
      </SurfaceBlock>

      <SurfaceBlock tone="raised">
        <SectionEyebrow>Setup Flow</SectionEyebrow>
        <Text style={styles.panelTitle}>Two minutes to a usable lawn profile</Text>
        <Text style={styles.panelBody}>
          You will add your location, define the lawn profile, and map the zones you want to track. Everything else can evolve later.
        </Text>
      </SurfaceBlock>

      <Button label="Start setup" onPress={() => router.push("/location")} />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  highlightList: {
    gap: spacing.md
  },
  highlightRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm
  },
  highlightDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: palette.white,
    marginTop: 7
  },
  highlightText: {
    flex: 1,
    color: "rgba(255,255,255,0.82)",
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22
  },
  panelTitle: {
    color: palette.primary,
    fontFamily: fonts.headlineBold,
    fontSize: 22
  },
  panelBody: {
    color: palette.inkSoft,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22
  }
});
