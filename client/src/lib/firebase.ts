import { initializeApp, getApps } from "firebase/app";
import { getAnalytics, isSupported as analyticsSupported } from "firebase/analytics";
import { getMessaging, isSupported as messagingSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

export let analytics: ReturnType<typeof getAnalytics> | undefined = undefined;
if (typeof window !== "undefined" && window.location.protocol === "https:" && firebaseConfig.measurementId) {
  analyticsSupported().then((ok) => {
    if (ok) { analytics = getAnalytics(app); }
  });
}

export let messaging: ReturnType<typeof getMessaging> | undefined = undefined;
if (typeof window !== "undefined" && firebaseConfig.messagingSenderId && import.meta.env.VITE_FIREBASE_VAPID_KEY) {
  messagingSupported().then((ok) => {
    if (ok) { messaging = getMessaging(app); }
  });
}