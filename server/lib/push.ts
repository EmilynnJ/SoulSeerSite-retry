import admin from "firebase-admin";
import { storage } from "../storage.js";

const {
  FIREBASE_PROJECT_ID,
  FIREBASE_CLIENT_EMAIL,
  FIREBASE_PRIVATE_KEY,
} = process.env;

let pushEnabled = false;
try {
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
    });
    pushEnabled = true;
  }
} catch (e) {
  // Prevent crash if already initialized or missing keys
  pushEnabled = false;
}

export async function sendPush(userId: number, title: string, body: string, data?: Record<string, string>) {
  if (!pushEnabled) return;
  const tokens = await storage.getPushTokensByUser(userId);
  if (!tokens?.length) return;
  const response = await admin.messaging().sendEachForMulticast({
    tokens: tokens.map((t) => t.token),
    notification: { title, body },
    data,
    webpush: {
      notification: {
        actions: [{ action: "open", title: "Open" }],
        icon: "/logo192.png",
      },
    },
  });
  // clean up invalid tokens
  response.responses.forEach((r, idx) => {
    if (!r.success) {
      storage.deletePushToken(tokens[idx].token);
    }
  });
}