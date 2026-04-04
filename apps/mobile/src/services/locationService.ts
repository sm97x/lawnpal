import * as Location from "expo-location";
import type { StoredLocation } from "../types";

export const requestDeviceLocation = async (): Promise<StoredLocation | null> => {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    return null;
  }

  const position = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced
  });
  const reverse = await Location.reverseGeocodeAsync(position.coords);
  const first = reverse[0];
  const label = [first?.district, first?.city, first?.region].filter(Boolean).join(", ");

  return {
    lat: position.coords.latitude,
    lon: position.coords.longitude,
    label: label || "Current location",
    source: "device"
  };
};

