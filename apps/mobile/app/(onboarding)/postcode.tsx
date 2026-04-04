import { router } from "expo-router";
import { useState } from "react";
import { Body, Button, Card, Heading, InputField, Screen } from "@/components/ui";
import { localRepository } from "@/data/localRepository";
import { weatherService } from "@/services/weatherService";
import { useAppStore } from "@/store/appStore";

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
    <Screen>
      <Card>
        <Heading>Enter your postcode</Heading>
        <Body muted>
          Lawn Pal will use this to fetch the right weather for your lawn if location permission is
          not available.
        </Body>
      </Card>

      <Card>
        <InputField
          value={postcode}
          onChangeText={setPostcode}
          placeholder="LS1 4AP or SW1A 1AA"
        />
        {error ? <Body>{error}</Body> : null}
      </Card>

      <Button
        label={loading ? "Finding your area…" : "Use this postcode"}
        onPress={() => void handleSubmit()}
        disabled={loading || postcode.trim().length < 4}
      />
    </Screen>
  );
}
