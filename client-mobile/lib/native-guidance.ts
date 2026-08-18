import { File, Paths } from "expo-file-system";
import * as Notifications from "expo-notifications";
import * as Speech from "expo-speech";
import { Platform } from "react-native";

export type NativeGuidanceSettings = {
  notificationsEnabled: boolean;
  voiceEnabled: boolean;
};

const SETTINGS_FILE = new File(Paths.document, "pluspuls-guidance.json");
const DEFAULT_SETTINGS: NativeGuidanceSettings = { notificationsEnabled: false, voiceEnabled: false };
const CHANNEL_ID = "driver-guidance";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function readNativeGuidanceSettings(): Promise<NativeGuidanceSettings> {
  try {
    if (!SETTINGS_FILE.exists) return DEFAULT_SETTINGS;
    const value = JSON.parse(await SETTINGS_FILE.text()) as Partial<NativeGuidanceSettings>;
    return {
      notificationsEnabled: value.notificationsEnabled === true,
      voiceEnabled: value.voiceEnabled === true,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function writeNativeGuidanceSettings(settings: NativeGuidanceSettings) {
  if (!SETTINGS_FILE.exists) SETTINGS_FILE.create({ intermediates: true, overwrite: true });
  SETTINGS_FILE.write(JSON.stringify(settings));
}

export async function ensureNotificationPermission() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Wskazówki dla kierowcy",
      description: "Krótkie, bezpieczne wskazówki relokacji PlusPuls.",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 180],
      lightColor: "#2EE6A6",
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.status === "granted") return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === "granted";
}

export async function presentGuidance(instruction: string, settings: NativeGuidanceSettings) {
  const safeInstruction = instruction.trim().slice(0, 220);
  if (!safeInstruction) return;
  if (settings.voiceEnabled) {
    await Speech.stop();
    Speech.speak(safeInstruction, { language: "pl-PL", rate: 0.92, pitch: 1 });
  }
  if (settings.notificationsEnabled) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "PlusPuls · następny ruch",
        body: safeInstruction,
        sound: "default",
        priority: Notifications.AndroidNotificationPriority.HIGH,
        data: { screen: "map" },
      },
      trigger: null,
    });
  }
}

export async function notificationPermissionStatus() {
  const permission = await Notifications.getPermissionsAsync();
  return permission.status;
}
