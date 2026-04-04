import { router } from "expo-router";
import { Body, Button, Card, Chip, Heading, Screen, Subheading } from "@/components/ui";

export default function WelcomeScreen() {
  return (
    <Screen>
      <Card>
        <Chip label="Lawn Pal" tone="positive" />
        <Heading>Your weekly lawn coach</Heading>
        <Body muted>
          Lawn Pal turns weather, sensor readings and simple lawn context into clear weekly
          decisions. No dashboards to decode. Just what to do, what not to do, and when to check
          again.
        </Body>
      </Card>

      <Card>
        <Subheading>What the MVP does</Subheading>
        <Body>Uses local weather, mock sensor readings and history to guide your next step.</Body>
        <Body>Stores everything on your device only.</Body>
        <Body>Lets you try demo mode now and plug in real Bluetooth later.</Body>
      </Card>

      <Button label="Start setup" onPress={() => router.push("/location")} />
    </Screen>
  );
}
