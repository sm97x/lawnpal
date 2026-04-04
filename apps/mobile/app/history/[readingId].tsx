import type { RecommendationSet, SensorReading, Zone } from "@lawnpal/core";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Body, Button, Card, Heading, InputField, Screen, Subheading } from "@/components/ui";
import { localRepository } from "@/data/localRepository";
import { formatDateTime } from "@/lib/format";
import { useAppStore } from "@/store/appStore";

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

  const addPhoto = async (mode: "camera" | "library") => {
    const result =
      mode === "camera"
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.6 });

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
      <Screen>
        <Card>
          <Heading>Reading not found</Heading>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <Heading>{zone?.name ?? "Reading detail"}</Heading>
        <Body muted>{formatDateTime(reading.takenAt)}</Body>
        <Body>{summary?.mainIssue ?? "Saved reading"}</Body>
      </Card>

      <Card>
        <Subheading>Photo note</Subheading>
        {reading.photoUri ? <Image source={{ uri: reading.photoUri }} style={styles.image} /> : null}
        <View style={styles.actions}>
          <Button label="Take photo" tone="secondary" onPress={() => void addPhoto("camera")} />
          <Button label="Choose photo" tone="ghost" onPress={() => void addPhoto("library")} />
        </View>
        <InputField
          value={note}
          onChangeText={setNote}
          placeholder="Add a quick note about colour, softness, weeds or patchiness…"
          multiline
        />
        <Button label="Save note" onPress={() => void saveNote()} />
      </Card>

      <Card>
        <Subheading>Recommendations at the time</Subheading>
        {summary?.recommendations.map((recommendation) => (
          <Body key={recommendation.id}>• {recommendation.title}</Body>
        ))}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  image: {
    width: "100%",
    height: 220,
    borderRadius: 20
  },
  actions: {
    gap: 10
  }
});
