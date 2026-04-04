import type { CaseReminder, ScheduleTask } from "@lawnpal/core";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const isNativeNotificationRuntime = Platform.OS !== "web";

if (isNativeNotificationRuntime) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false
    })
  });
}

export const ensureNotificationPermissions = async (): Promise<boolean> => {
  if (!isNativeNotificationRuntime) {
    return false;
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
};

export const syncTaskNotifications = async (
  tasks: ScheduleTask[],
  enabled: boolean
): Promise<void> => {
  if (!isNativeNotificationRuntime) {
    return;
  }

  await Notifications.cancelAllScheduledNotificationsAsync();

  if (!enabled) {
    return;
  }

  const granted = await ensureNotificationPermissions();
  if (!granted) {
    return;
  }

  const futureTasks = tasks
    .filter((task) => task.status === "pending")
    .filter((task) => new Date(task.startDate).getTime() > Date.now())
    .slice(0, 5);

  for (const task of futureTasks) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Lawn Pal reminder",
        body: task.title
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(task.startDate)
      }
    });
  }
};

export const scheduleCaseReminderNotification = async (
  reminder: CaseReminder,
  enabled: boolean
): Promise<void> => {
  if (!isNativeNotificationRuntime || !enabled) {
    return;
  }

  const granted = await ensureNotificationPermissions();
  if (!granted) {
    return;
  }

  const remindAt = new Date(reminder.remindAt);
  if (Number.isNaN(remindAt.getTime()) || remindAt.getTime() <= Date.now()) {
    return;
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Lawn Pal reminder",
      body: reminder.title
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: remindAt
    }
  });
};
