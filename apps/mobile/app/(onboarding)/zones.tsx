import { makeId, type Lawn, type Zone, type ZoneExposure } from "@lawnpal/core";
import { router } from "expo-router";
import { useMemo, useState } from "react";
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
import { localRepository } from "@/data/localRepository";
import { useAppStore } from "@/store/appStore";
import { palette, spacing } from "@/theme";

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
    <Screen>
      <Card>
        <Heading>Set up zones</Heading>
        <Body muted>
          Zones help Lawn Pal spot patterns like a damp back lawn or a shaded patch that needs a
          different plan.
        </Body>
      </Card>

      <Card>
        <Subheading>Suggested zones</Subheading>
        <View style={styles.presetWrap}>
          {missingPresets.map((preset) => (
            <Pressable
              key={preset.name}
              onPress={() => addPreset(preset.name, preset.exposure)}
              style={styles.presetButton}
            >
              <Text style={styles.presetText}>+ {preset.name}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Card>
        <Subheading>Add a custom zone</Subheading>
        <InputField
          value={customName}
          onChangeText={setCustomName}
          placeholder="Side patch, dog run, shady strip…"
        />
        <View style={styles.presetWrap}>
          {exposureOptions.map((option) => {
            const active = option === customExposure;
            return (
              <Pressable
                key={option}
                onPress={() => setCustomExposure(option)}
                style={[styles.exposureButton, active && styles.exposureButtonActive]}
              >
                <Text style={[styles.exposureText, active && styles.exposureTextActive]}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Button label="Add zone" tone="secondary" onPress={addCustom} />
      </Card>

      <Card>
        <Subheading>Your zones</Subheading>
        {zones.map((zone) => (
          <View key={zone.id} style={styles.zoneRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.zoneName}>{zone.name}</Text>
              <Text style={styles.zoneMeta}>{zone.exposure}</Text>
            </View>
            <Pressable onPress={() => removeZone(zone.id)}>
              <Text style={styles.removeText}>Remove</Text>
            </Pressable>
          </View>
        ))}
      </Card>

      <Button
        label="Try demo mode"
        onPress={() => void finishOnboarding(true)}
        disabled={!canSave}
      />
      <Button
        label="Connect sensor later"
        tone="ghost"
        onPress={() => void finishOnboarding(false)}
        disabled={!canSave}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  presetWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm
  },
  presetButton: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: palette.border
  },
  presetText: {
    color: palette.ink,
    fontWeight: "600"
  },
  exposureButton: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: palette.border
  },
  exposureButtonActive: {
    backgroundColor: palette.primary,
    borderColor: palette.primary
  },
  exposureText: {
    color: palette.ink,
    fontWeight: "600"
  },
  exposureTextActive: {
    color: "#FFFFFF"
  },
  zoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xs
  },
  zoneName: {
    color: palette.ink,
    fontWeight: "600",
    fontSize: 16
  },
  zoneMeta: {
    color: palette.inkSoft,
    marginTop: 2
  },
  removeText: {
    color: palette.danger,
    fontWeight: "600"
  }
});
