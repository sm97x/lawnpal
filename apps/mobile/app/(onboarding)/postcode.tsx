import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { OnboardingScreen } from "@/components/onboarding";
import { SectionEyebrow, SurfaceBlock } from "@/components/stitch";
import { Button, InputField } from "@/components/ui";
import { localRepository } from "@/data/localRepository";
import { weatherService } from "@/services/weatherService";
import { useAppStore } from "@/store/appStore";
import { fonts, palette } from "@/theme";

export default function PostcodeScreen() {
  const [postcode, setPostcode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const setLocation = useAppStore((state) => state.setLocation);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError("");
      const location = await weatherService.geocodePostcode(postcode.trim());
      await localRepository.saveSetting("location", location);
      setLocation(location);
      router.push("/setup");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Unable to use that postcode.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingScreen
      description="Use a postcode to pull the right forecast and rainfall trends if you would rather not share device location."
      eyebrow="Manual Location"
      icon="pin-drop"
      step={2}
      title="Point LawnPal at the right patch of weather."
    >
      <SurfaceBlock tone="raised">
        <SectionEyebrow>Postcode</SectionEyebrow>
        <InputField
          onChangeText={setPostcode}
          placeholder="LS1 4AP or SW1A 1AA"
          value={postcode}
        />
        <Text style={styles.helperText}>UK postcode format works best for this setup path.</Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </SurfaceBlock>

      <SurfaceBlock tone="accent">
        <SectionEyebrow tone="positive">Why This Matters</SectionEyebrow>
        <Text style={styles.panelText}>
          The location powers rainfall probability, temperature swings, and weekly timing recommendations across the app.
        </Text>
      </SurfaceBlock>

      <Button
        disabled={loading || postcode.trim().length < 4}
        label={loading ? "Finding your area..." : "Use this postcode"}
        onPress={() => void handleSubmit()}
      />
      <Button label="Back to location options" onPress={() => router.push("/location")} tone="ghost" />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  helperText: {
    color: palette.inkMuted,
    fontFamily: fonts.body,
    fontSize: 13
  },
  errorText: {
    color: palette.danger,
    fontFamily: fonts.bodySemi,
    fontSize: 13
  },
  panelText: {
    color: "rgba(255,255,255,0.82)",
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22
  }
});
