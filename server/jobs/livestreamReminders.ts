import cron from "node-cron";
import { storage } from "../storage.js";
import { sendPush } from "../lib/push.js";

export async function runLiveReminderJob() {
  const now = new Date();
  const tenMin = new Date(now.getTime() + 10 * 60000);
  const nineMin = new Date(now.getTime() + 9 * 60000);

  // Find scheduled livestreams starting in ~10 min and not reminded
  const streams = await storage.listScheduledLivestreams();
  const toRemind = streams.filter(
    (ls: any) =>
      !ls.reminderSent &&
      ls.scheduledFor &&
      new Date(ls.scheduledFor) > nineMin &&
      new Date(ls.scheduledFor) <= tenMin
  );

  for (const ls of toRemind) {
    // Get subscribers
    const subs = await storage.listSubscriptionsByLivestream(ls.id);
    for (const sub of subs) {
      await sendPush(
        sub.userId,
        "Livestream starting soon",
        `${ls.reader?.fullName || "A psychic"} goes live in ~10 minutes`,
        { type: "live_reminder", livestreamId: String(ls.id) }
      );
      await storage.markSubscriptionReminderSent(ls.id, sub.userId, new Date());
    }
    await storage.setLivestreamReminderSent(ls.id);
  }
}

export function startLiveReminderScheduler() {
  if (process.env.ENABLE_LIVE_REMINDER_CRON === "true") {
    cron.schedule("* * * * *", () => runLiveReminderJob(), { timezone: "UTC" });
    console.log("[LIVESTREAM REMINDER] Cron scheduled every minute.");
  }
}