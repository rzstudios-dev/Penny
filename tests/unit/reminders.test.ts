import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSettings } from "../../src/lib/model";
import { tipPeriod, tipForDate } from "../../src/lib/tips";

const mocks = vi.hoisted(() => ({
  native: true,
  permission: "granted",
  pending: [] as { id: number }[],
  schedule: vi.fn(),
  cancel: vi.fn(),
  request: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => mocks.native },
}));
vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: {
    getPending: async () => ({ notifications: mocks.pending }),
    cancel: mocks.cancel,
    checkPermissions: async () => ({ display: mocks.permission }),
    requestPermissions: mocks.request,
    createChannel: async () => {},
    schedule: mocks.schedule,
  },
}));
import {
  configureNotifications,
  sendTestNotification,
} from "../../src/lib/notifications";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.native = true;
  mocks.permission = "granted";
  mocks.pending = [];
  mocks.request.mockResolvedValue({ display: "granted" });
  mocks.schedule.mockResolvedValue({});
  mocks.cancel.mockResolvedValue({});
});
describe("Android reminder choices", () => {
  it("schedules daily, monthly free-plan and weekly signed-out reminders independently", async () => {
    await configureNotifications(
      { ...defaultSettings, reminders: "daily" },
      false,
      false,
    );
    const list = mocks.schedule.mock.calls[0][0].notifications;
    expect(list.map((n: { id: number }) => n.id)).toEqual([1001, 1002, 1003]);
    expect(list[0].schedule.on).toEqual({ hour: 19, minute: 0 });
    expect(list[1].schedule.on.day).toBe(2);
    expect(list[2].schedule.on.weekday).toBe(1);
  });
  it.each(["weekly", "monthly"] as const)(
    "uses the selected %s calendar schedule",
    async (frequency) => {
      await configureNotifications(
        {
          ...defaultSettings,
          reminders: frequency,
          premiumReminder: false,
          loginReminder: false,
        },
        true,
        true,
      );
      const on = mocks.schedule.mock.calls[0][0].notifications[0].schedule.on;
      expect(on).toEqual(
        frequency === "weekly"
          ? { weekday: 1, hour: 19, minute: 0 }
          : { day: 1, hour: 19, minute: 0 },
      );
    },
  );
  it("removes recurring reminders when disabled without canceling a test notification", async () => {
    mocks.pending = [{ id: 1001 }, { id: 1003 }, { id: 1004 }];
    await configureNotifications(
      {
        ...defaultSettings,
        reminders: "never",
        loginReminder: false,
        premiumReminder: false,
      },
      false,
    );
    expect(mocks.cancel).toHaveBeenCalledWith({
      notifications: [{ id: 1001 }, { id: 1003 }],
    });
    expect(mocks.schedule).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("suppresses login and premium invitations for a signed-in premium member", async () => {
    await configureNotifications(defaultSettings, true, true);
    expect(mocks.schedule).not.toHaveBeenCalled();
  });
  it("does not schedule after denied permission and explains how to enable it", async () => {
    mocks.permission = "denied";
    mocks.request.mockResolvedValue({ display: "denied" });
    await expect(
      configureNotifications(
        { ...defaultSettings, reminders: "daily" },
        false,
        false,
        true,
      ),
    ).rejects.toThrow(/Android settings/);
    expect(mocks.schedule).not.toHaveBeenCalled();
  });
  it("sends a real native test five seconds later", async () => {
    const start = Date.now();
    await sendTestNotification();
    const note = mocks.schedule.mock.calls[0][0].notifications[0];
    expect(note.id).toBe(1004);
    expect(note.schedule.at.getTime()).toBeGreaterThanOrEqual(start + 5000);
  });
});
describe("On-open tips", () => {
  it("keys daily, Monday-based weekly and monthly tips once per period", () => {
    const a = new Date(2026, 9, 5, 8),
      b = new Date(2026, 9, 5, 23),
      next = new Date(2026, 9, 6);
    expect(tipPeriod("daily", a)).toBe(tipPeriod("daily", b));
    expect(tipPeriod("daily", a)).not.toBe(tipPeriod("daily", next));
    expect(tipPeriod("weekly", a)).toBe(
      tipPeriod("weekly", new Date(2026, 9, 11)),
    );
    expect(tipPeriod("weekly", a)).not.toBe(
      tipPeriod("weekly", new Date(2026, 9, 12)),
    );
    expect(tipPeriod("monthly", a)).toBe(
      tipPeriod("monthly", new Date(2026, 9, 31)),
    );
    expect(tipPeriod("never", a)).toBeNull();
    expect(tipForDate(a)).toEqual(tipForDate(b));
  });
});
