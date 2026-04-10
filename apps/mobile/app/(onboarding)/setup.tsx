import type { GrassStyle, SoilType } from "@lawnpal/core";
import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ChoicePill, OnboardingScreen } from "@/components/onboarding";
import { SectionEyebrow, SurfaceBlock } from "@/components/stitch";
import { Button, InputField } from "@/components/ui";
import { useAppStore } from "@/store/appStore";
import { fonts, palette, spacing } from "@/theme";

const grassStyles: GrassStyle[] = ["hard-wearing", "ornamental", "shaded", "unknown"];
const soilTypes: SoilType[] = ["unknown", "sandy", "loam", "clay"];

const titleCase = (value: string) =>
  value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export default function SetupScreen() {
  const draft = useAppStore((state) => state.onboardingDraft);
  const setDraft = useAppStore((state) => state.setOnboardingDraft);
  const [lawnName, setLawnName] = useState(draft?.lawnName ?? "Home lawn");
  const [grassStyle, setGrassStyle] = useState<GrassStyle>(draft?.grassStyle ?? "hard-wearing");
  const [soilType, setSoilType] = useState<SoilType>(draft?.soilType ?? "unknown");

  const handleContinue = () => {
    setDraft({
      lawnName: lawnName.trim() || "Home lawn",
      grassStyle,
      soilType
    });
    router.push("/zones");
  };

  return (
    <OnboardingScreen
      description="A lightweight lawn profile helps the app frame scan results, diagnose edge cases, and tailor action plans."
      eyebrow="Lawn Profile"
      icon="grass"
      step={3}
      title="Add just enough context for better recommendations."
    >
      <SurfaceBlock tone="raised">
        <SectionEyebrow>Lawn Name</SectionEyebrow>
        <InputField onChangeText={setLawnName} placeholder="Home lawn" value={lawnName} />
      </SurfaceBlock>

      <SurfaceBlock tone="raised">
        <SectionEyebrow>Grass Style</SectionEyebrow>
        <View style={styles.choiceWrap}>
          {grassStyles.map((option) => (
            <ChoicePill
              key={option}
              active={option === grassStyle}
              label={titleCase(option)}
              onPress={() => setGrassStyle(option)}
            />
          ))}
        </View>
      </SurfaceBlock>

      <SurfaceBlock tone="raised">
        <SectionEyebrow>Soil Type</SectionEyebrow>
        <View style={styles.choiceWrap}>
          {soilTypes.map((option) => (
            <ChoicePill
              key={option}
              active={option === soilType}
              label={titleCase(option)}
              onPress={() => setSoilType(option)}
            />
          ))}
        </View>
      </SurfaceBlock>

      <SurfaceBlock tone="accent">
        <SectionEyebrow tone="positive">Current Profile</SectionEyebrow>
        <Text style={styles.profileTitle}>{lawnName.trim() || "Home lawn"}</Text>
        <Text style={styles.profileBody}>
          {`${titleCase(grassStyle)} grass with ${titleCase(soilType)} soil.`}
        </Text>
      </SurfaceBlock>

      <Button label="Continue to zones" onPress={handleContinue} />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  choiceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  profileTitle: {
    color: palette.white,
    fontFamily: fonts.headlineBold,
    fontSize: 22
  },
  profileBody: {
    color: "rgba(255,255,255,0.82)",
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22
  }
});
