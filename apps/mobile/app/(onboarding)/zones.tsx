import { makeId, type Lawn, type Zone, type ZoneExposure } from "@lawnpal/core";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChoicePill, OnboardingScreen } from "@/components/onboarding";
import { SectionEyebrow, SurfaceBlock } from "@/components/stitch";
import { Button, InputField } from "@/components/ui";
import { localRepository } from "@/data/localRepository";
import { useAppStore } from "@/store/appStore";
import { fonts, palette, radius, spacing } from "@/theme";

type DraftZone = {
  id: string;
  name: string;
  exposure: ZoneExposure;
};

const presets: { name: string; exposure: ZoneExposure }[] = [
  { name: "Front lawn", exposure: "sunny" },
  { name: "Back lawn", exposure: "mixed" },
  { name: "Shade area", exposure: "shade" },
  { name: "Sunny strip", exposure: "sunny" }
];

const exposureOptions: ZoneExposure[] = ["sunny", "part-shade", "shade", "mixed"];

const titleCase = (value: string) =>
  value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export default function ZonesScreen() {
  const draft = useAppStore((state) => state.onboardingDraft);
  const setDraft = useAppStore((state) => state.setOnboardingDraft);
  const setLawnContext = useAppStore((state) => state.setLawnContext);
  const setOnboardingComplete = useAppStore((state) => state.setOnboardingComplete);
  const setSelectedZoneId = useAppStore((state) => state.setSelectedZoneId);
  const [zones, setZones] = useState<DraftZone[]>([
    { id: makeId("zone"), name: "Front lawn", exposure: "sunny" },
    { id: makeId("zone"), name: "Back lawn", exposure: "mixed" }
  ]);
  const [customName, setCustomName] = useState("");
  const [customExposure, setCustomExposure] = useState<ZoneExposure>("mixed");
  const canSave = Boolean(draft?.lawnName) && zones.length > 0;

  const missingPresets = useMemo(
    () => presets.filter((preset) => !zones.some((zone) => zone.name === preset.name)),
    [zones]
  );

  const addPreset = (name: string, exposure: ZoneExposure) => {
    setZones((current) => [...current, { id: makeId("zone"), name, exposure }]);
  };

  const addCustom = () => {
    if (!customName.trim()) {
      return;
    }

    setZones((current) => [
      ...current,
      { id: makeId("zone"), name: customName.trim(), exposure: customExposure }
    ]);
    setCustomName("");
    setCustomExposure("mixed");
  };

  const removeZone = (id: string) => {
    setZones((current) => current.filter((zone) => zone.id !== id));
  };

  const finishOnboarding = async (goToDemo: boolean) => {
    if (!draft) {
      return;
    }

    const now = new Date().toISOString();
    const lawn: Lawn = {
      id: makeId("lawn"),
      name: draft.lawnName,
      createdAt: now,
      profile: {
        grassStyle: draft.grassStyle,
        soilType: draft.soilType
      }
    };
    const savedZones: Zone[] = zones.map((zone, index) => ({
      id: zone.id,
      lawnId: lawn.id,
      name: zone.name,
      exposure: zone.exposure,
      createdAt: now,
      sortOrder: index
    }));

    await localRepository.saveLawn(lawn);
    await localRepository.saveZones(savedZones);
    await localRepository.saveSetting("onboardingComplete", true);

    setLawnContext({ lawn, zones: savedZones });
    setSelectedZoneId(savedZones[0]?.id ?? null);
    setOnboardingComplete(true);
    setDraft(null);

    if (goToDemo) {
      router.replace("/scan");
      return;
    }

    router.replace("/(tabs)");
  };

  return (
    <OnboardingScreen
      description="Zones let LawnPal separate a damp shaded area from a hotter sunny strip, so the dashboard and scan results can be more specific."
      eyebrow="Zone Mapping"
      icon="grid-view"
      step={4}
      title="Map the zones you want the app to reason about."
    >
      <SurfaceBlock tone="accent">
        <SectionEyebrow tone="positive">Suggested Zones</SectionEyebrow>
        <View style={styles.choiceWrap}>
          {missingPresets.map((preset) => (
            <ChoicePill
              key={preset.name}
              icon="add"
              label={preset.name}
              onPress={() => addPreset(preset.name, preset.exposure)}
            />
          ))}
        </View>
      </SurfaceBlock>

      <SurfaceBlock tone="raised">
        <SectionEyebrow>Add A Custom Zone</SectionEyebrow>
        <InputField
          onChangeText={setCustomName}
          placeholder="Side patch, dog run, shady strip..."
          value={customName}
        />
        <View style={styles.choiceWrap}>
          {exposureOptions.map((option) => (
            <ChoicePill
              key={option}
              active={option === customExposure}
              label={titleCase(option)}
              onPress={() => setCustomExposure(option)}
            />
          ))}
        </View>
        <Button label="Add zone" onPress={addCustom} tone="secondary" />
      </SurfaceBlock>

      <SurfaceBlock tone="raised">
        <View style={styles.zoneHeader}>
          <View>
            <SectionEyebrow>Your Zones</SectionEyebrow>
            <Text style={styles.zoneTitle}>{`${zones.length} zones ready`}</Text>
          </View>
        </View>
        <View style={styles.zoneList}>
          {zones.map((zone) => (
            <View key={zone.id} style={styles.zoneRow}>
              <View style={styles.zoneCopy}>
                <Text style={styles.zoneName}>{zone.name}</Text>
                <Text style={styles.zoneMeta}>{titleCase(zone.exposure)}</Text>
              </View>
              <Pressable onPress={() => removeZone(zone.id)} style={styles.removeButton}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>
      </SurfaceBlock>

      <Button
        disabled={!canSave}
        label="Try demo mode"
        onPress={() => void finishOnboarding(true)}
      />
      <Button
        disabled={!canSave}
        label="Connect sensor later"
        onPress={() => void finishOnboarding(false)}
        tone="ghost"
      />
    </OnboardingScreen>
  );
}

const styles = StyleSheet.create({
  choiceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  zoneHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md
  },
  zoneTitle: {
    color: palette.primary,
    fontFamily: fonts.headlineBold,
    fontSize: 22
  },
  zoneList: {
    gap: spacing.sm
  },
  zoneRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md
  },
  zoneCopy: {
    flex: 1,
    gap: 2
  },
  zoneName: {
    color: palette.primary,
    fontFamily: fonts.headlineBold,
    fontSize: 18
  },
  zoneMeta: {
    color: palette.inkSoft,
    fontFamily: fonts.body,
    fontSize: 13
  },
  removeButton: {
    borderRadius: radius.pill,
    backgroundColor: palette.dangerSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm
  },
  removeText: {
    color: palette.danger,
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    textTransform: "uppercase"
  }
});
