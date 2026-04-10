import type { RecommendationSet, SensorReading, Zone } from "@lawnpal/core";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { AppScreen } from "@/components/appChrome";
import { SectionEyebrow, SurfaceBlock } from "@/components/stitch";
import { Button, InputField } from "@/components/ui";
import { localRepository } from "@/data/localRepository";
import { formatDateTime } from "@/lib/format";
import { useAppStore } from "@/store/appStore";
import { fonts, palette, spacing } from "@/theme";

export default function HistoryDetailScreen() {
  const { readingId } = useLocalSearchParams<{ readingId: string }>();
  const bumpVersion = useAppStore((state) => state.bumpVersion);
  const [reading, setReading] = useState<SensorReading | null>(null);
  const [summary, setSummary] = useState<RecommendationSet | null>(null);
  const [zone, setZone] = useState<Zone | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const nextReading = await localRepository.getReadingById(readingId);
    const nextSummary = await localRepository.getRecommendationSetByReadingId(readingId);
    const nextZone = nextReading ? await localRepository.getZoneById(nextReading.zoneId) : null;

    setReading(nextReading);
    setSummary(nextSummary);
    setZone(nextZone);
    setNote(nextReading?.note ?? "");
  }, [readingId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const addPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.6 });
    if (result.canceled || !result.assets[0]) {
      return;
    }

    await localRepository.updateReadingMedia(readingId, { photoUri: result.assets[0].uri });
    await load();
    bumpVersion();
  };

  const saveNote = async () => {
    await localRepository.updateReadingMedia(readingId, { note });
    await load();
    bumpVersion();
  };

  if (!reading) {
    return (
      <AppScreen navKey="history">
        <SurfaceBlock>
          <Text style={styles.title}>Reading not found</Text>
        </SurfaceBlock>
      </AppScreen>
    );
  }

  return (
    <AppScreen navKey="history">
      <SurfaceBlock>
        <SectionEyebrow>{zone?.name ?? "Reading detail"}</SectionEyebrow>
        <Text style={styles.title}>{summary?.mainIssue ?? "Saved reading"}</Text>
        <Text style={styles.subtitle}>{formatDateTime(reading.takenAt)}</Text>
      </SurfaceBlock>

      <SurfaceBlock tone="raised">
        <SectionEyebrow>Photo Note</SectionEyebrow>
        {reading.photoUri ? <Image source={{ uri: reading.photoUri }} style={styles.image} /> : null}
        <Button label="Choose photo" onPress={() => void addPhoto()} tone="secondary" />
        <InputField
          multiline
          onChangeText={setNote}
          placeholder="Add a quick note about color, softness, weeds, or patchiness..."
          value={note}
        />
        <Button label="Save note" onPress={() => void saveNote()} />
      </SurfaceBlock>

      {summary ? (
        <SurfaceBlock tone="raised">
          <SectionEyebrow>Recommendations at the time</SectionEyebrow>
          <View style={styles.list}>
            {summary.recommendations.map((recommendation) => (
              <Text key={recommendation.id} style={styles.item}>
                {recommendation.title}
              </Text>
            ))}
          </View>
        </SurfaceBlock>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  title: {
    color: palette.primary,
    fontFamily: fonts.headlineBold,
    fontSize: 26
  },
  subtitle: {
    color: palette.inkSoft,
    fontFamily: fonts.body,
    fontSize: 14
  },
  image: {
    width: "100%",
    height: 220,
    borderRadius: 24
  },
  list: {
    gap: spacing.sm
  },
  item: {
    color: palette.primary,
    fontFamily: fonts.bodySemi,
    fontSize: 14
  }
});
