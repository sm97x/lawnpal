import { router } from "expo-router";
import { useState } from "react";
import { Body, Button, Card, Heading, Screen, Subheading } from "@/components/ui";
import { localRepository } from "@/data/localRepository";
import { requestDeviceLocation } from "@/services/locationService";
import { useAppStore } from "@/store/appStore";

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
    <Screen>
      <Card>
        <Heading>Use your local weather</Heading>
        <Body muted>
          Lawn Pal uses your location to tailor rainfall, frost risk and timing advice for your
          lawn.
        </Body>
      </Card>

      <Card>
        <Subheading>Location options</Subheading>
        <Body>Use device location for the most accurate forecast.</Body>
        <Body>If you would rather not, enter a postcode instead.</Body>
      </Card>

      <Button
        label={loading ? "Checking location…" : "Use my location"}
        onPress={() => void handleDeviceLocation()}
        disabled={loading}
      />
      <Button label="Enter postcode instead" tone="ghost" onPress={() => router.push("/postcode")} />
    </Screen>
  );
}
