import { Capacitor } from "@capacitor/core";
import {
  LocalNotifications,
  type LocalNotificationSchema,
} from "@capacitor/local-notifications";
import type { Settings } from "./model";
let scheduling: Promise<unknown> = Promise.resolve();
export function configureNotifications(
  settings: Settings,
  premium: boolean,
  signedIn = false,
  requestPermission = false,
) {
  const operation = scheduling
    .catch(() => {})
    .then(() =>
      scheduleNotifications(settings, premium, signedIn, requestPermission),
    );
  scheduling = operation;
  return operation;
}
async function scheduleNotifications(
  settings: Settings,
  premium: boolean,
  signedIn = false,
  requestPermission = false,
) {
  if (!Capacitor.isNativePlatform()) {
    if (
      requestPermission &&
      (settings.reminders !== "never" ||
        (!signedIn && settings.loginReminder) ||
        (!premium && settings.premiumReminder))
    )
      throw new Error(
        "Your preferences are saved. Scheduled reminders are delivered by the Android app.",
      );
    return;
  }
  const pending = await LocalNotifications.getPending();
  const ours = pending.notifications.filter((n) =>
    [1001, 1002, 1003, 1004].includes(n.id),
  );
  if (ours.length) await LocalNotifications.cancel({ notifications: ours });
  const enabled =
    settings.reminders !== "never" ||
    (!signedIn && settings.loginReminder) ||
    (!premium && settings.premiumReminder);
  if (!enabled) return;
  let permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted" && requestPermission)
    permission = await LocalNotifications.requestPermissions();
  if (permission.display !== "granted") {
    if (requestPermission)
      throw new Error(
        "Notifications are disabled on your device. Enable them in Android settings to receive reminders.",
      );
    return;
  }
  await LocalNotifications.createChannel({
    id: "penny-gentle-reminders",
    name: "Budget tips & reminders",
    description: "Your chosen budget check-ins and optional premium reminder",
    importance: 3,
    visibility: 0,
  });
  const notifications: LocalNotificationSchema[] = [];
  if (settings.reminders !== "never") {
    const on =
      settings.reminders === "daily"
        ? { hour: settings.reminderHour, minute: 0 }
        : settings.reminders === "weekly"
          ? { weekday: 1, hour: settings.reminderHour, minute: 0 }
          : { day: 1, hour: settings.reminderHour, minute: 0 };
    notifications.push({
      id: 1001,
      title: "A little Penny check-in",
      body: "Give today’s spending a home.",
      channelId: "penny-gentle-reminders",
      isExactNotification: false,
      schedule: { on, allowWhileIdle: false },
    });
  }
  if (!premium && settings.premiumReminder)
    notifications.push({
      id: 1002,
      title: "A little more possibility",
      body: "More pockets. More insights. Meet Premium.",
      channelId: "penny-gentle-reminders",
      isExactNotification: false,
      schedule: {
        on: { day: 2, hour: settings.reminderHour, minute: 0 },
        allowWhileIdle: false,
      },
    });
  if (!signedIn && settings.loginReminder) {
    const installed = new Date(settings.installedAt);
    if (!Number.isNaN(installed.getTime())) for (let month = 1; month <= 2; month++) {
      const at = new Date(installed.getFullYear(), installed.getMonth() + month, Math.min(installed.getDate(), 28), settings.reminderHour);
      if (at.getTime() <= Date.now()) continue;
      notifications.push({
        id: 1002 + month,
        title: "Keep your pennies safe",
        body: "Sign in and turn on cloud sync.",
        channelId: "penny-gentle-reminders",
        isExactNotification: false,
        schedule: { at, allowWhileIdle: false },
      });
    }
  }
  if (notifications.length)
    await LocalNotifications.schedule({ notifications });
}
export async function clearNotifications() {
  await scheduling.catch(() => {});
  if (!Capacitor.isNativePlatform()) return;
  const { notifications } = await LocalNotifications.getPending();
  if (notifications.length) await LocalNotifications.cancel({ notifications });
}

export async function notificationStatus() {
  if (!Capacitor.isNativePlatform())
    return "Android app delivers scheduled notifications.";
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted")
    return "Device notifications are off. Save to request permission.";
  const { notifications } = await LocalNotifications.getPending();
  const count = notifications.filter((n) =>
    [1001, 1002, 1003, 1004].includes(n.id),
  ).length;
  return count
    ? `Notifications enabled · ${count} reminder${count === 1 ? "" : "s"} scheduled`
    : "Notifications enabled · no reminders scheduled";
}
