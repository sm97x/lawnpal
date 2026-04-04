import { Redirect } from "expo-router";
import { useAppStore } from "@/store/appStore";

export default function IndexScreen() {
  const onboardingComplete = useAppStore((state) => state.onboardingComplete);

  if (onboardingComplete) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/welcome" />;
}
