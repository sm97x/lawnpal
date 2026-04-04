import type { GrassStyle, SoilType } from "@lawnpal/core";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Body,
  Button,
  Card,
  Heading,
  InputField,
  Screen,
  Subheading
} from "@/components/ui";
import { palette, spacing } from "@/theme";
import { useAppStore } from "@/store/appStore";

const grassStyles: GrassStyle[] = ["hard-wearing", "ornamental", "shaded", "unknown"];
const soilTypes: SoilType[] = ["unknown", "sandy", "loam", "clay"];

const Selector = ({
  options,
  value,
  onChange
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) => (
  <View style={styles.selectorWrap}>
    {options.map((option) => {
      const active = option === value;
      return (
        <Pressable
          key={option}
          onPress={() => onChange(option)}
          style={[styles.selector, active && styles.selectorActive]}
        >
          <Text style={[styles.selectorText, active && styles.selectorTextActive]}>{option}</Text>
        </Pressable>
      );
    })}
  </View>
);

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
    <Screen>
      <Card>
        <Heading>Set up your lawn</Heading>
        <Body muted>
          Keep this simple. Lawn Pal only needs enough context to make better weekly decisions.
        </Body>
      </Card>

      <Card>
        <Subheading>Lawn name</Subheading>
        <InputField value={lawnName} onChangeText={setLawnName} placeholder="Home lawn" />
      </Card>

      <Card>
        <Subheading>Grass style</Subheading>
        <Selector options={grassStyles} value={grassStyle} onChange={(value) => setGrassStyle(value as GrassStyle)} />
      </Card>

      <Card>
        <Subheading>Soil type</Subheading>
        <Selector options={soilTypes} value={soilType} onChange={(value) => setSoilType(value as SoilType)} />
      </Card>

      <Button label="Continue to zones" onPress={handleContinue} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  selectorWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  selector: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface
  },
  selectorActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary
  },
  selectorText: {
    color: palette.ink,
    fontWeight: "600"
  },
  selectorTextActive: {
    color: "#FFFFFF"
  }
});
