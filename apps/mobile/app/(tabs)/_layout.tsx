import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { palette } from "@/theme";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.primary,
        tabBarInactiveTintColor: palette.inkSoft,
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: palette.border,
          height: 84,
          paddingTop: 8
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="leaf-outline" color={color} size={size} />
          )
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" color={color} size={size} />
          )
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: "Plan",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-clear-outline" color={color} size={size} />
          )
        }}
      />
      <Tabs.Screen
        name="ask"
        options={{
          title: "Ask",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses-outline" color={color} size={size} />
          )
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="options-outline" color={color} size={size} />
          )
        }}
      />
    </Tabs>
  );
}
