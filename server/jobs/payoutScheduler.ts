import cron from "node-cron";
import Stripe from "stripe";
import { storage } from "../storage.js";
import { STRIPE_SECRET_KEY } from "../env.js";

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2024-04-10" });

export async function runPayoutsJob() {
  console.log(`[PAYOUT] Starting payout scheduler...`);

  // 1. Get all readers with balance >= $15 and stripeAccountId set
  const eligible = (await storage.getAllUsers())
    .filter(
      (u) =>
        u.role === "reader" &&
        Number(u.accountBalance) >= 1500 &&
        u.stripeAccountId
    );

  if (eligible.length === 0) {
    console.log("[PAYOUT] No eligible readers for payout.");
    return { success: true, message: "No eligible readers for payout." };
  }

  for (const reader of eligible) {
    const amount = reader.accountBalance!;
    try {
      // 2. Create Stripe Transfer
      const transfer = await stripe.transfers.create({
        amount,
        currency: "usd",
        destination: reader.stripeAccountId!,
        description: `SoulSeer Reader Earnings Payout - UserID ${reader.id}`,
      });
      // 3. Insert payout row, zero balance
      await storage.createPayout({
        readerId: reader.id,
        amountCents: amount,
        status: "paid",
        stripeTransferId: transfer.id,
        createdAt: new Date(),
        paidAt: new Date(),
      });
      await storage.updateUser(reader.id, { accountBalance: 0 });
      console.log(`[PAYOUT] Paid ${amount / 100} USD to reader #${reader.id} (Stripe Transfer: ${transfer.id})`);
    } catch (err: any) {
      // 4. On failure, insert payout row with status failed
      await storage.createPayout({
        readerId: reader.id,
        amountCents: amount,
        status: "failed",
        failureReason: err?.message || "Unknown error",
        createdAt: new Date(),
      });
      console.error(`[PAYOUT] Failed to pay reader #${reader.id}: ${err?.message || err}`);
    }
  }
  return { success: true, message: "Payouts processed." };
}

// Cron setup
export function startPayoutScheduler() {
  if (process.env.ENABLE_PAYOUT_CRON === "true") {
    cron.schedule("0 8 * * *", () => runPayoutsJob(), { timezone: "UTC" });
    console.log("[PAYOUT] Payout cron scheduled for 08:00 UTC daily.");
  }
}

// For CLI/manual run
if (require.main === module) {
  runPayoutsJob().then(() => process.exit(0));
}