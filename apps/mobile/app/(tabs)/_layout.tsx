import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          display: "none"
        }
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="history" />
      <Tabs.Screen name="schedule" />
      <Tabs.Screen name="ask" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
